import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { PRO_TIERS } from '@/lib/assistant/command-engine'
import { generateBriefing, hasSomethingToBrief } from '@/lib/assistant/proactive'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Orçamento de tempo: paramos de processar novos treinadores ao nos aproximarmos
// do maxDuration e deixamos a cauda para a próxima execução (idempotência garante
// que ninguém é briefado duas vezes). Alerta logado quando isso acontece.
const TIME_BUDGET_MS = 270_000

/**
 * CRON: briefing proativo da manhã (Fase C — modo proativo do Assistente).
 *
 * Para cada treinador Pro+ COM algo a reportar (insight ativo), gera um resumo do
 * dia via o motor compartilhado (surface 'proactive') e entrega por notificação +
 * push. Best-effort por treinador — um erro não derruba o lote.
 *
 * Filtros ordenados do mais barato ao mais caro: elegibilidade (count) → tier →
 * LLM. Roda após o generate-insights (09:00 UTC) para resumir os alertas do dia.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ai_briefing_log (migration 213) ainda não está nos tipos gerados — handle
    // destipado isolado (mesmo padrão de conversations.ts) p/ não arriscar gen:types.
    const adminUntyped = supabaseAdmin as unknown as SupabaseClient

    try {
        const start = Date.now()
        // Ordem estável por id: a cauda não processada é sempre a mesma fatia, e a
        // próxima execução continua de onde parou (via marcador de idempotência).
        const { data: trainers, error } = await supabaseAdmin
            .from('trainers')
            .select('id, name')
            .order('id', { ascending: true })
        if (error || !trainers) {
            console.error('[cron:morning-briefing] Falha ao buscar treinadores:', error)
            return NextResponse.json({ error: 'Fetch error' }, { status: 500 })
        }

        // Idempotência: quem já recebeu o briefing HOJE é pulado (sem push/cobrança
        // duplicados num retry do Vercel). Data em UTC (o cron roda em UTC).
        const today = new Date().toISOString().slice(0, 10)
        const { data: briefedRows } = await adminUntyped
            .from('ai_briefing_log')
            .select('trainer_id')
            .eq('briefed_on', today)
        const briefedSet = new Set((briefedRows ?? []).map((r: { trainer_id: string }) => r.trainer_id))

        let generated = 0
        let pushed = 0
        let skipped = 0
        let deferred = 0

        for (const trainer of trainers) {
            // Já briefado hoje → não repete (idempotência).
            if (briefedSet.has(trainer.id)) {
                skipped++
                continue
            }
            // Orçamento de tempo esgotado → adia o resto para a próxima execução.
            if (Date.now() - start > TIME_BUDGET_MS) {
                deferred = trainers.length - generated - skipped
                console.warn(
                    `[cron:morning-briefing] orçamento de tempo (${TIME_BUDGET_MS}ms) atingido; ~${deferred} treinadores ficam para a próxima execução`,
                )
                break
            }
            try {
                // 1. Filtro barato: tem algo a reportar hoje?
                if (!(await hasSomethingToBrief(supabaseAdmin, trainer.id))) {
                    skipped++
                    continue
                }
                // 2. Tier Pro+ (o Assistente com IA é Pro+).
                const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
                if (!PRO_TIERS.has(tier)) {
                    skipped++
                    continue
                }
                // 3. Gera o briefing (LLM, surface 'proactive').
                const briefing = await generateBriefing(supabaseAdmin, {
                    trainerId: trainer.id,
                    trainerName: trainer.name,
                })
                if (!briefing.text) {
                    skipped++
                    continue
                }
                // 4. Entrega: notificação + push (best-effort).
                const notifId = await insertTrainerNotification({
                    trainerId: trainer.id,
                    type: 'assistant_briefing',
                    title: 'Seu resumo do dia',
                    message: briefing.text,
                    metadata: { kind: 'morning_briefing' },
                })
                generated++
                // Marca ANTES do push: o briefing já foi persistido como notificação;
                // não queremos repetir num retry mesmo que o push falhe.
                await adminUntyped
                    .from('ai_briefing_log')
                    .upsert({ trainer_id: trainer.id, briefed_on: today }, {
                        onConflict: 'trainer_id,briefed_on',
                        ignoreDuplicates: true,
                    })
                if (notifId) {
                    await sendTrainerPush({
                        trainerId: trainer.id,
                        type: 'assistant_briefing',
                        title: 'Seu resumo do dia',
                        body: briefing.text.slice(0, 180),
                        data: { screen: 'assistant' },
                        notificationId: notifId,
                    }).catch(() => {})
                    pushed++
                }
            } catch (e) {
                console.error(`[cron:morning-briefing] treinador ${trainer.id} falhou:`, e)
            }
        }

        console.log(
            `[cron:morning-briefing] ${generated} briefings, ${pushed} push, ${skipped} pulados, ${deferred} adiados de ${trainers.length} treinadores`,
        )
        return NextResponse.json({ trainers: trainers.length, generated, pushed, skipped, deferred })
    } catch (err) {
        console.error('[cron:morning-briefing] Erro inesperado:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

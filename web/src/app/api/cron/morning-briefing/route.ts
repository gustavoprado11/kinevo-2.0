import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { PRO_TIERS } from '@/lib/assistant/command-engine'
import { generateBriefing, hasSomethingToBrief } from '@/lib/assistant/proactive'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    try {
        const { data: trainers, error } = await supabaseAdmin.from('trainers').select('id, name')
        if (error || !trainers) {
            console.error('[cron:morning-briefing] Falha ao buscar treinadores:', error)
            return NextResponse.json({ error: 'Fetch error' }, { status: 500 })
        }

        let generated = 0
        let pushed = 0
        let skipped = 0

        for (const trainer of trainers) {
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
            `[cron:morning-briefing] ${generated} briefings, ${pushed} push, ${skipped} pulados de ${trainers.length} treinadores`,
        )
        return NextResponse.json({ trainers: trainers.length, generated, pushed, skipped })
    } catch (err) {
        console.error('[cron:morning-briefing] Erro inesperado:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// POST /api/assistant/winback-draft
//
// Camada de AÇÃO do card "Plano expirou". Gera UM rascunho de winback
// (gpt-4.1-mini, JSON) na voz do treinador e informa se dá pra anexar um link
// de renovação (carteira Asaas aprovada). NÃO envia e NÃO gera o link — o link
// é gerado no envio (via /api/wallet/subscriptions) para não criar contrato
// pending órfão em rascunhos descartados.
//
// Espelha auth + rate-limit de /api/assistant/draft-message.

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consumeRateLimit } from '@/lib/rate-limit'
import { callLLM, callWithRetry } from '@/lib/prescription/llm-client'
import { parseDraftOutput } from '@/lib/assistant/draft-prompt'
import { WINBACK_SYSTEM_PROMPT, buildWinbackContextBlock, type WinbackContext } from '@/lib/assistant/winback-prompt'
import { getWalletRow, summarizeWallet } from '@/lib/asaas/wallet-service'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { recordAiUsage, usdToMicros } from '@/lib/ai-usage/metering'
import { recordFreeTrial, getQuotaForTier } from '@/lib/ai-usage/quota'

export const maxDuration = 45

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_MS = 24 * 60 * 60 * 1000

function intervalToPtBr(interval: string | null | undefined): string | null {
    if (!interval) return null
    const i = interval.toLowerCase()
    if (i.startsWith('quart')) return 'trimestral'
    if (i.startsWith('year') || i === 'annual') return 'anual'
    if (i.startsWith('semi')) return 'semestral'
    if (i.startsWith('month')) return 'mensal'
    return interval
}

export async function POST(req: Request) {
    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id, name')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return new Response('Trainer not found', { status: 404 })

        // 3. Rate limit per-trainer
        const limit = await consumeRateLimit(`assistant:winback:${trainer.id}`, {
            perMinute: 10,
            perDay: 100,
        })
        if (!limit.allowed) {
            return new Response(limit.error || 'Rate limit exceeded', { status: 429 })
        }

        // 3b. Gate de cota de IA (defense-in-depth) — paridade com o chat. ANTES
        //     chamava o LLM pago sem checar tier/cota (vazamento). Esgotou (free-trial
        //     OU balde) → 402 amigável; débito após gerar (passo 9b). Não trava o app.
        const usage = await getAiUsageSummary(supabaseAdmin, trainer.id)
        if (usage.exhausted) {
            const message =
                usage.tier === 'free'
                    ? 'Você já testou os recursos de IA do plano Gratuito. Assine um plano para continuar gerando rascunhos com IA.'
                    : 'Cota de IA do período atingida. A IA volta no próximo ciclo; você pode escrever a mensagem manualmente.'
            return new Response(
                JSON.stringify({ error: 'ai_quota_exhausted', tier: usage.tier, message, resetAt: usage.periodEnd }),
                { status: 402, headers: { 'Content-Type': 'application/json' } },
            )
        }

        // 4. Validate body
        const body = await req.json().catch(() => null)
        const studentId: string | undefined =
            typeof body?.student_id === 'string' && UUID_RE.test(body.student_id) ? body.student_id : undefined
        const planId: string | undefined =
            typeof body?.plan_id === 'string' && UUID_RE.test(body.plan_id) ? body.plan_id : undefined
        if (!studentId || !planId) {
            return new Response('student_id e plan_id são obrigatórios', { status: 400 })
        }

        // 5. Ownership: aluno + plano do treinador
        const [studentRes, planRes] = await Promise.all([
            supabaseAdmin.from('students').select('id, name, coach_id').eq('id', studentId).single(),
            supabaseAdmin.from('trainer_plans').select('id, title, price, interval, trainer_id').eq('id', planId).single(),
        ])
        const student = studentRes.data
        const plan = planRes.data
        if (!student || student.coach_id !== trainer.id) {
            return new Response('Aluno não encontrado', { status: 404 })
        }
        if (!plan || plan.trainer_id !== trainer.id) {
            return new Response('Plano não encontrado', { status: 404 })
        }

        // 6. Contexto: contrato expirado mais recente desse aluno+plano
        const { data: contract } = await supabaseAdmin
            .from('student_contracts')
            .select('current_period_end, start_date, created_at')
            .eq('trainer_id', trainer.id)
            .eq('student_id', studentId)
            .eq('plan_id', planId)
            .order('current_period_end', { ascending: false })
            .limit(1)
            .maybeSingle()

        const expiredAt = contract?.current_period_end ?? null
        const daysSinceExpired = expiredAt
            ? Math.max(0, Math.floor((Date.now() - new Date(expiredAt).getTime()) / DAY_MS))
            : null
        const tenureStart = contract?.start_date ?? contract?.created_at ?? null
        const tenureMonths = tenureStart && expiredAt
            ? Math.max(0, Math.round((new Date(expiredAt).getTime() - new Date(tenureStart).getTime()) / (30 * DAY_MS)))
            : null

        const ctx: WinbackContext = {
            studentName: student.name ?? 'Aluno',
            planTitle: plan.title ?? null,
            planPrice: plan.price != null ? Number(plan.price) : null,
            planInterval: intervalToPtBr(plan.interval),
            expiredAt,
            daysSinceExpired,
            tenureMonths,
            hasData: Boolean(plan.title || expiredAt),
        }

        // 7. Gera o rascunho
        const result = await callWithRetry(
            () => callLLM({
                model: 'gpt-4.1-mini',
                system: WINBACK_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: buildWinbackContextBlock(ctx) }],
                json_object_mode: true,
                max_tokens: 400,
                timeout_ms: 15000,
                temperature: 0.5,
            }),
            { maxAttempts: 2 },
        )
        if (result.status !== 'success' || !result.data) {
            return new Response('Falha ao gerar rascunho', { status: 502 })
        }
        const draft = parseDraftOutput(result.data, ctx.hasData)
        if (!draft) return new Response('Rascunho inválido', { status: 502 })

        // 8. Pode anexar link? (carteira Asaas aprovada + plano com preço)
        const wallet = await getWalletRow(trainer.id)
        const canAttachLink = summarizeWallet(wallet).canReceivePayments && Number(plan.price) > 0

        // 9. Loga uso (best-effort — o medidor)
        if (result.usage) {
            try {
                await supabaseAdmin
                    .from('assistant_llm_usage' as never)
                    .insert({
                        trainer_id: trainer.id,
                        feature: 'winback_draft',
                        model: result.model,
                        input_tokens: result.usage.input_tokens,
                        output_tokens: result.usage.output_tokens,
                        cost_usd: result.usage.cost_usd,
                    } as never)
            } catch (e) {
                console.error('[winback-draft] usage log failed:', e)
            }
        }

        // 9b. Metering no balde de cota (paridade com o chat). Pago → debita 1
        //     crédito (clamp no teto do plano); free → marca o free-trial 'write'.
        try {
            const costMicros = result.usage ? usdToMicros(result.usage.cost_usd) : 0
            if (usage.tier === 'free') {
                await recordFreeTrial(supabaseAdmin, trainer.id, 'write')
            } else {
                await recordAiUsage(supabaseAdmin, {
                    trainerId: trainer.id,
                    periodType: getQuotaForTier(usage.tier)?.period ?? 'month',
                    creditLimit: getQuotaForTier(usage.tier)?.credits ?? null,
                    credits: 1,
                    costMicros,
                    events: [{
                        actionClass: 'write',
                        credits: 1,
                        surface: 'proactive',
                        model: result.model,
                        inputTokens: result.usage?.input_tokens,
                        outputTokens: result.usage?.output_tokens,
                        costMicros,
                    }],
                })
            }
        } catch (meterErr) {
            console.error('[winback-draft] metering best-effort falhou:', meterErr)
        }

        return Response.json({ draft, can_attach_link: canAttachLink, cost_usd: result.usage?.cost_usd ?? 0 })
    } catch (e) {
        console.error('[winback-draft] unexpected error:', e)
        return new Response('Erro interno', { status: 500 })
    }
}

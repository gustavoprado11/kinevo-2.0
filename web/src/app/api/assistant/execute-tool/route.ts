/**
 * Executor HITL de tool de escrita (Fase 0 — IA do Treinador).
 *
 * Caminho de confirmação: as CONFIRM_TOOLS chegam ao cliente SEM `execute`
 * (ver mcp-bridge), o cliente renderiza o card e, ao confirmar, chama este
 * endpoint com { toolName, args }. Aqui revalidamos auth + tier + cota
 * (defense-in-depth — nunca confiar só na UI), executamos a tool real por nome
 * via ponte e registramos o crédito.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { executeMcpToolByName } from '@/lib/assistant/mcp-bridge'
import {
    claimActionIdempotency,
    finishActionIdempotency,
    releaseActionIdempotency,
    type IdempotencyClaim,
} from '@/lib/assistant/idempotency'
import { redactSensitive } from '@/lib/assistant/redact'
import {
    CONFIRM_TOOLS,
    actionClassForTool,
    creditWeightForCall,
} from '@/lib/assistant/tool-policy'
import {
    checkQuota,
    checkFreeTrial,
    recordFreeTrial,
} from '@/lib/ai-usage/quota'
import { recordAiUsage, type AiSurface } from '@/lib/ai-usage/metering'
import { recordTurnTrace, toolResultOk } from '@/lib/assistant/turn-trace'
import { validateConfirmArgs } from '@/lib/assistant/arg-validation'
import { limitSensitive } from '@/lib/assistant/rate-limits'
import { assistantErrorResponse } from '@/lib/assistant/errors'

export const maxDuration = 60

const VALID_SURFACES: ReadonlySet<string> = new Set<AiSurface>([
    'command_bar',
    'workspace',
    'canvas',
    'proactive',
    'mobile',
    'voice',
])

/**
 * CONFIRM_TOOLS que expõem um param `confirm` próprio (gate de preview no schema da
 * tool). Quando o humano confirma pelo card, ESTE endpoint já é a aprovação humana →
 * forçamos `confirm:true`; sem isso a tool só devolve o preview e NÃO executa
 * (auditoria 2026-06-22, S10).
 */
const TOOLS_WITH_CONFIRM_PARAM: ReadonlySet<string> = new Set<string>([
    'kinevo_create_contract',
    'kinevo_mark_payment_as_paid',
    'kinevo_cancel_contract',
    'kinevo_convert_lead',
])

/** UUID v4-ish — valida a idempotency_key recebida do card (C6). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function studentCountFromArgs(args: unknown): number {
    if (args && typeof args === 'object' && 'student_ids' in args) {
        const ids = (args as { student_ids?: unknown }).student_ids
        if (Array.isArray(ids)) return ids.length
    }
    return 1
}

export async function POST(req: NextRequest) {
    try {
        // 1. Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // 2. Resolve trainer
        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

        // 3. Parse + validar input
        const body = await req.json().catch(() => null)
        const toolName: unknown = body?.toolName
        const args: unknown = body?.args ?? {}
        const surface: AiSurface | undefined =
            typeof body?.surface === 'string' && VALID_SURFACES.has(body.surface)
                ? (body.surface as AiSurface)
                : undefined
        const idemKey: string | null =
            typeof body?.idempotencyKey === 'string' && UUID_RE.test(body.idempotencyKey)
                ? body.idempotencyKey
                : null

        if (typeof toolName !== 'string' || !CONFIRM_TOOLS.has(toolName)) {
            // Este endpoint só executa as tools de HITL (confirmáveis).
            return NextResponse.json(
                { error: 'Tool inválida para confirmação.' },
                { status: 400 },
            )
        }

        // 3b. Rate-limit de ações sensíveis (G6) — anti-loop / anti-engano em sequência.
        const rl = await limitSensitive(trainer.id)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'rate_limited', message: rl.error }, { status: 429 })
        }

        // 4. Tier + gate de cota (defense-in-depth)
        const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
        const actionClass = actionClassForTool(toolName)
        const credits = creditWeightForCall(toolName, studentCountFromArgs(args))

        if (tier === 'free') {
            const trial = await checkFreeTrial(supabaseAdmin, trainer.id, actionClass)
            if (!trial.allowed) {
                return NextResponse.json(
                    {
                        error: 'free_trial_used',
                        message:
                            'Você já testou essa ação no plano Gratuito. Assine um plano para usar de verdade.',
                    },
                    { status: 402 },
                )
            }
        } else {
            const quota = await checkQuota(supabaseAdmin, trainer.id, tier)
            if (!quota.allowed) {
                return NextResponse.json(
                    {
                        error: 'quota_exceeded',
                        message:
                            'Cota de IA do período atingida. Você pode continuar pela interface normal; a cota reinicia em breve.',
                        resetAt: quota.resetAt,
                    },
                    { status: 402 },
                )
            }
        }

        // 4a. Idempotência (C6): reserva a key do card ANTES de validar/executar. Um 2º
        //     clique/retry com a mesma key NÃO re-executa: replay devolve o resultado
        //     salvo (sem re-cobrar); 'processing' = outra requisição executando agora.
        if (idemKey) {
            // Best-effort: se a idempotência estiver indisponível (ex.: migração ainda
            // não aplicada), NÃO trava a ação — só segue sem dedup desta vez.
            let claim: IdempotencyClaim | null = null
            try {
                claim = await claimActionIdempotency(supabaseAdmin, idemKey, trainer.id, toolName)
            } catch (e) {
                console.error('[execute-tool] idempotency claim falhou (segue sem dedup):', e)
            }
            if (claim?.outcome === 'replay') {
                return NextResponse.json({ success: true, result: claim.result, idempotent: true })
            }
            if (claim?.outcome === 'processing') {
                return NextResponse.json(
                    { error: 'processing', message: 'Esta ação já está sendo processada. Aguarde um instante.' },
                    { status: 409 },
                )
            }
        }

        // 4b. Validação semântica (G5) — defense-in-depth. Mesmo após o card, revalida
        //     posse/estado do alvo; bloqueia se inválido (alvo errado, já cancelado...).
        const validation = await validateConfirmArgs(
            supabaseAdmin,
            trainer.id,
            toolName,
            (args ?? {}) as Record<string, unknown>,
        )
        if (!validation.ok) {
            // Libera a reserva — a ação não foi executada, um retry legítimo pode rodar.
            if (idemKey) await releaseActionIdempotency(supabaseAdmin, idemKey, trainer.id)
            return NextResponse.json(
                { error: 'validation_failed', message: validation.reason },
                { status: 422 },
            )
        }

        // 5. Executar a tool real por nome (ponte in-memory, tenant-escopada por trainerId).
        //    Tools com gate `confirm` próprio: o card JÁ é a aprovação humana → forçar
        //    confirm:true (senão a tool devolve só o preview e não executa — S10).
        const execArgs =
            TOOLS_WITH_CONFIRM_PARAM.has(toolName) && args && typeof args === 'object'
                ? { ...(args as Record<string, unknown>), confirm: true }
                : args
        let result: unknown
        try {
            result = await executeMcpToolByName(trainer.id, toolName, execArgs)
        } catch (execErr) {
            // Falha na execução: libera a reserva p/ permitir retry com a mesma key.
            if (idemKey) await releaseActionIdempotency(supabaseAdmin, idemKey, trainer.id)
            throw execErr
        }
        // Conclui a idempotência com o resultado REDIGIDO (C6 + S6: nunca grava senha).
        if (idemKey) await finishActionIdempotency(supabaseAdmin, idemKey, trainer.id, redactSensitive(result))

        // 5b. Trace de auditoria da ação sensível confirmada (best-effort).
        const argStudentId =
            args && typeof args === 'object' && typeof (args as { student_id?: unknown }).student_id === 'string'
                ? (args as { student_id: string }).student_id
                : null
        await recordTurnTrace(supabaseAdmin, {
            trainerId: trainer.id,
            studentId: argStudentId,
            kind: 'confirmed_action',
            surface: surface ?? null,
            tools: [
                {
                    toolName,
                    args: args as Record<string, unknown>,
                    ok: toolResultOk(result),
                },
            ],
            credits,
        })

        // 6. Registrar uso (Free → free-trial; pago → crédito). costMicros=0:
        //    a execução de tool não chama LLM (o custo do LLM é medido no turno do chat).
        if (tier === 'free') {
            await recordFreeTrial(supabaseAdmin, trainer.id, actionClass)
        } else {
            const quota = await checkQuota(supabaseAdmin, trainer.id, tier)
            await recordAiUsage(supabaseAdmin, {
                trainerId: trainer.id,
                periodType: quota.period ?? 'month',
                creditLimit: quota.limit, // clamp atômico no teto do plano (C1)
                credits,
                costMicros: 0,
                events: [{ actionClass, credits, surface }],
            })
        }

        return NextResponse.json({ success: true, result })
    } catch (error) {
        return assistantErrorResponse('execute-tool', error)
    }
}

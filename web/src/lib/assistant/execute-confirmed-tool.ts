/**
 * Núcleo do executor HITL de tool de escrita (compartilhado web + mobile).
 *
 * Extraído de /api/assistant/execute-tool para ser fonte ÚNICA de verdade das
 * checagens de segurança (rate-limit, tier/cota, idempotência C6, validação
 * semântica G5, trace e metering). Recebe o trainerId já autenticado (cada rota
 * resolve auth do seu jeito: cookie no web, Bearer no mobile) e devolve
 * {status, body} para a rota apenas repassar.
 *
 * NÃO duplicar esta lógica em rotas — sempre chamar esta função.
 */
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
import { CONFIRM_TOOLS, actionClassForTool, creditWeightForCall } from '@/lib/assistant/tool-policy'
import { checkQuota, checkFreeTrial, recordFreeTrial } from '@/lib/ai-usage/quota'
import { recordAiUsage, type AiSurface } from '@/lib/ai-usage/metering'
import { recordTurnTrace, toolResultOk, mcpErrorMessage } from '@/lib/assistant/turn-trace'
import { validateConfirmArgs } from '@/lib/assistant/arg-validation'
import { limitSensitive } from '@/lib/assistant/rate-limits'

const VALID_SURFACES: ReadonlySet<string> = new Set<AiSurface>([
    'command_bar',
    'workspace',
    'canvas',
    'proactive',
    'mobile',
    'voice',
])

/**
 * CONFIRM_TOOLS que expõem um param `confirm` próprio (gate de preview no schema).
 * Quando o humano confirma pelo card, ESTE caminho já é a aprovação humana →
 * forçamos `confirm:true`; sem isso a tool só devolve o preview e NÃO executa (S10).
 */
const TOOLS_WITH_CONFIRM_PARAM: ReadonlySet<string> = new Set<string>([
    'kinevo_create_contract',
    'kinevo_mark_payment_as_paid',
    'kinevo_cancel_contract',
    'kinevo_convert_lead',
    'kinevo_archive_student',
    'kinevo_correct_assessment',
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

export interface ExecuteConfirmedToolResult {
    status: number
    body: Record<string, unknown>
}

export async function executeConfirmedTool(input: {
    trainerId: string
    toolName: unknown
    args?: unknown
    surface?: unknown
    idempotencyKey?: unknown
}): Promise<ExecuteConfirmedToolResult> {
    const trainerId = input.trainerId
    const toolName: unknown = input.toolName
    const args: unknown = input.args ?? {}
    const surface: AiSurface | undefined =
        typeof input.surface === 'string' && VALID_SURFACES.has(input.surface)
            ? (input.surface as AiSurface)
            : undefined
    const idemKey: string | null =
        typeof input.idempotencyKey === 'string' && UUID_RE.test(input.idempotencyKey)
            ? input.idempotencyKey
            : null

    if (typeof toolName !== 'string' || !CONFIRM_TOOLS.has(toolName)) {
        // Este caminho só executa as tools de HITL (confirmáveis).
        return { status: 400, body: { error: 'Tool inválida para confirmação.' } }
    }

    // 3b. Rate-limit de ações sensíveis (G6) — anti-loop / anti-engano em sequência.
    const rl = await limitSensitive(trainerId)
    if (!rl.allowed) {
        return { status: 429, body: { error: 'rate_limited', message: rl.error } }
    }

    // 4. Tier + gate de cota (defense-in-depth)
    const tier = await getAiTierForTrainer(supabaseAdmin, trainerId)
    const actionClass = actionClassForTool(toolName)
    const credits = creditWeightForCall(toolName, studentCountFromArgs(args))

    if (tier === 'free') {
        const trial = await checkFreeTrial(supabaseAdmin, trainerId, actionClass)
        if (!trial.allowed) {
            return {
                status: 402,
                body: {
                    error: 'free_trial_used',
                    message:
                        'Você já testou essa ação no plano Gratuito. Assine um plano para usar de verdade.',
                },
            }
        }
    } else {
        const quota = await checkQuota(supabaseAdmin, trainerId, tier)
        if (!quota.allowed) {
            return {
                status: 402,
                body: {
                    error: 'quota_exceeded',
                    message:
                        'Cota de IA do período atingida. Você pode continuar pela interface normal; a cota reinicia em breve.',
                    resetAt: quota.resetAt,
                },
            }
        }
    }

    // 4a. Idempotência (C6): reserva a key do card ANTES de validar/executar.
    if (idemKey) {
        let claim: IdempotencyClaim | null = null
        try {
            claim = await claimActionIdempotency(supabaseAdmin, idemKey, trainerId, toolName)
        } catch (e) {
            console.error('[execute-confirmed-tool] idempotency claim falhou (segue sem dedup):', e)
        }
        if (claim?.outcome === 'replay') {
            return { status: 200, body: { success: true, result: claim.result, idempotent: true } }
        }
        if (claim?.outcome === 'processing') {
            return {
                status: 409,
                body: { error: 'processing', message: 'Esta ação já está sendo processada. Aguarde um instante.' },
            }
        }
    }

    // 4b. Validação semântica (G5) — defense-in-depth.
    const validation = await validateConfirmArgs(
        supabaseAdmin,
        trainerId,
        toolName,
        (args ?? {}) as Record<string, unknown>,
    )
    if (!validation.ok) {
        if (idemKey) await releaseActionIdempotency(supabaseAdmin, idemKey, trainerId)
        return { status: 422, body: { error: 'validation_failed', message: validation.reason } }
    }

    // 5. Executar a tool real por nome (ponte in-memory, tenant-escopada por trainerId).
    const execArgs =
        TOOLS_WITH_CONFIRM_PARAM.has(toolName) && args && typeof args === 'object'
            ? { ...(args as Record<string, unknown>), confirm: true }
            : args
    let result: unknown
    try {
        result = await executeMcpToolByName(trainerId, toolName, execArgs)
    } catch (execErr) {
        if (idemKey) await releaseActionIdempotency(supabaseAdmin, idemKey, trainerId)
        throw execErr
    }

    // 5a. Falha REAL da tool (mcpError → isError:true): NUNCA reportar sucesso.
    //     Antes o card mostrava "Feito" mesmo com a ação falhada no servidor
    //     (auditoria 2026-07-01) — o pior bug de confiança de um caminho de
    //     dinheiro/destrutivo. Falhou → libera a idempotency key (retry legítimo),
    //     não cobra, e devolve o motivo ao card.
    const ok = toolResultOk(result)
    if (idemKey) {
        if (ok) await finishActionIdempotency(supabaseAdmin, idemKey, trainerId, redactSensitive(result))
        else await releaseActionIdempotency(supabaseAdmin, idemKey, trainerId)
    }

    // 5b. Trace de auditoria da ação sensível confirmada (best-effort).
    const argStudentId =
        args && typeof args === 'object' && typeof (args as { student_id?: unknown }).student_id === 'string'
            ? (args as { student_id: string }).student_id
            : null
    await recordTurnTrace(supabaseAdmin, {
        trainerId,
        studentId: argStudentId,
        kind: 'confirmed_action',
        surface: surface ?? null,
        tools: [{ toolName, args: args as Record<string, unknown>, ok }],
        credits,
    })

    if (!ok) {
        const detail = mcpErrorMessage(result)
        return {
            status: 502,
            body: {
                error: 'tool_failed',
                message: detail
                    ? `A ação não foi concluída: ${detail}`
                    : 'A ação não foi concluída — nada foi alterado. Tente novamente.',
            },
        }
    }

    // 6. Registrar uso (best-effort: a ação JÁ executou com sucesso).
    try {
        if (tier === 'free') {
            await recordFreeTrial(supabaseAdmin, trainerId, actionClass)
        } else {
            const quota = await checkQuota(supabaseAdmin, trainerId, tier)
            await recordAiUsage(supabaseAdmin, {
                trainerId,
                periodType: quota.period ?? 'month',
                creditLimit: quota.limit,
                credits,
                costMicros: 0,
                events: [{ actionClass, credits, surface }],
            })
        }
    } catch (meteringErr) {
        console.error('[execute-confirmed-tool] metering best-effort falhou:', meteringErr)
    }

    return { status: 200, body: { success: true, result } }
}

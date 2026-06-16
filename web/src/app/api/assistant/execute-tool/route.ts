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

export const maxDuration = 60

const VALID_SURFACES: ReadonlySet<string> = new Set<AiSurface>([
    'command_bar',
    'workspace',
    'canvas',
    'proactive',
    'mobile',
    'voice',
])

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

        if (typeof toolName !== 'string' || !CONFIRM_TOOLS.has(toolName)) {
            // Este endpoint só executa as tools de HITL (confirmáveis).
            return NextResponse.json(
                { error: 'Tool inválida para confirmação.' },
                { status: 400 },
            )
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

        // 5. Executar a tool real por nome (ponte in-memory, tenant-escopada por trainerId)
        const result = await executeMcpToolByName(trainer.id, toolName, args)

        // 6. Registrar uso (Free → free-trial; pago → crédito). costMicros=0:
        //    a execução de tool não chama LLM (o custo do LLM é medido no turno do chat).
        if (tier === 'free') {
            await recordFreeTrial(supabaseAdmin, trainer.id, actionClass)
        } else {
            const quota = await checkQuota(supabaseAdmin, trainer.id, tier)
            await recordAiUsage(supabaseAdmin, {
                trainerId: trainer.id,
                periodType: quota.period ?? 'month',
                credits,
                costMicros: 0,
                events: [{ actionClass, credits, surface }],
            })
        }

        return NextResponse.json({ success: true, result })
    } catch (error) {
        console.error('[execute-tool] error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 },
        )
    }
}

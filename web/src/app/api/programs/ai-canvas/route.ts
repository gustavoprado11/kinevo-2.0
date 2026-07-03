// Endpoint do chat "Gerar com IA" ao vivo do builder (feature:
// docs/feature-ia-builder-chat.md). Stream NDJSON: progresso → program → done.
// Não persiste nada — o programa vai pro canvas do cliente; o save é no builder.
//
// Metering/quota: o GATE (gateAssistant — todos os tiers, limite por USO) é aplicado
// ANTES; o REGISTRO de uso (recordAiUsage) roda DEPOIS do turno (best-effort) — debita
// crédito no período e loga custo/tokens em ai_usage_events (surface 'canvas'). Build
// (rendered) = CANVAS_BUILD_CREDITS; turno sem render = 1 (query). Free TAMBÉM chega
// (gateAssistant) e é metrificado contra a franquia de teste — ATENÇÃO: aqui NÃO há
// gate 1×-por-ação como no generateProgram do chat (paridade pendente — ver follow-up).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gateAssistant } from '@/lib/assistant/command-engine'
import { limitTurn } from '@/lib/assistant/rate-limits'
import { runCanvasTurn } from '@/lib/programs/ai-canvas/run-canvas-turn'
import { recordAiUsage, turnCostMicros, type TokenUsage } from '@/lib/ai-usage/metering'
import { getQuotaForTier } from '@/lib/ai-usage/quota'
import { CANVAS_BUILD_CREDITS } from '@/lib/assistant/tool-policy'
import type { CanvasStreamEvent, CanvasTurnRequest } from '@/lib/programs/ai-canvas/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return Response.json({ error: 'trainer_not_found' }, { status: 404 })

    const admin = createAdminClient()
    const gate = await gateAssistant(admin, trainer.id)
    if (!gate.allowed) {
        return Response.json({ error: gate.error, message: gate.message }, { status: gate.status })
    }
    // Narrowing fora do closure do stream (TS não preserva narrowing em closure).
    const { tier, period } = gate

    let body: CanvasTurnRequest
    try {
        body = (await req.json()) as CanvasTurnRequest
    } catch {
        return Response.json({ error: 'bad_request' }, { status: 400 })
    }
    if (!body?.studentId || !body?.message?.trim()) {
        return Response.json({ error: 'bad_request' }, { status: 400 })
    }

    // Posse: o aluno tem que ser deste treinador.
    const { data: student } = await supabase
        .from('students')
        .select('id, name')
        .eq('id', body.studentId)
        .eq('coach_id', trainer.id)
        .single()
    if (!student) return Response.json({ error: 'student_not_found' }, { status: 404 })

    // Rate-limit de turno — anti-amplificação de custo. O gate de cota acima
    // limita por PERÍODO (crédito), mas sem teto por minuto um treinador podia
    // disparar vários streams LLM de 120s em paralelo. Paridade com ⌘K/chat.
    const rl = await limitTurn(trainer.id)
    if (!rl.allowed) {
        return Response.json({ error: 'rate_limited', message: rl.error }, { status: 429 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (e: CanvasStreamEvent) =>
                controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
            try {
                const turn = await runCanvasTurn({
                    trainerId: trainer.id,
                    trainerName: trainer.name ?? '',
                    studentId: body.studentId,
                    studentName: student.name ?? '',
                    message: body.message,
                    history: Array.isArray(body.history) ? body.history.slice(-10) : [],
                    exercises: Array.isArray(body.exercises) ? body.exercises : [],
                    currentProgram: body.currentProgram ?? { sessions: [] },
                    onEvent: send,
                })
                // F4 — metering best-effort. O `done` já foi emitido pelo runCanvasTurn,
                // então isto NÃO bloqueia o usuário; falha aqui só loga (nunca derruba o
                // turno). Build (rendered) cobra como prescrição; turno sem render = 1.
                try {
                    const credits = turn.rendered ? CANVAS_BUILD_CREDITS : 1
                    const tokenUsage: TokenUsage = {
                        inputTokens: turn.usage.inputTokens,
                        outputTokens: turn.usage.outputTokens,
                    }
                    const costMicros = turnCostMicros(turn.model, tokenUsage)
                    await recordAiUsage(admin, {
                        trainerId: trainer.id,
                        periodType: period,
                        creditLimit: getQuotaForTier(tier)?.credits ?? null,
                        credits,
                        costMicros,
                        events: [{
                            actionClass: turn.rendered ? 'prescription' : 'query',
                            credits,
                            surface: 'canvas',
                            model: turn.model,
                            inputTokens: tokenUsage.inputTokens,
                            outputTokens: tokenUsage.outputTokens,
                            costMicros,
                        }],
                    })
                } catch (meterErr) {
                    console.error('[ai-canvas] metering error:', meterErr)
                }
            } catch (err) {
                send({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao gerar.' })
            } finally {
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    })
}

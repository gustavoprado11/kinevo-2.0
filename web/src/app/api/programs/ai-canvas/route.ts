// Endpoint do chat "Gerar com IA" ao vivo do builder (feature:
// docs/feature-ia-builder-chat.md). Stream NDJSON: progresso → program → done.
// Não persiste nada — o programa vai pro canvas do cliente; o save é no builder.
//
// Metering/quota: o GATE (tier Pro+ + cota) é aplicado; o REGISTRO de uso
// (recordAiUsage) fica pra F4 junto com o resto do acabamento.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gateAssistant } from '@/lib/assistant/command-engine'
import { runCanvasTurn } from '@/lib/programs/ai-canvas/run-canvas-turn'
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

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (e: CanvasStreamEvent) =>
                controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'))
            try {
                await runCanvasTurn({
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

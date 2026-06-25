/**
 * Conversa do Assistente — item (MOBILE, Bearer).
 *   GET   → conversa + mensagens (reabrir thread).
 *   PATCH → renomear ou arquivar.
 *   POST  → enviar um turno (input, STREAMING NDJSON) OU registrar o desfecho de
 *           uma confirmação HITL (JSON).
 *
 * O turno transmite {type:'progress'} a cada passo e {type:'done'} no fim — o app
 * consome via expo/fetch. Auth por Bearer; setup/segurança em mobile-turn.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assistantErrorResponse } from '@/lib/assistant/errors'
import {
    getConversationWithMessages,
    renameConversation,
    archiveConversation,
    assertOwnership,
    appendMessage,
    bumpConversation,
    markConfirmationResolved,
    type AssistantMessagePart,
} from '@/lib/assistant/conversations'
import { redactSensitive } from '@/lib/assistant/redact'
import { resolveTrainerBearer } from '@/lib/assistant/mobile-auth'
import { prepareMobileTurn, finishMobileTurn } from '@/lib/assistant/mobile-turn'

// Turno de CONSTRUÇÃO de programa pode passar de 60s; 300s evita timeout no meio.
export const maxDuration = 300

const NDJSON_HEADERS = {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
}

/** Emite um único evento {type:'done', ...} e fecha (re-envio idempotente, C4). */
function streamDoneResponse(done: Record<string, unknown>): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', ...done }) + '\n'))
            controller.close()
        },
    })
    return new Response(stream, { headers: NDJSON_HEADERS })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer
        const { id } = await ctx.params
        const data = await getConversationWithMessages(supabaseAdmin, trainer.id, id)
        if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
        return NextResponse.json(data)
    } catch (error) {
        return assistantErrorResponse('trainer/assistant conversation GET', error)
    }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer
        const { id } = await ctx.params
        const body = await req.json().catch(() => null)

        if (body?.archived === true) {
            await archiveConversation(supabaseAdmin, trainer.id, id)
            return NextResponse.json({ ok: true })
        }
        if (typeof body?.title === 'string' && body.title.trim().length > 0) {
            await renameConversation(supabaseAdmin, trainer.id, id, body.title)
            return NextResponse.json({ ok: true })
        }
        return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
    } catch (error) {
        return assistantErrorResponse('trainer/assistant conversation PATCH', error)
    }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer
        const { id } = await ctx.params
        const body = await req.json().catch(() => null)

        // ── Registrar o desfecho de uma confirmação HITL (append-only, JSON) ──
        // O cliente já executou via /api/trainer/assistant/execute-tool.
        const confirmation = body?.confirmation
        if (confirmation && typeof confirmation.toolName === 'string') {
            const conv = await assertOwnership(supabaseAdmin, trainer.id, id)
            if (!conv) return NextResponse.json({ error: 'not_found' }, { status: 404 })

            const confirmed = confirmation.status === 'confirmed'
            const safeResult = redactSensitive(confirmation.result ?? null) // S6

            await markConfirmationResolved(supabaseAdmin, {
                conversationId: id,
                trainerId: trainer.id,
                toolName: confirmation.toolName,
                status: confirmed ? 'confirmed' : 'cancelled',
                result: safeResult,
            })

            const parts: AssistantMessagePart[] = confirmed
                ? [{ type: 'executed', toolName: confirmation.toolName, result: safeResult }]
                : []
            const message = await appendMessage(supabaseAdmin, {
                conversationId: id,
                trainerId: trainer.id,
                role: 'assistant',
                content: confirmed ? '✓ Ação confirmada e executada.' : 'Ação cancelada.',
                parts,
            })
            await bumpConversation(supabaseAdmin, { conversationId: id })
            return NextResponse.json({ message })
        }

        // ── Turno normal (setup com erros HTTP, depois streaming) ──
        const prep = await prepareMobileTurn({
            trainerId: trainer.id,
            trainerName: trainer.name,
            conversationId: id,
            rawInput: body?.input,
            clientMessageId: body?.clientMessageId ?? null,
        })
        if (prep.kind === 'error') return NextResponse.json(prep.body, { status: prep.status })
        if (prep.kind === 'done') return streamDoneResponse(prep.body)

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
                try {
                    const done = await finishMobileTurn(prep.ctx, (label) => emit({ type: 'progress', label }))
                    emit({ type: 'done', ...done })
                } catch (err) {
                    console.error('[trainer/assistant conversation POST stream] error:', err)
                    emit({ type: 'error', message: 'Erro ao gerar a resposta.' })
                } finally {
                    controller.close()
                }
            },
        })
        return new Response(stream, { headers: NDJSON_HEADERS })
    } catch (error) {
        return assistantErrorResponse('trainer/assistant conversation POST', error)
    }
}

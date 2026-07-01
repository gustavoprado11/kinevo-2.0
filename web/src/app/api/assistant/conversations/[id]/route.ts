/**
 * Conversa do Assistente (aba dedicada) — item.
 *   GET   → conversa + mensagens (reabrir thread).
 *   PATCH → renomear ou arquivar.
 *   POST  → enviar um turno (input) OU registrar o desfecho de uma confirmação HITL.
 *
 * O turno usa o motor compartilhado (command-engine, surface 'workspace') com o
 * histórico da conversa, persistindo a mensagem do usuário e a do assistente
 * (com os "parts": ações executadas + card de confirmação pendente).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { gateAssistant, runAssistantTurn, UUID_RE } from '@/lib/assistant/command-engine'
import { limitTurn } from '@/lib/assistant/rate-limits'
import { assistantErrorResponse } from '@/lib/assistant/errors'
import {
    getConversationWithMessages,
    assertOwnership,
    appendMessage,
    findMessageByClientId,
    bumpConversation,
    renameConversation,
    archiveConversation,
    markConfirmationResolved,
    type AssistantMessage,
    type AssistantMessagePart,
} from '@/lib/assistant/conversations'
import { redactSensitive } from '@/lib/assistant/redact'
import { toModelHistory, deriveProgramFocus, stripInternalParts } from '@/lib/assistant/tool-memory'

// Turno de CONSTRUÇÃO de programa (Sonnet, vários passos) pode passar de 60s; 300s
// evita timeout/orphan no meio do build (auditoria C5). Rota gated (Assistente).
export const maxDuration = 300

const MAX_INPUT_CHARS = 2000

/** Emite um único evento NDJSON {type:'done', ...} e fecha (re-envio idempotente, C4). */
function streamDoneResponse(done: Record<string, unknown>): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', ...done }) + '\n'))
            controller.close()
        },
    })
    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
        },
    })
}

/** PostgREST unique-violation (corrida de idempotência do turno). */
function isUniqueViolation(e: unknown): boolean {
    return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'
}

async function resolveTrainer(): Promise<{ id: string; name: string | null } | NextResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    return { id: trainer.id, name: trainer.name }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const trainer = await resolveTrainer()
        if (trainer instanceof NextResponse) return trainer
        const { id } = await ctx.params
        const data = await getConversationWithMessages(supabaseAdmin, trainer.id, id)
        if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
        // Parts `context` são memória interna do modelo — nunca vão ao cliente.
        return NextResponse.json({ ...data, messages: data.messages.map(stripInternalParts) })
    } catch (error) {
        return assistantErrorResponse('conversation GET', error)
    }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const trainer = await resolveTrainer()
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
        return assistantErrorResponse('conversation PATCH', error)
    }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const trainer = await resolveTrainer()
        if (trainer instanceof NextResponse) return trainer
        const { id } = await ctx.params
        const body = await req.json().catch(() => null)

        // ── Registrar o desfecho de uma confirmação HITL (append-only) ──
        // O cliente já executou via /api/assistant/execute-tool (gate + metering lá).
        // Aqui só persistimos o resultado na conversa para reabrir mostrando o que foi feito.
        const confirmation = body?.confirmation
        if (confirmation && typeof confirmation.toolName === 'string') {
            const conv = await assertOwnership(supabaseAdmin, trainer.id, id)
            if (!conv) return NextResponse.json({ error: 'not_found' }, { status: 404 })

            const confirmed = confirmation.status === 'confirmed'

            // S6: redige credenciais/segredo do result ANTES de persistir no histórico
            // (a senha do convert_lead é mostrada uma vez ao treinador, nunca gravada).
            const safeResult = redactSensitive(confirmation.result ?? null)

            // B1: fecha a part `confirmation` original (pending → confirmed/cancelled)
            // para que ao reabrir a conversa o card NÃO volte clicável (re-execução).
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

        // ── Turno normal ──
        const rawInput: unknown = body?.input
        const input = typeof rawInput === 'string' ? rawInput.trim().slice(0, MAX_INPUT_CHARS) : ''
        if (input.length === 0) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 })

        const clientMessageId: string | null =
            typeof body?.clientMessageId === 'string' && UUID_RE.test(body.clientMessageId)
                ? body.clientMessageId
                : null

        // Rate-limit de turno (G6) — anti-amplificação de custo.
        const rl = await limitTurn(trainer.id)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'rate_limited', message: rl.error }, { status: 429 })
        }

        const gate = await gateAssistant(supabaseAdmin, trainer.id)
        if (!gate.allowed) {
            const { status, ...err } = gate
            return NextResponse.json(err, { status })
        }

        const existing = await getConversationWithMessages(supabaseAdmin, trainer.id, id)
        if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        // C4: idempotência do turno. Re-envio (mesma client_message_id) NÃO re-roda o
        // turno — devolve a resposta já gerada (anti rascunho/cobrança duplicados).
        if (clientMessageId) {
            const dupUser = await findMessageByClientId(supabaseAdmin, id, clientMessageId)
            if (dupUser) {
                const reply =
                    existing.messages.find(
                        (m) => m.role === 'assistant' && m.created_at >= dupUser.created_at,
                    ) ?? null
                return streamDoneResponse({
                    userMessage: dupUser,
                    message: reply ? stripInternalParts(reply) : null,
                    summary: null,
                })
            }
        }

        // Onda 2: histórico com memória de tools (blocos <<DADOS_DE_TOOLS>>) +
        // programa em foco derivado da própria conversa.
        const history = toModelHistory(existing.messages)
        const programFocus = deriveProgramFocus(existing.messages)
        const isFirstUserMessage = !existing.messages.some((m) => m.role === 'user')

        // Persiste a mensagem do usuário antes do turno (com a key de idempotência).
        let userMessage: AssistantMessage
        try {
            userMessage = await appendMessage(supabaseAdmin, {
                conversationId: id,
                trainerId: trainer.id,
                role: 'user',
                content: input,
                clientMessageId: clientMessageId ?? undefined,
            })
        } catch (e) {
            // Corrida: outra requisição idêntica inseriu primeiro (unique) → re-envio.
            if (clientMessageId && isUniqueViolation(e)) {
                const dupUser = await findMessageByClientId(supabaseAdmin, id, clientMessageId)
                if (dupUser) return streamDoneResponse({ userMessage: dupUser, message: null, summary: null })
            }
            throw e
        }

        // ── Streaming NDJSON ──
        // O setup (rate-limit, gate, mensagem do usuário) já rodou acima e devolve
        // erros HTTP normais. Aqui transmitimos: {type:'progress'} no início de
        // cada tool-call, {type:'text', delta} com os tokens da resposta
        // (U-STREAM), {type:'text_reset'} se o modelo de build caiu pro fallback,
        // e no fim {type:'done'} com a mensagem persistida.
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                // enqueue lança se o cliente desconectou no meio — nunca derruba o turno.
                const emit = (obj: unknown) => {
                    try {
                        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
                    } catch { /* cliente foi embora; o abortSignal cuida do resto */ }
                }
                try {
                    const turn = await runAssistantTurn({
                        admin: supabaseAdmin,
                        trainerId: trainer.id,
                        trainerName: trainer.name,
                        input,
                        surface: 'workspace',
                        periodType: gate.period,
                        tier: gate.tier,
                        history,
                        studentId: existing.conversation.student_id ?? undefined,
                        programFocus,
                        onProgress: (label) => emit({ type: 'progress', label }),
                        onTextDelta: (delta) => emit({ type: 'text', delta }),
                        onTextReset: () => emit({ type: 'text_reset' }),
                        // Stop real (U-STOP): Parar/desconectar aborta o LLM no servidor.
                        abortSignal: req.signal,
                    })

                    const parts: AssistantMessagePart[] = turn.executed.map((e) => ({
                        type: 'executed' as const, toolName: e.toolName, result: redactSensitive(e.result),
                    }))
                    if (turn.confirmation) parts.push({ type: 'confirmation', request: turn.confirmation, status: 'pending' })
                    if (turn.question) parts.push({ type: 'question', request: turn.question, status: 'pending' })
                    if (turn.proposal) parts.push({ type: 'proposal', request: turn.proposal, status: 'pending' })
                    // Memória do turno (Onda 2): interna — persiste, mas não vai ao cliente.
                    for (const m of turn.memory) parts.push({ type: 'context', toolName: m.toolName, digest: m.digest })

                    const assistantMessage = await appendMessage(supabaseAdmin, {
                        conversationId: id, trainerId: trainer.id, role: 'assistant',
                        content: turn.text, parts, creditsCost: turn.credits,
                    })
                    await bumpConversation(supabaseAdmin, {
                        conversationId: id,
                        firstUserMessage: isFirstUserMessage ? input : undefined,
                    })

                    emit({ type: 'done', userMessage, message: stripInternalParts(assistantMessage), summary: turn.summary })
                } catch (err) {
                    if ((err as Error)?.name === 'AbortError') {
                        // Stop real: o treinador interrompeu — o LLM parou no servidor,
                        // nada foi persistido/cobrado deste turno. A mensagem do usuário
                        // fica na thread (já persistida no setup).
                    } else {
                        console.error('[conversation POST stream] error:', err)
                        emit({ type: 'error', message: 'Erro ao gerar a resposta.' })
                    }
                } finally {
                    try { controller.close() } catch { /* já fechado/cancelado */ }
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/x-ndjson; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
            },
        })
    } catch (error) {
        return assistantErrorResponse('conversation POST', error)
    }
}

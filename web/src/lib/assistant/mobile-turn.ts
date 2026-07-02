/**
 * Turno de conversa do Assistente para o mobile — em duas fases para permitir
 * STREAMING de progresso:
 *
 *  - prepareMobileTurn(): setup que devolve erros HTTP normais (rate-limit, gate,
 *    not_found, idempotência). Persiste a mensagem do usuário. Roda ANTES do stream.
 *  - finishMobileTurn(): roda o turno de IA (runAssistantTurn com onProgress →
 *    eventos {progress}) + persiste a resposta. Roda DENTRO do stream.
 *
 * Reaproveita os mesmos primitivos do turno web (gate/idempotência C4/parts).
 * Mantido separado da rota web (streaming) que já funciona.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'
import { gateAssistant, runAssistantTurn, UUID_RE, type AssistantGate } from '@/lib/assistant/command-engine'
import { limitTurn } from '@/lib/assistant/rate-limits'
import {
    getConversationWithMessages,
    appendMessage,
    findMessageByClientId,
    bumpConversation,
    type AssistantMessage,
    type AssistantMessagePart,
} from '@/lib/assistant/conversations'
import { redactSensitive } from '@/lib/assistant/redact'
import {
    toModelHistory,
    deriveProgramFocus,
    stripInternalParts,
    type ProgramFocus,
} from '@/lib/assistant/tool-memory'

const MAX_INPUT_CHARS = 2000

type AllowedGate = Extract<AssistantGate, { allowed: true }>

/** PostgREST unique-violation (corrida de idempotência do turno). */
function isUniqueViolation(e: unknown): boolean {
    return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'
}

export interface MobileTurnContext {
    trainerId: string
    trainerName: string | null
    conversationId: string
    input: string
    gate: AllowedGate
    history: { role: 'user' | 'assistant'; content: string }[]
    studentId?: string
    /** Programa em foco (Onda 2), derivado da conversa. */
    programFocus?: ProgramFocus | null
    /** Onda 6: turno iniciado por voz — resposta curta/falável + surface 'voice'. */
    voice?: boolean
    userMessage: AssistantMessage
    isFirstUserMessage: boolean
}

export type PrepareResult =
    | { kind: 'error'; status: number; body: Record<string, unknown> }
    | { kind: 'done'; body: Record<string, unknown> } // re-envio idempotente (C4)
    | { kind: 'turn'; ctx: MobileTurnContext }

export async function prepareMobileTurn(args: {
    trainerId: string
    trainerName: string | null
    conversationId: string
    rawInput: unknown
    clientMessageId?: unknown
    voice?: boolean
}): Promise<PrepareResult> {
    const { trainerId, trainerName, conversationId } = args

    const input =
        typeof args.rawInput === 'string' ? args.rawInput.trim().slice(0, MAX_INPUT_CHARS) : ''
    if (input.length === 0) return { kind: 'error', status: 400, body: { error: 'Mensagem vazia.' } }

    const clientMessageId =
        typeof args.clientMessageId === 'string' && UUID_RE.test(args.clientMessageId)
            ? args.clientMessageId
            : null

    const rl = await limitTurn(trainerId)
    if (!rl.allowed) return { kind: 'error', status: 429, body: { error: 'rate_limited', message: rl.error } }

    const gate = await gateAssistant(supabaseAdmin, trainerId)
    if (!gate.allowed) {
        const { status, ...err } = gate
        return { kind: 'error', status, body: err }
    }

    const existing = await getConversationWithMessages(supabaseAdmin, trainerId, conversationId)
    if (!existing) return { kind: 'error', status: 404, body: { error: 'not_found' } }

    // C4: re-envio (mesma client_message_id) → devolve a resposta já gerada.
    if (clientMessageId) {
        const dupUser = await findMessageByClientId(supabaseAdmin, conversationId, clientMessageId)
        if (dupUser) {
            const reply =
                existing.messages.find(
                    (m) => m.role === 'assistant' && m.created_at >= dupUser.created_at,
                ) ?? null
            return {
                kind: 'done',
                body: { userMessage: dupUser, message: reply ? stripInternalParts(reply) : null, summary: null },
            }
        }
    }

    // Onda 2: histórico com memória de tools (<<DADOS_DE_TOOLS>>) + programa em foco.
    const history = toModelHistory(existing.messages)
    const programFocus = deriveProgramFocus(existing.messages)
    const isFirstUserMessage = !existing.messages.some((m) => m.role === 'user')

    let userMessage: AssistantMessage
    try {
        userMessage = await appendMessage(supabaseAdmin, {
            conversationId,
            trainerId,
            role: 'user',
            content: input,
            clientMessageId: clientMessageId ?? undefined,
        })
    } catch (e) {
        if (clientMessageId && isUniqueViolation(e)) {
            const dupUser = await findMessageByClientId(supabaseAdmin, conversationId, clientMessageId)
            if (dupUser) return { kind: 'done', body: { userMessage: dupUser, message: null, summary: null } }
        }
        throw e
    }

    return {
        kind: 'turn',
        ctx: {
            trainerId,
            trainerName,
            conversationId,
            input,
            gate,
            history,
            studentId: existing.conversation.student_id ?? undefined,
            programFocus,
            voice: args.voice === true,
            userMessage,
            isFirstUserMessage,
        },
    }
}

export interface MobileTurnHooks {
    onProgress?: (label: string) => void
    /** Streaming de token (U-STREAM): delta de texto da resposta. */
    onTextDelta?: (delta: string) => void
    /** Fallback de modelo de build: o cliente descarta o texto parcial. */
    onTextReset?: () => void
    /** Stop real (U-STOP): abortar cancela o LLM no servidor. */
    abortSignal?: AbortSignal
}

/** Roda o turno de IA (emitindo progresso + tokens) e persiste a resposta. Devolve o `done`. */
export async function finishMobileTurn(
    ctx: MobileTurnContext,
    hooks?: MobileTurnHooks,
): Promise<Record<string, unknown>> {
    const turn = await runAssistantTurn({
        admin: supabaseAdmin,
        trainerId: ctx.trainerId,
        trainerName: ctx.trainerName,
        input: ctx.input,
        surface: ctx.voice === true ? 'voice' : 'mobile',
        periodType: ctx.gate.period,
        tier: ctx.gate.tier,
        history: ctx.history,
        studentId: ctx.studentId,
        programFocus: ctx.programFocus,
        onProgress: hooks?.onProgress,
        onTextDelta: hooks?.onTextDelta,
        onTextReset: hooks?.onTextReset,
        abortSignal: hooks?.abortSignal,
    })

    const parts: AssistantMessagePart[] = turn.executed.map((e) => ({
        type: 'executed' as const,
        toolName: e.toolName,
        result: redactSensitive(e.result),
    }))
    if (turn.confirmation) parts.push({ type: 'confirmation', request: turn.confirmation, status: 'pending' })
    if (turn.question) parts.push({ type: 'question', request: turn.question, status: 'pending' })
    if (turn.proposal) parts.push({ type: 'proposal', request: turn.proposal, status: 'pending' })
    // Memória do turno (Onda 2): interna — persiste, mas não vai ao cliente.
    for (const m of turn.memory) parts.push({ type: 'context', toolName: m.toolName, digest: m.digest })

    const assistantMessage = await appendMessage(supabaseAdmin, {
        conversationId: ctx.conversationId,
        trainerId: ctx.trainerId,
        role: 'assistant',
        content: turn.text,
        parts,
        creditsCost: turn.credits,
    })
    await bumpConversation(supabaseAdmin, {
        conversationId: ctx.conversationId,
        firstUserMessage: ctx.isFirstUserMessage ? ctx.input : undefined,
    })

    return { userMessage: ctx.userMessage, message: stripInternalParts(assistantMessage), summary: turn.summary }
}

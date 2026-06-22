/**
 * Camada de dados das conversas do Assistente (aba dedicada /assistente).
 *
 * Tabelas: ai_conversations + ai_messages (migration 209). Toda escrita acontece
 * via service role (RLS é select-only). As leituras filtram explicitamente por
 * trainer_id (defesa em profundidade mesmo usando admin client).
 *
 * Tipos locais: as tabelas 209 ainda não estão no database.ts gerado — para não
 * arriscar truncar os tipos (gotcha do gen:types) usamos um client destipado
 * neste módulo isolado, com interfaces explícitas no retorno.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ToolConfirmationRequest, QuestionRequest, ProposalRequest } from '@/lib/assistant/hitl-types'

export type AssistantMessageRole = 'user' | 'assistant'

/** Bloco rico de uma mensagem do assistente (reabre mostrando o que a IA fez). */
export type AssistantMessagePart =
    | { type: 'executed'; toolName: string; result: unknown }
    | {
          type: 'confirmation'
          request: ToolConfirmationRequest
          status: 'pending' | 'confirmed' | 'cancelled'
          result?: unknown
      }
    | {
          // Pergunta estruturada ao treinador (opções clicáveis). `answered` apenas
          // marca visualmente que já foi respondida (a resposta vira um turno normal).
          type: 'question'
          request: QuestionRequest
          status: 'pending' | 'answered'
      }
    | {
          // Proposta editável (Aprovar/Ajustar/Cancelar) — ex.: estrutura de programa.
          type: 'proposal'
          request: ProposalRequest
          status: 'pending' | 'answered'
      }

export interface ConversationRow {
    id: string
    student_id: string | null
    title: string
    last_message_at: string
    message_count: number
    archived_at: string | null
    created_at: string
}

export interface ConversationListItem extends ConversationRow {
    studentName: string | null
}

export interface AssistantMessage {
    id: string
    role: AssistantMessageRole
    content: string
    parts: AssistantMessagePart[]
    credits_cost: number
    created_at: string
}

const CONVERSATION_COLS = 'id, student_id, title, last_message_at, message_count, archived_at, created_at'
const MESSAGE_COLS = 'id, role, content, parts, credits_cost, created_at'
const TITLE_MAX = 70

function deriveTitle(input: string): string {
    const clean = input.trim().replace(/\s+/g, ' ')
    if (clean.length <= TITLE_MAX) return clean || 'Nova conversa'
    return clean.slice(0, TITLE_MAX).trimEnd() + '…'
}

/** Threads ativas do treinador, mais recentes primeiro, com o nome do aluno. */
export async function listConversations(
    sb: SupabaseClient,
    trainerId: string,
): Promise<ConversationListItem[]> {
    const { data, error } = await sb
        .from('ai_conversations')
        .select(`${CONVERSATION_COLS}, students:student_id(name)`)
        .eq('trainer_id', trainerId)
        .is('archived_at', null)
        .order('last_message_at', { ascending: false })
        .limit(100)
    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => {
        const student = row.students as { name?: string } | null
        return {
            id: row.id as string,
            student_id: (row.student_id as string | null) ?? null,
            title: row.title as string,
            last_message_at: row.last_message_at as string,
            message_count: row.message_count as number,
            archived_at: (row.archived_at as string | null) ?? null,
            created_at: row.created_at as string,
            studentName: student?.name ?? null,
        }
    })
}

/** Cria uma thread. studentId nulo = conversa "Geral". */
export async function createConversation(
    sb: SupabaseClient,
    trainerId: string,
    opts: { studentId?: string | null; title?: string } = {},
): Promise<ConversationRow> {
    const insert: Record<string, unknown> = { trainer_id: trainerId }
    if (opts.studentId) insert.student_id = opts.studentId
    if (opts.title) insert.title = deriveTitle(opts.title)
    const { data, error } = await sb
        .from('ai_conversations')
        .insert(insert)
        .select(CONVERSATION_COLS)
        .single()
    if (error) throw error
    return data as ConversationRow
}

/** Carrega a conversa + mensagens, validando posse pelo trainer_id. */
export async function getConversationWithMessages(
    sb: SupabaseClient,
    trainerId: string,
    conversationId: string,
): Promise<{ conversation: ConversationListItem; messages: AssistantMessage[] } | null> {
    const { data: conv, error } = await sb
        .from('ai_conversations')
        .select(`${CONVERSATION_COLS}, students:student_id(name)`)
        .eq('id', conversationId)
        .eq('trainer_id', trainerId)
        .maybeSingle()
    if (error) throw error
    if (!conv) return null

    const { data: msgs, error: msgErr } = await sb
        .from('ai_messages')
        .select(MESSAGE_COLS)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
    if (msgErr) throw msgErr

    const student = (conv as Record<string, unknown>).students as { name?: string } | null
    const conversation: ConversationListItem = {
        id: conv.id,
        student_id: conv.student_id ?? null,
        title: conv.title,
        last_message_at: conv.last_message_at,
        message_count: conv.message_count,
        archived_at: conv.archived_at ?? null,
        created_at: conv.created_at,
        studentName: student?.name ?? null,
    }
    const messages: AssistantMessage[] = (msgs ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as AssistantMessageRole,
        content: (m.content as string) ?? '',
        parts: Array.isArray(m.parts) ? (m.parts as AssistantMessagePart[]) : [],
        credits_cost: (m.credits_cost as number) ?? 0,
        created_at: m.created_at as string,
    }))
    return { conversation, messages }
}

/** Confirma que a conversa pertence ao treinador (gate barato p/ o turno). */
export async function assertOwnership(
    sb: SupabaseClient,
    trainerId: string,
    conversationId: string,
): Promise<ConversationRow | null> {
    const { data, error } = await sb
        .from('ai_conversations')
        .select(CONVERSATION_COLS)
        .eq('id', conversationId)
        .eq('trainer_id', trainerId)
        .maybeSingle()
    if (error) throw error
    return (data as ConversationRow) ?? null
}

export async function appendMessage(
    sb: SupabaseClient,
    args: {
        conversationId: string
        trainerId: string
        role: AssistantMessageRole
        content: string
        parts?: AssistantMessagePart[]
        creditsCost?: number
        /** Idempotência do turno (C4) — só na mensagem do usuário. */
        clientMessageId?: string
    },
): Promise<AssistantMessage> {
    const row: Record<string, unknown> = {
        conversation_id: args.conversationId,
        trainer_id: args.trainerId,
        role: args.role,
        content: args.content,
        parts: args.parts ?? [],
        credits_cost: args.creditsCost ?? 0,
    }
    if (args.clientMessageId) row.client_message_id = args.clientMessageId

    const { data, error } = await sb
        .from('ai_messages')
        .insert(row)
        .select(MESSAGE_COLS)
        .single()
    if (error) throw error
    const m = data as Record<string, unknown>
    return {
        id: m.id as string,
        role: m.role as AssistantMessageRole,
        content: (m.content as string) ?? '',
        parts: Array.isArray(m.parts) ? (m.parts as AssistantMessagePart[]) : [],
        credits_cost: (m.credits_cost as number) ?? 0,
        created_at: m.created_at as string,
    }
}

/**
 * Busca a mensagem do usuário por client_message_id (idempotência do turno, C4).
 * Retorna null se não houver — o turno segue normal. Se houver, é um RE-ENVIO.
 */
export async function findMessageByClientId(
    sb: SupabaseClient,
    conversationId: string,
    clientMessageId: string,
): Promise<AssistantMessage | null> {
    const { data, error } = await sb
        .from('ai_messages')
        .select(MESSAGE_COLS)
        .eq('conversation_id', conversationId)
        .eq('client_message_id', clientMessageId)
        .maybeSingle()
    if (error) throw error
    if (!data) return null
    const m = data as Record<string, unknown>
    return {
        id: m.id as string,
        role: m.role as AssistantMessageRole,
        content: (m.content as string) ?? '',
        parts: Array.isArray(m.parts) ? (m.parts as AssistantMessagePart[]) : [],
        credits_cost: (m.credits_cost as number) ?? 0,
        created_at: m.created_at as string,
    }
}

/**
 * Atualiza last_message_at + message_count após um turno. Se a conversa ainda
 * tem o título padrão, deriva o título da primeira mensagem do usuário.
 */
export async function bumpConversation(
    sb: SupabaseClient,
    args: { conversationId: string; firstUserMessage?: string },
): Promise<void> {
    const { count } = await sb
        .from('ai_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', args.conversationId)

    const update: Record<string, unknown> = {
        last_message_at: new Date().toISOString(),
        message_count: count ?? 0,
    }
    if (args.firstUserMessage) {
        const { data: conv } = await sb
            .from('ai_conversations')
            .select('title')
            .eq('id', args.conversationId)
            .maybeSingle()
        if (conv?.title === 'Nova conversa') {
            update.title = deriveTitle(args.firstUserMessage)
        }
    }
    await sb.from('ai_conversations').update(update).eq('id', args.conversationId)
}

/**
 * Marca o desfecho de uma confirmação HITL na mensagem ORIGINAL: encontra a part
 * `confirmation` ainda `pending` desse toolName (a mais recente) e a regrava com
 * status `confirmed`/`cancelled`. Sem isso, ao reabrir a conversa o card volta a
 * `pending` e fica clicável → permite re-executar uma ação sensível (B1).
 */
export async function markConfirmationResolved(
    sb: SupabaseClient,
    args: {
        conversationId: string
        trainerId: string
        toolName: string
        status: 'confirmed' | 'cancelled'
        result?: unknown
    },
): Promise<boolean> {
    const { data: rows, error } = await sb
        .from('ai_messages')
        .select('id, parts')
        .eq('conversation_id', args.conversationId)
        .eq('trainer_id', args.trainerId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(20)
    if (error) throw error

    for (const row of (rows ?? []) as Array<{ id: string; parts: unknown }>) {
        const parts = Array.isArray(row.parts) ? (row.parts as AssistantMessagePart[]) : []
        const idx = parts.findIndex(
            (p) => p.type === 'confirmation' && p.status === 'pending' && p.request?.toolName === args.toolName,
        )
        if (idx < 0) continue

        const nextParts = parts.map((p, i) =>
            i === idx && p.type === 'confirmation'
                ? { ...p, status: args.status, result: args.result ?? p.result }
                : p,
        )
        const { error: upErr } = await sb
            .from('ai_messages')
            .update({ parts: nextParts })
            .eq('id', row.id)
            .eq('trainer_id', args.trainerId)
        if (upErr) throw upErr
        return true
    }
    return false
}

export async function renameConversation(
    sb: SupabaseClient,
    trainerId: string,
    conversationId: string,
    title: string,
): Promise<void> {
    await sb
        .from('ai_conversations')
        .update({ title: deriveTitle(title) })
        .eq('id', conversationId)
        .eq('trainer_id', trainerId)
}

export async function archiveConversation(
    sb: SupabaseClient,
    trainerId: string,
    conversationId: string,
): Promise<void> {
    await sb
        .from('ai_conversations')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('trainer_id', trainerId)
}

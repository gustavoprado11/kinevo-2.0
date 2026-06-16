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
import { gateAssistant, runAssistantTurn } from '@/lib/assistant/command-engine'
import {
    getConversationWithMessages,
    assertOwnership,
    appendMessage,
    bumpConversation,
    renameConversation,
    archiveConversation,
    type AssistantMessagePart,
} from '@/lib/assistant/conversations'

export const maxDuration = 60

const MAX_INPUT_CHARS = 2000

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
        return NextResponse.json(data)
    } catch (error) {
        console.error('[conversation GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
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
        console.error('[conversation PATCH] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
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
            const parts: AssistantMessagePart[] = confirmed
                ? [{ type: 'executed', toolName: confirmation.toolName, result: confirmation.result ?? null }]
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

        const gate = await gateAssistant(supabaseAdmin, trainer.id)
        if (!gate.allowed) {
            const { status, ...err } = gate
            return NextResponse.json(err, { status })
        }

        const existing = await getConversationWithMessages(supabaseAdmin, trainer.id, id)
        if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        const history = existing.messages.map((m) => ({ role: m.role, content: m.content }))
        const isFirstUserMessage = !existing.messages.some((m) => m.role === 'user')

        // Persiste a mensagem do usuário antes do turno.
        const userMessage = await appendMessage(supabaseAdmin, {
            conversationId: id,
            trainerId: trainer.id,
            role: 'user',
            content: input,
        })

        const turn = await runAssistantTurn({
            admin: supabaseAdmin,
            trainerId: trainer.id,
            trainerName: trainer.name,
            input,
            surface: 'workspace',
            periodType: gate.period,
            history,
            studentId: existing.conversation.student_id ?? undefined,
        })

        // Monta os parts da resposta (ações executadas + confirmação pendente).
        const parts: AssistantMessagePart[] = turn.executed.map((e) => ({
            type: 'executed' as const,
            toolName: e.toolName,
            result: e.result,
        }))
        if (turn.confirmation) {
            parts.push({ type: 'confirmation', request: turn.confirmation, status: 'pending' })
        }

        const assistantMessage = await appendMessage(supabaseAdmin, {
            conversationId: id,
            trainerId: trainer.id,
            role: 'assistant',
            content: turn.text,
            parts,
            creditsCost: turn.credits,
        })

        await bumpConversation(supabaseAdmin, {
            conversationId: id,
            firstUserMessage: isFirstUserMessage ? input : undefined,
        })

        return NextResponse.json({
            userMessage,
            message: assistantMessage,
            confirmation: turn.confirmation,
            summary: turn.summary,
        })
    } catch (error) {
        console.error('[conversation POST] error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 },
        )
    }
}

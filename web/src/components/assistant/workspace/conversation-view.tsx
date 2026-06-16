'use client'

/**
 * ConversationView — o chat de uma conversa (Assistente). Header de contexto +
 * stream de mensagens (com ações executadas e cards HITL) + composer.
 * Apresentacional: estado e handlers vêm do AssistantShell.
 */

import { useEffect, useRef } from 'react'
import { Sparkles, Check, Send, Loader2, ArrowLeft } from 'lucide-react'
import { CreditMeter } from '@/components/assistant/credit-meter'
import { ToolConfirmationCard } from '@/components/assistant/tool-confirmation-card'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type {
    ConversationListItem,
    AssistantMessage,
    AssistantMessagePart,
} from '@/lib/assistant/conversations'
import { avatarFor } from './ui-util'

const EXECUTED_LABEL: Record<string, string> = {
    generateProgram: 'Programa gerado (rascunho)',
    kinevo_assign_program: 'Programa atribuído',
    kinevo_send_message: 'Mensagem enviada',
    kinevo_create_appointment: 'Sessão agendada',
    kinevo_update_student: 'Aluno atualizado',
}
function executedText(part: Extract<AssistantMessagePart, { type: 'executed' }>): string {
    const r = part.result as { message?: string; error?: string; success?: boolean } | null
    if (r && typeof r === 'object') {
        if (r.success === false && r.error) return r.error
        if (r.message) return r.message
    }
    return EXECUTED_LABEL[part.toolName] ?? 'Ação executada'
}

interface Props {
    active: ConversationListItem
    summary: AiUsageSummary
    messages: AssistantMessage[]
    loadingMessages: boolean
    sending: boolean
    input: string
    trainerName: string | null
    onInput: (v: string) => void
    onSend: () => void
    onBackHome: () => void
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
}

export function ConversationView({
    active, summary, messages, loadingMessages, sending, input, trainerName,
    onInput, onSend, onBackHome, onConfirmResolved,
}: Props) {
    const streamRef = useRef<HTMLDivElement>(null)
    const trainerAv = avatarFor(trainerName)
    const av = avatarFor(active.studentName)

    useEffect(() => {
        if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight
    }, [messages, sending])

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-[#F5F5F7]">
            <header className="flex items-center gap-3.5 border-b border-[#E8E8ED] bg-white/70 px-6 py-3.5 backdrop-blur">
                <button onClick={onBackHome} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E8E8ED] bg-white text-[#6E6E73] transition hover:text-[#1D1D1F]" title="Voltar ao início">
                    <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
                <div className="flex items-center gap-2.5 rounded-[12px] border border-[#D2D2D7] bg-white px-3 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[12px] font-bold text-white"
                        style={{ background: active.student_id ? av.bg : 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                        {active.student_id ? av.initials : <Sparkles className="h-4 w-4" strokeWidth={2} />}
                    </span>
                    <div>
                        <b className="block text-[13.5px] tracking-tight">{active.studentName ?? 'Geral · visão geral dos alunos'}</b>
                        <span className="text-[10.5px] text-[#86868B]">{active.student_id ? 'Conversa sobre o aluno' : 'Todos os alunos'}</span>
                    </div>
                </div>
                <div className="flex-1" />
                <div className="hidden w-[260px] sm:block"><CreditMeter summary={summary} compact /></div>
            </header>

            <div ref={streamRef} className="flex-1 overflow-y-auto py-7">
                <div className="mx-auto max-w-[768px] px-7">
                    {loadingMessages && (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#AEAEB2]" /></div>
                    )}
                    {messages.map((m) => (
                        <MessageRow key={m.id} message={m} trainerAv={trainerAv} onConfirmResolved={onConfirmResolved} />
                    ))}
                    {sending && <TypingRow />}
                </div>
            </div>

            <div className="border-t border-[#E8E8ED] bg-white/80 py-3.5 backdrop-blur">
                <div className="mx-auto max-w-[768px] px-7">
                    <div className="flex items-center gap-2.5 rounded-[15px] border border-[#D2D2D7] bg-white px-2 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition focus-within:border-[#7C3AED] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]">
                        <input
                            value={input}
                            onChange={(e) => onInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                            disabled={sending}
                            placeholder={active.studentName ? `Diga o que fazer com ${active.studentName.split(' ')[0]}…` : 'Diga o que fazer no Kinevo…'}
                            className="flex-1 bg-transparent px-2 py-2 text-[14.5px] outline-none placeholder:text-[#AEAEB2]"
                        />
                        <button onClick={onSend} disabled={sending || !input.trim()}
                            className="flex h-[38px] items-center gap-2 rounded-[11px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-[18px] text-[13.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] transition hover:brightness-105 disabled:opacity-50">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2} />} Agir
                        </button>
                    </div>
                    <div className="mt-2.5 flex justify-center gap-5 text-[10.5px] text-[#AEAEB2]">
                        <span><kbd className="rounded border border-[#E8E8ED] bg-white px-1.5 font-mono text-[#86868B]">Enter</kbd> enviar</span>
                        <span>ações sensíveis sempre pedem confirmação</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function MessageRow({ message, trainerAv, onConfirmResolved }: {
    message: AssistantMessage
    trainerAv: { initials: string; bg: string }
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
}) {
    const isUser = message.role === 'user'
    return (
        <div className="mb-6 flex gap-3.5">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold text-white"
                style={{ background: isUser ? trainerAv.bg : 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                {isUser ? trainerAv.initials : <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.8} />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
                <div className="mb-1.5 text-[11.5px] font-bold tracking-wide" style={{ color: isUser ? '#007AFF' : '#7C3AED' }}>
                    {isUser ? 'Você' : 'Assistente Kinevo'}
                </div>
                {message.content && (
                    isUser ? (
                        <div className="inline-block rounded-[14px] rounded-tl-[5px] border border-[#E8E8ED] bg-white px-4 py-3 text-[14.5px] leading-relaxed shadow-[0_1px_3px_rgba(0,0,0,0.06)]">{message.content}</div>
                    ) : (
                        <div className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-[#1D1D1F]">{message.content}</div>
                    )
                )}
                {message.parts.map((part, i) => (
                    <PartView key={i} part={part} onConfirmResolved={onConfirmResolved} />
                ))}
            </div>
        </div>
    )
}

function PartView({ part, onConfirmResolved }: {
    part: AssistantMessagePart
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
}) {
    if (part.type === 'executed') {
        const r = part.result as { success?: boolean } | null
        const failed = r && typeof r === 'object' && r.success === false
        return (
            <div className={`mt-3 inline-flex items-center gap-2.5 rounded-[12px] border px-3.5 py-2.5 text-[12.5px] ${failed ? 'border-[rgba(255,59,48,0.28)] bg-[rgba(255,59,48,0.07)] text-[#B91C1C]' : 'border-[rgba(52,199,89,0.28)] bg-[rgba(52,199,89,0.09)] text-[#1c7a3e]'}`}>
                {!failed && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34C759]"><Check className="h-3 w-3 text-white" strokeWidth={3} /></span>
                )}
                <span className="font-semibold">{executedText(part)}</span>
            </div>
        )
    }
    if (part.status === 'pending') {
        return (
            <div className="mt-3.5">
                <ToolConfirmationCard request={part.request} surface="workspace"
                    onResolved={(result, toolResult) => onConfirmResolved(part.request.toolName, result.confirmed, toolResult)} />
            </div>
        )
    }
    return (
        <div className="mt-3 inline-flex items-center gap-2 rounded-[12px] border border-[#E8E8ED] bg-[#F9F9FB] px-3.5 py-2 text-[12px] text-[#86868B]">
            {part.status === 'confirmed' ? 'Ação confirmada' : 'Ação cancelada'}
        </div>
    )
}

function TypingRow() {
    return (
        <div className="mb-6 flex gap-3.5">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-white" style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </span>
            <div className="flex items-center gap-1.5 pt-2">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A78BFA] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A78BFA] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A78BFA] [animation-delay:300ms]" />
            </div>
        </div>
    )
}

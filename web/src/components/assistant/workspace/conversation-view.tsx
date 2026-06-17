'use client'

/**
 * ConversationView — o chat de uma conversa (Assistente).
 *
 * Estética estilo Claude: superfície branca full-bleed, sem avatares nem molduras.
 * Mensagem do usuário = balão cinza à direita; resposta da IA = texto corrido à
 * esquerda. Header e composer minimalistas. A marca Kinevo aparece só em pontos
 * (ícone de contexto + botão "Agir").
 *
 * Duas adições de UX (handoff design_handoff_conversa):
 *  C. Seleção rápida de aluno — quando o assistente pede um aluno p/ prosseguir,
 *     renderiza chips clicáveis em vez de exigir digitação livre.
 *  D. Chips de sugestão acima do composer — atalhos contextuais ao escopo.
 *
 * Apresentacional: estado e handlers vêm do AssistantWorkspace.
 */

import { useEffect, useRef } from 'react'
import { Sparkles, Check, Send, Loader2, ArrowLeft, Pencil, Search } from 'lucide-react'
import { CreditMeter } from '@/components/assistant/credit-meter'
import { ToolConfirmationCard } from '@/components/assistant/tool-confirmation-card'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type {
    ConversationListItem,
    AssistantMessage,
    AssistantMessagePart,
} from '@/lib/assistant/conversations'
import { avatarFor } from './ui-util'
import { executedText } from '@/lib/assistant/tool-labels'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { MicButton } from './mic-button'

interface PickStudent { id: string; name: string }

interface Props {
    active: ConversationListItem
    summary: AiUsageSummary
    messages: AssistantMessage[]
    loadingMessages: boolean
    sending: boolean
    input: string
    trainerName: string | null
    students: PickStudent[]
    banner: AssistantBannerData | null
    onDismissBanner: () => void
    onInput: (v: string) => void
    onSend: () => void
    onSendText: (text: string) => void
    onBackHome: () => void
    onRename: () => void
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
}

// Quantos chips de aluno mostrar antes do "Buscar outro…".
const PICKER_LIMIT = 5
// Acima desse nº de mensagens a conversa já "tem corpo" → some com as sugestões.
const SUGGESTIONS_MAX_MESSAGES = 6

/** A última msg do assistente está pedindo um aluno p/ prosseguir? */
const STUDENT_REQUEST = /\b(qual|que)\s+aluno|para qual aluno|escolh\w+\s+(o |um |abaixo|aluno)|selecion\w+\s+(o |um )?aluno|informe\s+o\s+(nome\s+do\s+)?aluno|quem\s+é\s+o\s+aluno|digite\s+o\s+nome/i

function suggestionsFor(active: ConversationListItem): string[] {
    if (active.student_id && active.studentName) {
        const first = active.studentName.split(' ')[0]
        return [`Como está a evolução de ${first}?`, `Gerar um treino para ${first}`, `Enviar uma mensagem para ${first}`]
    }
    return ['Alunos sem treino ativo', 'Quem está estagnado?', 'Resumo de adesão da semana']
}

export function ConversationView({
    active, summary, messages, loadingMessages, sending, input, students, banner,
    onDismissBanner, onInput, onSend, onSendText, onBackHome, onRename, onConfirmResolved,
}: Props) {
    const streamRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const av = avatarFor(active.studentName)

    useEffect(() => {
        if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight
    }, [messages, sending])

    // Composer cresce com o conteúdo (até ~200px; depois rola internamente).
    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }, [input])

    // ── Seleção rápida de aluno (C) ──
    const last = messages[messages.length - 1]
    const lastHasPending = last?.parts.some((p) => p.type === 'confirmation' && p.status === 'pending') ?? false
    const needsStudent =
        !sending && !active.student_id && students.length > 0 &&
        last?.role === 'assistant' && !lastHasPending && STUDENT_REQUEST.test(last.content)

    const showSuggestions = !loadingMessages && messages.length <= SUGGESTIONS_MAX_MESSAGES
    const suggestions = suggestionsFor(active)

    return (
        // Superfície branca full-bleed (ponta a ponta) — flat, sem moldura, estilo Claude.
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-surface-card">
            <header className="flex shrink-0 items-center gap-1.5 border-b border-[#EDEDF0] dark:border-k-border-subtle px-4 py-2.5">
                <button onClick={onBackHome} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#86868B] dark:text-muted-foreground transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#1D1D1F] dark:hover:text-foreground" title="Voltar ao início">
                    <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </button>
                <div className="flex min-w-0 items-center gap-2.5 pl-1">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11.5px] font-bold"
                        style={active.student_id ? { background: av.bg, color: av.fg } : { background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' }}>
                        {active.student_id ? av.initials : <Sparkles className="h-4 w-4 text-white" strokeWidth={1.7} />}
                    </span>
                    <div className="min-w-0 leading-tight">
                        <b className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F] dark:text-foreground">{active.studentName ?? 'Geral · visão geral dos alunos'}</b>
                        <span className="block truncate text-[11px] text-[#86868B] dark:text-muted-foreground">{active.student_id ? 'Conversa sobre o aluno' : 'Todos os alunos'}</span>
                    </div>
                </div>
                <div className="flex-1" />
                <button onClick={onRename} className="hidden h-9 w-9 items-center justify-center rounded-[10px] text-[#86868B] dark:text-muted-foreground transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#1D1D1F] dark:hover:text-foreground sm:flex" title="Renomear conversa">
                    <Pencil className="h-[16px] w-[16px]" strokeWidth={1.8} />
                </button>
                <div className="hidden lg:block"><CreditMeter summary={summary} pill /></div>
            </header>

            <div ref={streamRef} className="min-h-0 flex-1 overflow-y-auto py-9" aria-live="polite" aria-busy={sending}>
                <div className="mx-auto max-w-[760px] px-6">
                    {loadingMessages && (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#AEAEB2] dark:text-muted-foreground/60" /></div>
                    )}
                    {messages.map((m) => (
                        <MessageRow key={m.id} message={m} onConfirmResolved={onConfirmResolved} />
                    ))}
                    {needsStudent && (
                        <StudentPicker students={students} onPick={(name) => onSendText(name)} onSearchOther={() => inputRef.current?.focus()} />
                    )}
                    {sending && <TypingRow />}
                </div>
            </div>

            <div className="shrink-0 pb-4 pt-1">
                <div className="mx-auto max-w-[760px] px-6">
                    {banner && (
                        <div className="mb-2.5">
                            <AssistantBanner data={banner} onDismiss={onDismissBanner} />
                        </div>
                    )}
                    {showSuggestions && !banner && (
                        <div className="mb-2.5 flex flex-wrap items-center gap-2">
                            {suggestions.map((s) => (
                                <button key={s} onClick={() => onSendText(s)} disabled={sending}
                                    className="inline-flex items-center rounded-full border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-elevated px-3 py-1.5 text-[12.5px] font-medium text-[#6E6E73] dark:text-muted-foreground/80 transition hover:border-[#D2D2D7] dark:hover:border-k-border-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg hover:text-[#1D1D1F] dark:hover:text-foreground disabled:opacity-50">
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-end gap-2 rounded-[22px] border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-elevated px-2.5 py-2 transition focus-within:border-[#C7C7CC] dark:focus-within:border-k-border-primary focus-within:shadow-[0_0_0_3px_rgba(60,60,67,0.07)]">
                        <MicButton disabled={sending} onTranscript={(t) => onInput(input ? `${input} ${t}` : t)} />
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => onInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                            disabled={sending}
                            rows={1}
                            aria-label={active.studentName ? `Mensagem para o assistente sobre ${active.studentName}` : 'Mensagem para o assistente'}
                            placeholder={active.studentName ? `Diga o que fazer com ${active.studentName.split(' ')[0]}…` : 'Diga o que fazer no Kinevo…'}
                            // outline inline: vence a regra global unlayered `:focus-visible`; foco fica na borda do card.
                            style={{ outline: 'none' }}
                            className="max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-2 text-[15px] leading-[1.5] text-[#1D1D1F] dark:text-foreground placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/60"
                        />
                        <button onClick={onSend} disabled={sending || !input.trim()}
                            className="flex h-[36px] items-center gap-1.5 rounded-[14px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 text-[13px] font-bold text-white transition hover:brightness-105 disabled:opacity-40">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-[15px] w-[15px]" strokeWidth={2} />} Agir
                        </button>
                    </div>
                    <div className="mt-2 flex justify-center gap-4 text-[10.5px] text-[#AEAEB2] dark:text-muted-foreground/60">
                        <span><kbd className="rounded border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-1.5 font-mono text-[#86868B] dark:text-muted-foreground">Enter</kbd> enviar</span>
                        <span>ações sensíveis sempre pedem confirmação</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

/** Chips de aluno (C): escolha rápida em vez de digitar o nome. */
function StudentPicker({ students, onPick, onSearchOther }: {
    students: PickStudent[]
    onPick: (name: string) => void
    onSearchOther: () => void
}) {
    return (
        <div className="kv-msg-in mb-7 flex flex-wrap gap-2">
            {students.slice(0, PICKER_LIMIT).map((s) => {
                const a = avatarFor(s.name)
                return (
                    <button key={s.id} onClick={() => onPick(s.name)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-elevated py-[5px] pl-[5px] pr-[13px] text-[12.5px] font-medium text-[#1D1D1F] dark:text-foreground transition hover:border-[#D2D2D7] dark:hover:border-k-border-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg">
                        <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[10px] font-bold" style={{ background: a.bg, color: a.fg }}>{a.initials}</span>
                        {s.name}
                    </button>
                )
            })}
            <button onClick={onSearchOther}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#E2E2E7] dark:border-k-border-subtle px-[13px] py-1.5 text-[12.5px] font-medium text-[#86868B] dark:text-muted-foreground transition hover:border-[#AEAEB2] dark:hover:border-k-border-primary hover:text-[#6E6E73] dark:hover:text-foreground">
                <Search className="h-[13px] w-[13px]" strokeWidth={2} /> Buscar outro…
            </button>
        </div>
    )
}

function MessageRow({ message, onConfirmResolved }: {
    message: AssistantMessage
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
}) {
    const isUser = message.role === 'user'

    if (isUser) {
        return (
            <div className="kv-msg-in mb-7 flex justify-end">
                <div className="max-w-[78%] whitespace-pre-wrap rounded-[18px] rounded-tr-[6px] bg-[#F4F4F7] dark:bg-glass-bg px-4 py-2.5 text-[15px] leading-[1.55] text-[#1D1D1F] dark:text-foreground">
                    {message.content}
                </div>
            </div>
        )
    }

    return (
        <div className="kv-msg-in mb-7">
            {message.content && (
                <div className="whitespace-pre-wrap text-[15.5px] leading-[1.7] text-[#1D1D1F] dark:text-foreground">{message.content}</div>
            )}
            {message.parts.map((part, i) => (
                <PartView key={i} part={part} onConfirmResolved={onConfirmResolved} />
            ))}
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
            <div className={`mt-3 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium ${failed ? 'bg-[#FEF2F2] dark:bg-rose-500/10 text-[#BE123C] dark:text-rose-300' : 'bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-muted-foreground/80'}`}>
                {failed
                    ? <span className="text-[#BE123C] dark:text-rose-300">✕</span>
                    : <Check className="h-[13px] w-[13px] text-[#16A34A] dark:text-emerald-400" strokeWidth={2.6} />}
                <span>{executedText(part.toolName, part.result)}</span>
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
        <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#F5F5F7] dark:bg-glass-bg px-3 py-1.5 text-[12px] text-[#86868B] dark:text-muted-foreground">
            {part.status === 'confirmed' ? 'Ação confirmada' : 'Ação cancelada'}
        </div>
    )
}

function TypingRow() {
    return (
        <div className="kv-msg-in mb-7 flex items-center gap-1.5" role="status" aria-label="Assistente está pensando">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4B5FD] [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4B5FD] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4B5FD] [animation-delay:300ms]" />
        </div>
    )
}

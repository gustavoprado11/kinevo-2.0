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

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Check, Send, Loader2, ArrowLeft, Pencil, Search, PenLine, ArrowUpRight, Square, AudioLines, Volume2 } from 'lucide-react'
import { CreditMeter } from '@/components/assistant/credit-meter'
import { ToolConfirmationCard } from '@/components/assistant/tool-confirmation-card'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type {
    ConversationListItem,
    AssistantMessage,
    AssistantMessagePart,
} from '@/lib/assistant/conversations'
import type { QuestionRequest, ProposalRequest } from '@/lib/assistant/hitl-types'
import { avatarFor } from './ui-util'
import { executedText } from '@/lib/assistant/tool-labels'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { MicButton } from './mic-button'
import { useVoiceMode, VOICE_MODE_ENABLED, type VoiceModeState } from './use-voice-mode'

interface PickStudent { id: string; name: string }

interface Props {
    active: ConversationListItem
    summary: AiUsageSummary
    messages: AssistantMessage[]
    loadingMessages: boolean
    sending: boolean
    liveSteps: string[]
    /** U-STREAM: texto da resposta chegando token a token (substituído pelo `done`). */
    liveText: string
    /** Incrementa a cada text_reset do stream — o modo voz corta a fala parcial. */
    textResetCount: number
    input: string
    trainerName: string | null
    students: PickStudent[]
    banner: AssistantBannerData | null
    onDismissBanner: () => void
    onInput: (v: string) => void
    onSend: () => void
    onStop: () => void
    onSendText: (text: string) => void
    onBackHome: () => void
    onRename: () => void
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
    /** Onda 6: envia um turno por VOZ (surface 'voice') e devolve a mensagem
     *  final para o TTS. Presente → o toggle de modo voz aparece. */
    onVoiceTurn?: (text: string) => Promise<AssistantMessage | null>
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

/**
 * Extrai o payload de um resultado de tool MCP. As tools do servidor MCP
 * devolvem `{ content: [{ type:'text', text: '<json>' }] }` (mcpSuccess), então
 * o objeto útil (program, student_id, message) está no JSON do primeiro content.
 * Defensivo: se já vier desempacotado (ex.: action injetada), usa direto.
 */
function parseMcpPayload(result: unknown): Record<string, unknown> | null {
    if (!result || typeof result !== 'object') return null
    const content = (result as { content?: Array<{ text?: string }> }).content
    if (Array.isArray(content) && typeof content[0]?.text === 'string') {
        try {
            return JSON.parse(content[0].text) as Record<string, unknown>
        } catch {
            return null
        }
    }
    return result as Record<string, unknown>
}

export function ConversationView({
    active, summary, messages, loadingMessages, sending, liveSteps, liveText, textResetCount, input, students, banner,
    onDismissBanner, onInput, onSend, onStop, onSendText, onBackHome, onRename, onConfirmResolved, onVoiceTurn,
}: Props) {
    const streamRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const av = avatarFor(active.studentName)

    // ── Modo voz hands-free (Onda 6) ──
    const voice = useVoiceMode({ onVoiceTurn: onVoiceTurn ?? (async () => null), liveText, textResetCount })
    const voiceOn = voice.state !== 'off'
    const resolveConfirmation = (toolName: string, confirmed: boolean, result?: unknown) => {
        onConfirmResolved(toolName, confirmed, result)
        voice.notifyConfirmationResolved()
    }

    useEffect(() => {
        if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight
    }, [messages, sending, liveSteps, liveText])

    // Composer cresce com o conteúdo (até ~200px; depois rola internamente).
    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }, [input])

    // ── Seleção rápida de aluno (C) ──
    // Heurística por texto (legado): NÃO mostrar quando a mensagem já traz um card
    // interativo (pergunta estruturada via tool, ou confirmação pendente) — senão
    // apareceriam duas listas pedindo a mesma coisa.
    const last = messages[messages.length - 1]
    const lastHasInteractive = last?.parts.some(
        (p) => (p.type === 'confirmation' && p.status === 'pending') || p.type === 'question',
    ) ?? false
    const needsStudent =
        !sending && !active.student_id && students.length > 0 &&
        last?.role === 'assistant' && !lastHasInteractive && STUDENT_REQUEST.test(last.content)

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
                    {messages.map((m, idx) => (
                        <MessageRow key={m.id} message={m} interactive={idx === messages.length - 1 && !sending}
                            onConfirmResolved={resolveConfirmation} onSendText={onSendText} />
                    ))}
                    {needsStudent && (
                        <StudentPicker students={students} onPick={(name) => onSendText(name)} onSearchOther={() => inputRef.current?.focus()} />
                    )}
                    {sending && (
                        liveSteps.length > 0 || liveText ? (
                            <div className="kv-msg-in mb-7">
                                {liveSteps.length > 0 && (
                                    <div className="space-y-1">
                                        {liveSteps.map((step, i) => {
                                            // Texto já fluindo = passos concluídos (sem spinner preso).
                                            const spinning = !liveText && i === liveSteps.length - 1
                                            return (
                                                <div key={i} className="flex items-center gap-2 text-[13px] text-[#86868B] dark:text-muted-foreground">
                                                    {spinning
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7C3AED] dark:text-violet-400" strokeWidth={2.2} />
                                                        : <Check className="h-3.5 w-3.5 text-[#16A34A] dark:text-emerald-400" strokeWidth={2.6} />}
                                                    <span>{step}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                {/* U-STREAM: a resposta aparece token a token; o `done` a substitui pela persistida. */}
                                {liveText && (
                                    <div className={`whitespace-pre-wrap text-[15.5px] leading-[1.7] text-[#1D1D1F] dark:text-foreground ${liveSteps.length > 0 ? 'mt-3' : ''}`}>
                                        {liveText}
                                    </div>
                                )}
                            </div>
                        ) : <TypingRow />
                    )}
                </div>
            </div>

            <div className="shrink-0 pb-4 pt-1">
                <div className="mx-auto max-w-[760px] px-6">
                    {banner && (
                        <div className="mb-2.5">
                            <AssistantBanner data={banner} onDismiss={onDismissBanner} />
                        </div>
                    )}
                    {voiceOn && (
                        <div className="mb-2.5">
                            <VoiceStatusPill state={voice.state} interim={voice.interim}
                                onInterrupt={voice.interrupt} onStop={voice.stop} />
                        </div>
                    )}
                    {showSuggestions && !banner && !voiceOn && (
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
                        {VOICE_MODE_ENABLED && onVoiceTurn && voice.supported && (
                            <button
                                type="button"
                                onClick={() => (voiceOn ? voice.stop() : voice.start())}
                                title={voiceOn ? 'Sair do modo voz' : 'Modo voz (mãos livres)'}
                                aria-label={voiceOn ? 'Sair do modo voz' : 'Modo voz (mãos livres)'}
                                aria-pressed={voiceOn}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border transition ${
                                    voiceOn
                                        ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                                        : 'border-[#E8E8ED] dark:border-k-border-subtle text-[#6E6E73] dark:text-muted-foreground/80 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg'
                                }`}
                            >
                                <AudioLines className="h-[17px] w-[17px]" strokeWidth={2} />
                            </button>
                        )}
                        {!voiceOn && <MicButton disabled={sending} value={input} onChange={onInput} />}
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
                        {sending ? (
                            <button onClick={onStop} type="button" title="Parar"
                                className="flex h-[36px] items-center gap-1.5 rounded-[14px] border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-elevated px-4 text-[13px] font-bold text-[#1D1D1F] dark:text-foreground transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg">
                                <Square className="h-3 w-3" strokeWidth={2.5} fill="currentColor" /> Parar
                            </button>
                        ) : (
                            <button onClick={onSend} disabled={!input.trim()}
                                className="flex h-[36px] items-center gap-1.5 rounded-[14px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 text-[13px] font-bold text-white transition hover:brightness-105 disabled:opacity-40">
                                <Send className="h-[15px] w-[15px]" strokeWidth={2} /> Agir
                            </button>
                        )}
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

function MessageRow({ message, interactive, onConfirmResolved, onSendText }: {
    message: AssistantMessage
    interactive: boolean
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
    onSendText: (text: string) => void
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
                <PartView key={i} part={part} interactive={interactive}
                    onConfirmResolved={onConfirmResolved} onSendText={onSendText} />
            ))}
        </div>
    )
}

function PartView({ part, interactive, onConfirmResolved, onSendText }: {
    part: AssistantMessagePart
    interactive: boolean
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
    onSendText: (text: string) => void
}) {
    // Memória interna do modelo (Onda 2) — as rotas já a removem das respostas;
    // guarda defensiva caso um payload antigo/novo vaze uma part `context`.
    if (part.type === 'context') return null
    if (part.type === 'executed') {
        const r = part.result as { success?: boolean; reviewUrl?: string } | null
        const failed = r && typeof r === 'object' && r.success === false
        // Programa gerado: card acionável com prévia + botão para o builder/revisão.
        if (!failed && part.toolName === 'generateProgram' && r?.reviewUrl) {
            return (
                <div className="mt-3 max-w-[440px] rounded-2xl border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                            <Sparkles className="h-4 w-4 text-white" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                            <b className="block text-[13.5px] font-semibold text-[#1D1D1F] dark:text-foreground">Programa gerado (rascunho)</b>
                            <span className="block text-[12px] text-[#86868B] dark:text-muted-foreground">Salvo para revisão — ainda não ativado para o aluno.</span>
                        </div>
                    </div>
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#6E6E73] dark:text-muted-foreground/80">
                        Abra o builder para conferir os treinos e exercícios, ajustar o que quiser e <b className="font-semibold text-[#1D1D1F] dark:text-foreground">ativar</b> — só então ele aparece no painel do aluno.
                    </p>
                    <Link href={r.reviewUrl}
                        className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-[1.07]">
                        Revisar no builder <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
                    </Link>
                </div>
            )
        }
        // Rascunho-do-aluno criado pelo assistente (via MCP): card acionável →
        // builder/revisão do rascunho. O id do programa + aluno vêm no payload
        // (resultado MCP empacotado em content[].text — ver parseMcpPayload).
        if (part.toolName === 'kinevo_create_student_draft_program') {
            const payload = parseMcpPayload(part.result)
            const prog = payload?.program as { id?: string; name?: string } | undefined
            const studentId = typeof payload?.student_id === 'string' ? payload.student_id : undefined
            if (!payload?.error && prog?.id && studentId) {
                const editUrl = `/students/${studentId}/program/${prog.id}/edit`
                return (
                    <div className="mt-3 max-w-[440px] rounded-2xl border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                                <Sparkles className="h-4 w-4 text-white" strokeWidth={1.8} />
                            </span>
                            <div className="min-w-0">
                                <b className="block truncate text-[13.5px] font-semibold text-[#1D1D1F] dark:text-foreground">{prog.name || 'Rascunho de programa'}</b>
                                <span className="block text-[12px] text-[#86868B] dark:text-muted-foreground">Rascunho no perfil do aluno — ainda não ativado.</span>
                            </div>
                        </div>
                        <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#6E6E73] dark:text-muted-foreground/80">
                            Abra o builder para revisar os treinos e exercícios, ajustar o que quiser e <b className="font-semibold text-[#1D1D1F] dark:text-foreground">ativar</b> — só então ele aparece no app do aluno.
                        </p>
                        <Link href={editUrl}
                            className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-[1.07]">
                            Revisar rascunho <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
                        </Link>
                    </div>
                )
            }
        }
        return (
            <div className={`mt-3 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium ${failed ? 'bg-[#FEF2F2] dark:bg-rose-500/10 text-[#BE123C] dark:text-rose-300' : 'bg-[#F5F5F7] dark:bg-glass-bg text-[#6E6E73] dark:text-muted-foreground/80'}`}>
                {failed
                    ? <span className="text-[#BE123C] dark:text-rose-300">✕</span>
                    : <Check className="h-[13px] w-[13px] text-[#16A34A] dark:text-emerald-400" strokeWidth={2.6} />}
                <span>{executedText(part.toolName, part.result)}</span>
            </div>
        )
    }
    // "Ask the user": pergunta com opções clicáveis (tratado ANTES da confirmação,
    // pois ambos têm status 'pending').
    if (part.type === 'question') {
        return <QuestionCard request={part.request} onAnswer={onSendText} interactive={interactive} />
    }
    if (part.type === 'proposal') {
        return <ProposalCard request={part.request} onAnswer={onSendText} interactive={interactive} />
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

/**
 * QuestionCard — "Ask the user": opções clicáveis. Escolha única envia na hora;
 * múltipla marca várias + botão Enviar; "Outro…" abre um campo inline para texto
 * livre. A pergunta em si aparece no texto da mensagem (acima); aqui só as opções.
 */
function QuestionCard({ request, onAnswer, interactive }: {
    request: QuestionRequest
    onAnswer: (text: string) => void
    interactive: boolean
}) {
    const [selected, setSelected] = useState<string[]>([])
    const [done, setDone] = useState(false)
    const [otherMode, setOtherMode] = useState(false)
    const [otherText, setOtherText] = useState('')
    const otherRef = useRef<HTMLInputElement>(null)

    useEffect(() => { if (otherMode) otherRef.current?.focus() }, [otherMode])

    const chipBase = 'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold transition disabled:cursor-default'
    const chipIdle = 'border-[#E2E2E7] dark:border-k-border-subtle bg-white dark:bg-surface-card text-[#1D1D1F] dark:text-foreground hover:border-[#7C3AED] hover:bg-[#7C3AED]/[0.06] hover:text-[#7C3AED] dark:hover:text-violet-300'
    const chipOn = 'border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED] dark:text-violet-300'

    if (done) {
        return (
            <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#F5F5F7] dark:bg-glass-bg px-3 py-1.5 text-[12px] text-[#86868B] dark:text-muted-foreground">
                <Check className="h-[13px] w-[13px] text-[#16A34A] dark:text-emerald-400" strokeWidth={2.6} /> Respondido
            </div>
        )
    }

    // Conversa avançou: card antigo vira read-only (não re-dispara).
    if (!interactive) {
        return (
            <div className="mt-3 flex flex-wrap gap-2 opacity-60">
                {request.options.map((opt) => (
                    <span key={opt} className="inline-flex items-center rounded-full border border-[#E2E2E7] dark:border-k-border-subtle px-3.5 py-[7px] text-[12.5px] font-semibold text-[#AEAEB2] dark:text-muted-foreground/60">{opt}</span>
                ))}
            </div>
        )
    }

    const submitOther = () => {
        const t = otherText.trim()
        if (!t) return
        const answer = request.multiple && selected.length > 0 ? [...selected, t].join(', ') : t
        setDone(true)
        onAnswer(answer)
    }

    const otherChip = request.allowOther && !otherMode && (
        <button onClick={() => setOtherMode(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#E2E2E7] dark:border-k-border-subtle px-3.5 py-[7px] text-[12.5px] font-medium text-[#86868B] dark:text-muted-foreground transition hover:border-[#AEAEB2] dark:hover:border-k-border-primary hover:text-[#6E6E73] dark:hover:text-foreground">
            <PenLine className="h-[13px] w-[13px]" strokeWidth={2} /> Outro…
        </button>
    )

    const otherInput = otherMode && (
        <div className="mt-2.5 flex items-center gap-2">
            <input ref={otherRef} value={otherText} onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitOther() } }}
                placeholder="Escreva sua resposta…"
                className="min-w-0 flex-1 rounded-[12px] border border-[#E2E2E7] dark:border-k-border-subtle bg-white dark:bg-surface-card px-3.5 py-2 text-[13.5px] text-[#1D1D1F] dark:text-foreground outline-none transition focus:border-[#7C3AED] placeholder:text-[#AEAEB2] dark:placeholder:text-muted-foreground/60" />
            <button onClick={submitOther} disabled={!otherText.trim()}
                className="inline-flex shrink-0 items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-[1.07] disabled:opacity-40">
                <Send className="h-3.5 w-3.5" strokeWidth={2} /> Enviar
            </button>
        </div>
    )

    if (!request.multiple) {
        return (
            <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                    {request.options.map((opt) => (
                        <button key={opt} onClick={() => { setDone(true); onAnswer(opt) }}
                            className={`${chipBase} ${chipIdle}`}>{opt}</button>
                    ))}
                    {otherChip}
                </div>
                {otherInput}
            </div>
        )
    }

    const toggle = (opt: string) =>
        setSelected((s) => (s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]))

    return (
        <div className="mt-3">
            <div className="flex flex-wrap gap-2">
                {request.options.map((opt) => {
                    const on = selected.includes(opt)
                    return (
                        <button key={opt} onClick={() => toggle(opt)}
                            className={`${chipBase} ${on ? chipOn : chipIdle}`}>
                            {on && <Check className="h-[13px] w-[13px]" strokeWidth={2.6} />}{opt}
                        </button>
                    )
                })}
                {otherChip}
            </div>
            {otherInput}
            {!otherMode && (
                <button disabled={selected.length === 0}
                    onClick={() => { setDone(true); onAnswer(selected.join(', ')) }}
                    className="mt-2.5 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-[1.07] disabled:opacity-40">
                    <Send className="h-3.5 w-3.5" strokeWidth={2} /> Enviar
                </button>
            )}
        </div>
    )
}

/**
 * ProposalCard — proposta editável: a IA propõe itens (rótulo+valor); o treinador
 * ajusta os valores inline e clica Aprovar (envia os valores finais) ou Cancelar.
 * O texto da pergunta de aprovação vem no conteúdo da mensagem (acima).
 */
function ProposalCard({ request, onAnswer, interactive }: {
    request: ProposalRequest
    onAnswer: (text: string) => void
    interactive: boolean
}) {
    const [values, setValues] = useState<string[]>(() => request.items.map((it) => it.value))
    const [done, setDone] = useState<null | 'approved' | 'cancelled'>(null)

    if (done) {
        return (
            <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#F5F5F7] dark:bg-glass-bg px-3 py-1.5 text-[12px] text-[#86868B] dark:text-muted-foreground">
                {done === 'approved'
                    ? <><Check className="h-[13px] w-[13px] text-[#16A34A] dark:text-emerald-400" strokeWidth={2.6} /> Proposta aprovada</>
                    : <>Proposta cancelada</>}
            </div>
        )
    }

    // Conversa avançou: card antigo vira read-only (itens estáticos, sem botões).
    if (!interactive) {
        return (
            <div className="mt-3 max-w-[540px] rounded-2xl border border-[#EDEDF0] dark:border-k-border-subtle bg-[#FAFAFA] dark:bg-glass-bg p-4 opacity-70">
                <div className="flex flex-col gap-2">
                    {request.items.map((it, i) => (
                        <div key={i} className="flex items-baseline gap-3 text-[12.5px]">
                            <span className="w-[110px] shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868B] dark:text-muted-foreground">{it.label}</span>
                            <span className="text-[#6E6E73] dark:text-muted-foreground/80">{values[i]}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const approve = () => {
        const lines = request.items.map((it, i) => `${it.label}: ${values[i]}`).join('; ')
        setDone('approved')
        onAnswer(`Aprovado. Valores finais — ${lines}.`)
    }
    const cancel = () => { setDone('cancelled'); onAnswer('Cancelar a proposta.') }

    return (
        <div className="mt-3 max-w-[540px] rounded-2xl border border-[#EDEDF0] dark:border-k-border-subtle bg-white dark:bg-surface-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2.5">
                {request.items.map((it, i) => {
                    // Itens de "direção"/estilo (ou valores longos) ganham textarea — o
                    // treinador escreve um brief de verdade que o motor honra (modo criativo).
                    const multiline = /direç|estilo|brief|observ|nota/i.test(it.label) || (values[i]?.length ?? 0) > 44
                    return (
                        <label key={i} className={`flex gap-3 ${multiline ? 'items-start' : 'items-center'}`}>
                            <span className={`w-[110px] shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#86868B] dark:text-muted-foreground ${multiline ? 'pt-2.5' : ''}`}>{it.label}</span>
                            {multiline ? (
                                <textarea value={values[i]} rows={3}
                                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                                    className="flex-1 resize-y rounded-[10px] border border-transparent bg-[#F5F5F7] dark:bg-glass-bg px-3 py-2 text-[13.5px] font-medium leading-relaxed text-[#1D1D1F] dark:text-foreground outline-none transition hover:border-[#E2E2E7] dark:hover:border-k-border-subtle focus:border-[#7C3AED] focus:bg-white dark:focus:bg-surface-card" />
                            ) : (
                                <span className="relative flex-1">
                                    <input value={values[i]}
                                        onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                                        className="w-full rounded-[10px] border border-transparent bg-[#F5F5F7] dark:bg-glass-bg px-3 py-2 pr-8 text-[13.5px] font-medium text-[#1D1D1F] dark:text-foreground outline-none transition hover:border-[#E2E2E7] dark:hover:border-k-border-subtle focus:border-[#7C3AED] focus:bg-white dark:focus:bg-surface-card" />
                                    <PenLine className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C4C4C9] dark:text-muted-foreground/50" strokeWidth={2} />
                                </span>
                            )}
                        </label>
                    )
                })}
            </div>
            <div className="mt-4 flex items-center gap-2">
                <button onClick={approve}
                    className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-[1.07]">
                    <Check className="h-4 w-4" strokeWidth={2.4} /> {request.approveLabel}
                </button>
                <button onClick={cancel}
                    className="rounded-[12px] border border-[#E2E2E7] dark:border-k-border-subtle px-4 py-2 text-[13px] font-semibold text-[#6E6E73] dark:text-muted-foreground transition hover:bg-[#F5F5F7] dark:hover:bg-glass-bg">
                    Cancelar
                </button>
            </div>
        </div>
    )
}

/**
 * VoiceStatusPill — estado do modo voz acima do composer: Ouvindo (com a fala
 * parcial ao vivo), Pensando, Falando (toque = interromper e falar por cima),
 * pausado aguardando o card HITL, ou erro (toque = tentar de novo).
 */
function VoiceStatusPill({ state, interim, onInterrupt, onStop }: {
    state: VoiceModeState
    interim: string
    onInterrupt: () => void
    onStop: () => void
}) {
    const base = 'flex w-full items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px]'
    if (state === 'listening') {
        return (
            <div className={`${base} border-[#DDD6FE] bg-[#7C3AED]/[0.05] text-[#1D1D1F] dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-foreground`}>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C3AED] opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                    {interim ? <em className="not-italic text-[#6E6E73] dark:text-muted-foreground">{interim}</em> : 'Ouvindo… pode falar.'}
                </span>
                <button onClick={onStop} className="shrink-0 text-[12px] font-semibold text-[#86868B] transition hover:text-[#1D1D1F] dark:text-muted-foreground dark:hover:text-foreground">Sair</button>
            </div>
        )
    }
    if (state === 'thinking') {
        return (
            <div className={`${base} border-[#EDEDF0] bg-[#F5F5F7] text-[#6E6E73] dark:border-k-border-subtle dark:bg-glass-bg dark:text-muted-foreground`}>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#7C3AED] dark:text-violet-400" strokeWidth={2.2} />
                <span className="flex-1">Pensando…</span>
                <button onClick={onStop} className="shrink-0 text-[12px] font-semibold text-[#86868B] transition hover:text-[#1D1D1F] dark:text-muted-foreground dark:hover:text-foreground">Sair</button>
            </div>
        )
    }
    if (state === 'speaking') {
        return (
            <button onClick={onInterrupt} className={`${base} border-[#DDD6FE] bg-[#7C3AED]/[0.05] text-left text-[#1D1D1F] transition hover:bg-[#7C3AED]/[0.09] dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-foreground`}>
                <Volume2 className="h-4 w-4 shrink-0 animate-pulse text-[#7C3AED] dark:text-violet-400" strokeWidth={2} />
                <span className="flex-1">Falando… toque para interromper e falar.</span>
            </button>
        )
    }
    if (state === 'paused_confirmation') {
        return (
            <div className={`${base} border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300`}>
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                <span className="flex-1">Confirme (ou cancele) a ação no card acima — depois eu volto a ouvir.</span>
                <button onClick={onStop} className="shrink-0 text-[12px] font-semibold opacity-70 transition hover:opacity-100">Sair</button>
            </div>
        )
    }
    // error
    return (
        <button onClick={onInterrupt} className={`${base} border-[#F5C2C0] bg-[#FEF2F2] text-left text-[#BE123C] transition hover:bg-[#FEE2E2] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300`}>
            <span className="flex-1">O modo voz falhou. Toque para tentar de novo — ou verifique a permissão do microfone.</span>
        </button>
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

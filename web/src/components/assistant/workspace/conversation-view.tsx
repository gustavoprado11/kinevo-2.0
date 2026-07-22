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
import { Check, Send, Loader2, ArrowLeft, Pencil, Search, PenLine, ArrowUpRight, AudioLines, Volume2, X as XIcon } from 'lucide-react'
import { CreditMeter } from '@/components/assistant/credit-meter'
import { ToolConfirmationCard } from '@/components/assistant/tool-confirmation-card'
import { AssistantComposer, type AssistantTurnMode } from './assistant-composer'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type {
    ConversationListItem,
    AssistantMessage,
    AssistantMessagePart,
} from '@/lib/assistant/conversations'
import type { QuestionRequest, ProposalRequest } from '@/lib/assistant/hitl-types'
import { avatarFor } from './ui-util'
import { MarkdownText } from './markdown-text'
import { ProgramPreviewCard, ProgramPreviewChip, executeAssistantToolClient } from './program-preview-card'
import { executedText } from '@/lib/assistant/tool-labels'
import { AssistantBanner, type AssistantBannerData } from './assistant-banner'
import { useVoiceMode, VOICE_MODE_ENABLED, type VoiceModeState } from './use-voice-mode'
import { AssistantMark } from '@/components/assistant/assistant-mark'

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
    mode: AssistantTurnMode
    onModeChange: (m: AssistantTurnMode) => void
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
    /** V2 preview-first: o canvas da prévia está no painel de contexto → o chat
     *  mostra um CHIP (em lg+) em vez do card completo. Ausente (dock) = card. */
    previewPanel?: { version: number; onOpen: () => void } | null
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
    active, summary, messages, loadingMessages, sending, liveSteps, liveText, textResetCount, input, mode, students, banner,
    onDismissBanner, onInput, onSend, onStop, onSendText, onModeChange, onBackHome, onRename, onConfirmResolved, onVoiceTurn,
    previewPanel,
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

    // Preview-first: a prévia de programa pendente MAIS RECENTE segue acionável
    // mesmo que a conversa tenha avançado (ex.: o treinador perguntou algo antes
    // de aprovar) — só uma prévia mais nova (ou o desfecho) a substitui.
    const lastPreviewMessageId = [...messages].reverse().find((m) =>
        m.parts.some((p) => p.type === 'confirmation' && p.status === 'pending' &&
            p.request.toolName === 'kinevo_create_student_draft_program'),
    )?.id ?? null

    return (
        // Superfície branca full-bleed (ponta a ponta) — flat, sem moldura, estilo Claude.
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-surface-card">
            <header className="flex shrink-0 items-center gap-1.5 border-b border-k-border-subtle dark:border-k-border-subtle px-4 py-2.5">
                <button onClick={onBackHome} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-k-text-tertiary dark:text-muted-foreground transition hover:bg-surface-inset dark:hover:bg-glass-bg hover:text-k-text-primary dark:hover:text-foreground" title="Voltar ao início">
                    <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </button>
                <div className="flex min-w-0 items-center gap-2.5 pl-1">
                    {/* Avatar neutro (idioma do rail/home) — o violeta fica só na marca do Geral. */}
                    {active.student_id ? (
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset text-[11px] font-semibold text-k-text-secondary">
                            {av.initials}
                        </span>
                    ) : (
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-control bg-primary">
                            <AssistantMark className="h-4 w-4 text-primary-foreground" strokeWidth={1.7} />
                        </span>
                    )}
                    <div className="min-w-0 leading-tight">
                        <b className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-k-text-primary dark:text-foreground">{active.studentName ?? 'Geral · visão geral dos alunos'}</b>
                        <span className="block truncate text-[11px] text-k-text-tertiary dark:text-muted-foreground">{active.student_id ? 'Conversa sobre o aluno' : 'Todos os alunos'}</span>
                    </div>
                </div>
                <div className="flex-1" />
                <button onClick={onRename} className="hidden h-9 w-9 items-center justify-center rounded-[10px] text-k-text-tertiary dark:text-muted-foreground transition hover:bg-surface-inset dark:hover:bg-glass-bg hover:text-k-text-primary dark:hover:text-foreground sm:flex" title="Renomear conversa">
                    <Pencil className="h-[16px] w-[16px]" strokeWidth={1.8} />
                </button>
                <div className="hidden lg:block"><CreditMeter summary={summary} pill /></div>
            </header>

            <div ref={streamRef} className="min-h-0 flex-1 overflow-y-auto py-9" aria-live="polite" aria-busy={sending}>
                <div className="mx-auto max-w-[760px] px-6">
                    {loadingMessages && (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-k-text-quaternary dark:text-muted-foreground/60" /></div>
                    )}
                    {messages.map((m, idx) => (
                        <MessageRow key={m.id} message={m} interactive={idx === messages.length - 1 && !sending}
                            previewInteractive={!sending && m.id === lastPreviewMessageId}
                            previewPanel={previewPanel}
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
                                                <div key={i} className="flex items-center gap-2 text-[13px] text-k-text-tertiary dark:text-muted-foreground">
                                                    {spinning
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" strokeWidth={2.2} />
                                                        : <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} />}
                                                    <span>{step}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                {/* U-STREAM: a resposta aparece token a token; o `done` a substitui pela persistida. */}
                                {liveText && (
                                    <MarkdownText className={liveSteps.length > 0 ? 'mt-3' : ''}>{liveText}</MarkdownText>
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
                    <AssistantComposer
                        input={input}
                        onInput={onInput}
                        onSend={onSend}
                        onStop={onStop}
                        sending={sending}
                        textareaDisabled={sending}
                        placeholder={active.studentName ? `Diga o que fazer com ${active.studentName.split(' ')[0]}…` : 'Diga o que fazer no Kinevo…'}
                        ariaLabel={active.studentName ? `Mensagem para o assistente sobre ${active.studentName}` : 'Mensagem para o assistente'}
                        mode={mode}
                        onModeChange={onModeChange}
                        menuDirection="up"
                        textareaRef={inputRef}
                        maxTextareaHeight={200}
                        hideMic={voiceOn}
                        // Escopo já está fixo no cabeçalho da conversa → sem seletor aqui.
                        chips={showSuggestions && !banner && !voiceOn
                            ? suggestions.map((s) => ({ label: s, onClick: () => onSendText(s) }))
                            : undefined}
                        toolbarLead={VOICE_MODE_ENABLED && onVoiceTurn && voice.supported ? (
                            <button
                                type="button"
                                onClick={() => (voiceOn ? voice.stop() : voice.start())}
                                title={voiceOn ? 'Sair do modo voz' : 'Modo voz (mãos livres)'}
                                aria-label={voiceOn ? 'Sair do modo voz' : 'Modo voz (mãos livres)'}
                                aria-pressed={voiceOn}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-90 ${
                                    voiceOn
                                        ? 'border-primary bg-primary text-white'
                                        : 'border-k-border-subtle dark:border-k-border-subtle text-k-text-secondary dark:text-muted-foreground/80 hover:bg-surface-inset dark:hover:bg-glass-bg'
                                }`}
                            >
                                <AudioLines className="h-[17px] w-[17px]" strokeWidth={2} />
                            </button>
                        ) : undefined}
                    />
                    <div className="mt-2 flex justify-center gap-4 text-[10.5px] text-k-text-quaternary">
                        <span><kbd className="rounded border border-k-border-subtle bg-surface-card px-1.5 font-mono text-k-text-tertiary">Enter</kbd> enviar</span>
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
                        className="inline-flex items-center gap-2 rounded-control border border-k-border-subtle bg-surface-card py-[5px] pl-[5px] pr-[13px] text-[12.5px] font-medium text-k-text-primary transition hover:border-k-border-primary hover:bg-surface-inset">
                        <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-k-border-subtle bg-surface-inset text-[10px] font-semibold text-k-text-secondary">{a.initials}</span>
                        {s.name}
                    </button>
                )
            })}
            <button onClick={onSearchOther}
                className="inline-flex items-center gap-1.5 rounded-control border border-dashed border-k-border-subtle px-[13px] py-1.5 text-[12.5px] font-medium text-k-text-tertiary transition hover:border-k-border-primary hover:text-k-text-secondary">
                <Search className="h-[13px] w-[13px]" strokeWidth={2} /> Buscar outro…
            </button>
        </div>
    )
}

function MessageRow({ message, interactive, previewInteractive, previewPanel, onConfirmResolved, onSendText }: {
    message: AssistantMessage
    interactive: boolean
    /** A prévia de programa desta mensagem ainda é a pendente mais recente. */
    previewInteractive: boolean
    previewPanel?: { version: number; onOpen: () => void } | null
    onConfirmResolved: (toolName: string, confirmed: boolean, result?: unknown) => void
    onSendText: (text: string) => void
}) {
    const isUser = message.role === 'user'

    if (isUser) {
        return (
            <div className="kv-msg-in mb-7 flex justify-end">
                <div className="max-w-[78%] whitespace-pre-wrap rounded-[14px] rounded-tr-[4px] bg-surface-inset px-4 py-2.5 text-[15px] leading-[1.55] text-k-text-primary">
                    {message.content}
                </div>
            </div>
        )
    }

    return (
        <div className="kv-msg-in mb-7">
            {message.content && <MarkdownText>{message.content}</MarkdownText>}
            {message.parts.map((part, i) => (
                <PartView key={i} part={part} interactive={interactive} previewInteractive={previewInteractive}
                    previewPanel={previewPanel}
                    onConfirmResolved={onConfirmResolved} onSendText={onSendText} />
            ))}
        </div>
    )
}

/**
 * ProgramDraftCard — resultado "programa criado como rascunho" no idioma dos
 * painéis (hairline, sem sombra; violeta só no glifo e na ação primária).
 * `activate` (V0, preview-first): ativa o rascunho dali mesmo, com um segundo
 * clique de confirmação inline (ativar compartilha com o aluno na hora).
 */
function ProgramDraftCard({ title, body, href, cta, activate }: {
    title: string
    body: React.ReactNode
    href: string
    cta: string
    activate?: {
        programId: string
        studentId: string
        programName: string
        onResolved: (confirmed: boolean, result?: unknown) => void
    }
}) {
    const [arm, setArm] = useState(false)
    const [running, setRunning] = useState(false)
    const [activated, setActivated] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const onActivate = async () => {
        if (!activate) return
        setRunning(true)
        setErrorMsg(null)
        try {
            const result = await executeAssistantToolClient(
                'kinevo_assign_program',
                { program_id: activate.programId, action: 'activate_draft' },
                'workspace',
                crypto.randomUUID(),
            )
            const payload = parseMcpPayload(result)
            // Desfecho combinado: a part executada carrega o suficiente p/ o card ativo.
            const merged = {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        activated: true,
                        assigned_program: payload?.assigned_program ?? { id: activate.programId, name: activate.programName },
                        program: { id: activate.programId, name: activate.programName },
                        student_id: activate.studentId,
                        message: (payload?.message as string | undefined) ?? 'Programa ativado.',
                    }),
                }],
            }
            setActivated(true)
            activate.onResolved(true, merged)
        } catch (e) {
            setErrorMsg((e as Error).message)
        } finally {
            setRunning(false)
        }
    }

    if (activated) {
        return (
            <div className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface-inset px-3 py-1.5 text-[12px] text-k-text-tertiary">
                <Check className="h-[13px] w-[13px] text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} /> Programa ativado
            </div>
        )
    }

    return (
        <div className="mt-3 max-w-[440px] rounded-panel border border-k-border-subtle bg-surface-card p-4">
            <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary">
                    <AssistantMark className="h-4 w-4 text-primary-foreground" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                    <b className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-k-text-primary">{title}</b>
                    <span className="mt-0.5 block font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">Rascunho — ainda não ativado</span>
                </div>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-k-text-secondary">{body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={href}
                    className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-[7px] text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90">
                    {cta} <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                </Link>
                {activate && (arm ? (
                    <button onClick={onActivate} disabled={running}
                        className="inline-flex items-center gap-1.5 rounded-control bg-amber-600 px-3.5 py-[7px] text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-amber-500 dark:text-stone-950">
                        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} /> : <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
                        Confirmar ativação
                    </button>
                ) : (
                    <button onClick={() => setArm(true)}
                        className="inline-flex items-center gap-1.5 rounded-control border border-k-border-subtle px-3.5 py-[7px] text-[12.5px] font-semibold text-k-text-secondary transition hover:bg-surface-inset hover:text-k-text-primary">
                        Ativar agora
                    </button>
                ))}
            </div>
            {arm && !errorMsg && (
                <p className="mt-2 text-[11.5px] text-k-text-quaternary">Ativar coloca o programa no app do aluno na hora (o vigente, se houver, é concluído).</p>
            )}
            {errorMsg && <p className="mt-2 text-[12px] font-medium text-rose-600 dark:text-rose-400">{errorMsg}</p>}
        </div>
    )
}

/** Programa criado e ATIVADO — visível para o aluno; ação única de ver o programa. */
function ProgramActiveCard({ name, href }: { name: string; href: string | null }) {
    return (
        <div className="mt-3 max-w-[440px] rounded-panel border border-k-border-subtle bg-surface-card p-4">
            <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary">
                    <AssistantMark className="h-4 w-4 text-primary-foreground" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                    <b className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-k-text-primary">{name}</b>
                    <span className="mt-0.5 block font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">Ativo — visível para o aluno</span>
                </div>
            </div>
            {href && (
                <Link href={href}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-[7px] text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90">
                    Ver programa <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                </Link>
            )}
        </div>
    )
}

function PartView({ part, interactive, previewInteractive, previewPanel, onConfirmResolved, onSendText }: {
    part: AssistantMessagePart
    interactive: boolean
    previewInteractive: boolean
    previewPanel?: { version: number; onOpen: () => void } | null
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
                <ProgramDraftCard
                    title="Programa gerado (rascunho)"
                    href={r.reviewUrl}
                    cta="Revisar no builder"
                    body={<>Abra o builder para conferir os treinos e exercícios, ajustar o que quiser e <b className="font-semibold text-k-text-primary">ativar</b> — só então ele aparece no painel do aluno.</>}
                />
            )
        }
        // Rascunho-do-aluno criado pelo assistente (via MCP): card acionável →
        // builder/revisão do rascunho, ou card ATIVO quando o desfecho já ativou
        // (preview-first: "Ativar agora" grava o resultado combinado activated).
        if (part.toolName === 'kinevo_create_student_draft_program' || part.toolName === 'kinevo_assign_program') {
            const payload = parseMcpPayload(part.result)
            const prog = payload?.program as { id?: string; name?: string } | undefined
            const assigned = payload?.assigned_program as { id?: string; name?: string } | undefined
            const studentId = typeof payload?.student_id === 'string' ? payload.student_id : undefined
            if (payload?.activated === true) {
                const id = assigned?.id ?? prog?.id
                return (
                    <ProgramActiveCard
                        name={assigned?.name ?? prog?.name ?? 'Programa'}
                        href={id && studentId ? `/students/${studentId}/program/${id}` : null}
                    />
                )
            }
            if (part.toolName === 'kinevo_create_student_draft_program' && !payload?.error && prog?.id && studentId) {
                const progId = prog.id
                const progName = prog.name || 'Rascunho de programa'
                return (
                    <ProgramDraftCard
                        title={progName}
                        href={`/students/${studentId}/program/${progId}/edit`}
                        cta="Revisar rascunho"
                        body={<>Abra o builder para revisar os treinos e exercícios, ajustar o que quiser e <b className="font-semibold text-k-text-primary">ativar</b> — só então ele aparece no app do aluno.</>}
                        activate={interactive ? {
                            programId: progId,
                            studentId,
                            programName: progName,
                            onResolved: (confirmed, result) => onConfirmResolved('kinevo_assign_program', confirmed, result),
                        } : undefined}
                    />
                )
            }
        }
        return (
            <div className={`mt-3 inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-[12.5px] font-medium ${failed ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-surface-inset text-k-text-secondary'}`}>
                {failed
                    ? <XIcon className="h-[13px] w-[13px]" strokeWidth={2.6} />
                    : <Check className="h-[13px] w-[13px] text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} />}
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
        // Preview-first: o build do rascunho pendente vira a PRÉVIA rica do
        // programa (salvar rascunho / ativar agora), não o card genérico.
        if (part.request.toolName === 'kinevo_create_student_draft_program') {
            const resolve = (confirmed: boolean, result?: unknown) =>
                onConfirmResolved(part.request.toolName, confirmed, result)
            // V2: canvas visível no painel → chip no chat (o painel só existe em
            // lg+; abaixo disso o card completo continua sendo a prévia).
            if (previewPanel && previewInteractive) {
                return (
                    <>
                        <div className="lg:hidden">
                            <ProgramPreviewCard request={part.request} interactive surface="workspace" onResolved={resolve} />
                        </div>
                        <div className="hidden lg:block">
                            <ProgramPreviewChip request={part.request} version={previewPanel.version} onOpen={previewPanel.onOpen} />
                        </div>
                    </>
                )
            }
            return (
                <ProgramPreviewCard request={part.request} interactive={previewInteractive} surface="workspace"
                    onResolved={resolve} />
            )
        }
        return (
            <div className="mt-3.5">
                <ToolConfirmationCard request={part.request} surface="workspace"
                    onResolved={(result, toolResult) => onConfirmResolved(part.request.toolName, result.confirmed, toolResult)} />
            </div>
        )
    }
    return (
        <div className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface-inset px-3 py-1.5 text-[12px] text-k-text-tertiary">
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

    const chipBase = 'inline-flex items-center gap-1.5 rounded-control border px-3.5 py-[7px] text-[12.5px] font-semibold transition disabled:cursor-default'
    const chipIdle = 'border-k-border-subtle bg-surface-card text-k-text-primary hover:border-primary hover:bg-primary/[0.06] hover:text-primary'
    const chipOn = 'border-primary bg-primary/10 text-primary'

    if (done) {
        return (
            <div className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface-inset px-3 py-1.5 text-[12px] text-k-text-tertiary">
                <Check className="h-[13px] w-[13px] text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} /> Respondido
            </div>
        )
    }

    // Conversa avançou: card antigo vira read-only (não re-dispara).
    if (!interactive) {
        return (
            <div className="mt-3 flex flex-wrap gap-2 opacity-60">
                {request.options.map((opt) => (
                    <span key={opt} className="inline-flex items-center rounded-control border border-k-border-subtle px-3.5 py-[7px] text-[12.5px] font-semibold text-k-text-quaternary">{opt}</span>
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
            className="inline-flex items-center gap-1.5 rounded-control border border-dashed border-k-border-subtle px-3.5 py-[7px] text-[12.5px] font-medium text-k-text-tertiary transition hover:border-k-border-primary hover:text-k-text-secondary">
            <PenLine className="h-[13px] w-[13px]" strokeWidth={2} /> Outro…
        </button>
    )

    const otherInput = otherMode && (
        <div className="mt-2.5 flex items-center gap-2">
            <input ref={otherRef} value={otherText} onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitOther() } }}
                placeholder="Escreva sua resposta…"
                className="min-w-0 flex-1 rounded-control border border-k-border-subtle bg-surface-card px-3.5 py-2 text-[13.5px] text-k-text-primary outline-none transition focus:border-primary placeholder:text-k-text-quaternary" />
            <button onClick={submitOther} disabled={!otherText.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
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
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
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
            <div className="mt-3 inline-flex items-center gap-2 rounded-control bg-surface-inset px-3 py-1.5 text-[12px] text-k-text-tertiary">
                {done === 'approved'
                    ? <><Check className="h-[13px] w-[13px] text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} /> Proposta aprovada</>
                    : <>Proposta cancelada</>}
            </div>
        )
    }

    // Conversa avançou: card antigo vira read-only (itens estáticos, sem botões).
    if (!interactive) {
        return (
            <div className="mt-3 max-w-[540px] rounded-panel border border-k-border-subtle bg-surface-inset/60 p-4 opacity-70">
                <div className="flex flex-col gap-2">
                    {request.items.map((it, i) => (
                        <div key={i} className="flex items-baseline gap-3 text-[12.5px]">
                            <span className="w-[110px] shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">{it.label}</span>
                            <span className="text-k-text-secondary">{values[i]}</span>
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
        <div className="mt-3 max-w-[540px] rounded-panel border border-k-border-subtle bg-surface-card p-4">
            <div className="flex flex-col gap-2.5">
                {request.items.map((it, i) => {
                    // Itens de "direção"/estilo (ou valores longos) ganham textarea — o
                    // treinador escreve um brief de verdade que o motor honra (modo criativo).
                    const multiline = /direç|estilo|brief|observ|nota/i.test(it.label) || (values[i]?.length ?? 0) > 44
                    return (
                        <label key={i} className={`flex gap-3 ${multiline ? 'items-start' : 'items-center'}`}>
                            <span className={`w-[110px] shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary ${multiline ? 'pt-2.5' : ''}`}>{it.label}</span>
                            {multiline ? (
                                <textarea value={values[i]} rows={3}
                                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                                    className="flex-1 resize-y rounded-control border border-transparent bg-surface-inset px-3 py-2 text-[13.5px] font-medium leading-relaxed text-k-text-primary outline-none transition hover:border-k-border-subtle focus:border-primary focus:bg-surface-card" />
                            ) : (
                                <span className="relative flex-1">
                                    <input value={values[i]}
                                        onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                                        className="w-full rounded-control border border-transparent bg-surface-inset px-3 py-2 pr-8 text-[13.5px] font-medium text-k-text-primary outline-none transition hover:border-k-border-subtle focus:border-primary focus:bg-surface-card" />
                                    <PenLine className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-k-text-quaternary" strokeWidth={2} />
                                </span>
                            )}
                        </label>
                    )
                })}
            </div>
            <div className="mt-4 flex items-center gap-2">
                <button onClick={approve}
                    className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:opacity-90">
                    <Check className="h-4 w-4" strokeWidth={2.4} /> {request.approveLabel}
                </button>
                <button onClick={cancel}
                    className="rounded-control border border-k-border-subtle px-3.5 py-2 text-[12.5px] font-semibold text-k-text-secondary transition hover:bg-surface-inset">
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
            <div className={`${base} border-[#DDD6FE] bg-primary/[0.05] text-k-text-primary dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-foreground`}>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                    {interim ? <em className="not-italic text-k-text-secondary dark:text-muted-foreground">{interim}</em> : 'Ouvindo… pode falar.'}
                </span>
                <button onClick={onStop} className="shrink-0 text-[12px] font-semibold text-k-text-tertiary transition hover:text-k-text-primary dark:text-muted-foreground dark:hover:text-foreground">Sair</button>
            </div>
        )
    }
    if (state === 'thinking') {
        return (
            <div className={`${base} border-k-border-subtle bg-surface-inset text-k-text-secondary dark:border-k-border-subtle dark:bg-glass-bg dark:text-muted-foreground`}>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary dark:text-violet-400" strokeWidth={2.2} />
                <span className="flex-1">Pensando…</span>
                <button onClick={onStop} className="shrink-0 text-[12px] font-semibold text-k-text-tertiary transition hover:text-k-text-primary dark:text-muted-foreground dark:hover:text-foreground">Sair</button>
            </div>
        )
    }
    if (state === 'speaking') {
        return (
            <button onClick={onInterrupt} className={`${base} border-[#DDD6FE] bg-primary/[0.05] text-left text-k-text-primary transition hover:bg-primary/[0.09] dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-foreground`}>
                <Volume2 className="h-4 w-4 shrink-0 animate-pulse text-primary dark:text-violet-400" strokeWidth={2} />
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
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/45 [animation-delay:300ms]" />
        </div>
    )
}

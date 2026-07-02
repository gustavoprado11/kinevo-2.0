'use client'

/**
 * AssistantPanelContent — aba Assistente do dock lateral (UnifiedCommunicationPanel).
 *
 * Onda 4: o dock usa o MESMO motor da página /assistente (useAssistantThread →
 * /api/assistant/conversations: 57 tools MCP, HITL, streaming NDJSON, threads
 * persistidas). O legado /api/assistant/chat (3 tools, sem HITL, sem memória)
 * morreu. Começar aqui e continuar full-screen é a mesma conversa — o link
 * "Abrir no Assistente" leva a /assistente?c=<id>.
 *
 * Escopo: quem abre o dock a partir de um aluno/insight (communication-store)
 * já entra com a conversa escopada; o insight vira um cartão de contexto +
 * chips de ação rápida (paridade com o comportamento antigo).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Send, ExternalLink, MessagesSquare, Loader2 } from 'lucide-react'
import { useCommunicationStore } from '@/stores/communication-store'
import { AssistantBanner } from '@/components/assistant/workspace/assistant-banner'
import { ConversationView } from '@/components/assistant/workspace/conversation-view'
import { useAssistantThread, type ThreadStudent } from '@/components/assistant/workspace/use-assistant-thread'
import { fetchAiAccess } from '@/components/assistant/command-bar/command-bar'
import type { ConversationListItem } from '@/lib/assistant/conversations'

// ── Chips de ação rápida por categoria do insight (paridade com o dock antigo) ──

const INSIGHT_CHIPS: Record<string, string[]> = {
    gap_alert: ['Sugerir mensagem de follow-up', 'Analisar histórico do aluno'],
    stagnation: ['Sugerir nova carga', 'Analisar tendência de progressão'],
    ready_to_progress: ['Sugerir como progredir', 'Analisar tendência de progressão'],
    program_expiring: ['Analisar progresso do programa', 'Sugerir próximo programa'],
    pain_report: ['Analisar relatório de dor', 'Sugerir ajustes no programa'],
}

function getChipsForInsight(insightId: string | null): string[] {
    if (!insightId) return []
    for (const key of Object.keys(INSIGHT_CHIPS)) {
        if (insightId.startsWith(key)) return INSIGHT_CHIPS[key]
    }
    return []
}

const GENERAL_CHIPS = ['Quem precisa de atenção?', 'Alunos sem treino ativo', 'Resumo de adesão da semana']

function chipsForScope(insightId: string | null, studentName: string | null): string[] {
    const fromInsight = getChipsForInsight(insightId)
    if (fromInsight.length > 0) return fromInsight
    if (studentName) {
        const first = studentName.split(' ')[0]
        return [`Como está a evolução de ${first}?`, `Gerar um treino para ${first}`, `Enviar uma mensagem para ${first}`]
    }
    return GENERAL_CHIPS
}

export function AssistantPanelContent() {
    const router = useRouter()
    const { studentId, studentName, insightId, initialMessage, closePanel } = useCommunicationStore()
    const [railStudents, setRailStudents] = useState<ThreadStudent[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    // O aluno do escopo entra na lista mesmo antes do rail-data responder — é ele
    // que nomeia a conversa otimista criada no primeiro envio.
    const students = useMemo<ThreadStudent[]>(() => {
        if (studentId && studentName && !railStudents.some((s) => s.id === studentId)) {
            return [{ id: studentId, name: studentName }, ...railStudents]
        }
        return railStudents
    }, [studentId, studentName, railStudents])

    const thread = useAssistantThread({ students })
    const {
        summary, setSummary,
        conversations, setConversations,
        activeId, active,
        messages, loadingMessages,
        input, setInput,
        sending, liveSteps, liveText, textResetCount,
        banner, dismissBanner,
        selectConversation, selectStudent, goHome,
        renameActive, send, sendVoice, stop, starter, recordConfirmation,
    } = thread

    // Hidratação ao abrir o painel: medidor de créditos + alunos/conversas.
    useEffect(() => {
        let on = true
        void fetchAiAccess().then((a) => { if (on && a?.summary) setSummary(a.summary) })
        void fetch('/api/assistant/rail-data')
            .then(async (res) => {
                if (!res.ok || !on) return
                const data = await res.json().catch(() => null) as { students?: Array<{ id: string; name: string }>; conversations?: ConversationListItem[] } | null
                if (!data || !on) return
                if (Array.isArray(data.students)) setRailStudents(data.students.map((s) => ({ id: s.id, name: s.name })))
                if (Array.isArray(data.conversations)) setConversations(data.conversations)
            })
            .catch(() => { /* painel segue funcional; a lista fica vazia */ })
        return () => { on = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Escopo vindo de quem abriu o dock (perfil do aluno, card de insight, busca).
    useEffect(() => {
        if (studentId) selectStudent(studentId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId])

    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 300)
        return () => clearTimeout(t)
    }, [])

    const openFull = () => {
        closePanel()
        router.push(activeId ? `/assistente?c=${activeId}` : '/assistente')
    }

    const chips = chipsForScope(insightId, studentName)
    const recents = conversations.slice(0, 4)

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        void send()
    }

    return (
        <div className="flex h-full flex-col">
            {/* Contexto + continuidade full-screen */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                </div>
                <p className="min-w-0 flex-1 truncate text-[11px] leading-tight text-muted-foreground">
                    {studentName ? `Sobre: ${studentName}` : 'Todos os alunos'}
                </p>
                <button
                    onClick={openFull}
                    className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-400"
                    title="Continuar esta conversa em tela cheia"
                >
                    <ExternalLink className="h-3 w-3" />
                    Abrir no Assistente
                </button>
            </div>

            {active ? (
                summary ? (
                    <ConversationView
                        active={active}
                        summary={summary}
                        messages={messages}
                        loadingMessages={loadingMessages}
                        sending={sending}
                        liveSteps={liveSteps}
                        liveText={liveText}
                        textResetCount={textResetCount}
                        input={input}
                        trainerName={null}
                        students={students}
                        banner={banner}
                        onDismissBanner={dismissBanner}
                        onInput={setInput}
                        onSend={() => send()}
                        onStop={stop}
                        onSendText={starter}
                        onBackHome={goHome}
                        onRename={renameActive}
                        onConfirmResolved={recordConfirmation}
                        onVoiceTurn={sendVoice}
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
                    </div>
                )
            ) : (
                <>
                    {/* Home compacta do dock */}
                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        {initialMessage ? (
                            // Contexto do insight que abriu o dock (voz do assistente) —
                            // cartão visual, não mensagem persistida.
                            <div className="flex gap-2">
                                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                                    <Sparkles className="h-3 w-3 text-violet-500" />
                                </div>
                                <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                                    {initialMessage}
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
                                    <Sparkles className="h-6 w-6 text-violet-500" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {studentName
                                        ? `Pergunte ou peça algo sobre ${studentName}`
                                        : 'Peça qualquer coisa: analisar alunos, gerar treinos, enviar mensagens…'}
                                </p>
                                {recents.length > 0 && (
                                    <div className="mt-2 w-full">
                                        <p className="mb-2 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                                            Conversas recentes
                                        </p>
                                        <div className="space-y-1.5">
                                            {recents.map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => selectConversation(c.id)}
                                                    className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted"
                                                >
                                                    <MessagesSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-[13px] font-medium text-foreground">{c.title}</span>
                                                        {c.studentName && (
                                                            <span className="block truncate text-[11px] text-muted-foreground">{c.studentName}</span>
                                                        )}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Chips de ação rápida (enviam na hora, como no dock antigo) */}
                    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                        {chips.map((chip) => (
                            <button
                                key={chip}
                                onClick={() => { if (!sending) starter(chip) }}
                                disabled={sending}
                                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>

                    {/* Muro de cota/tier (402/403) — nunca engolir em silêncio. */}
                    {banner && (
                        <div className="px-4 pb-1">
                            <AssistantBanner data={banner} onDismiss={dismissBanner} />
                        </div>
                    )}

                    {/* Composer */}
                    <div className="border-t border-border px-4 py-3">
                        <form onSubmit={submit} className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={studentName ? `O que fazer com ${studentName.split(' ')[0]}?` : 'Pergunte ou peça algo…'}
                                disabled={sending}
                                className="flex-1 rounded-full border border-border bg-muted px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={sending || !input.trim()}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    )
}

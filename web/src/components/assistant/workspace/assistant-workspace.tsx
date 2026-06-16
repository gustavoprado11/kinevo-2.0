'use client'

/**
 * AssistantWorkspace — aba dedicada do Assistente (IA do Treinador), client.
 *
 * Layout 2 colunas (a sidebar do Kinevo vem do AppLayout): threads + conversa.
 * Conversa multi-turno e persistida via /api/assistant/conversations[/id]; mesmo
 * motor MCP+HITL do ⌘K (surface 'workspace'). Reaproveita CreditMeter e
 * ToolConfirmationCard. Estilo fiel ao mock light (Apple HIG, roxo #7C3AED).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Sparkles, Plus, Search, Check, Send,
    Loader2, MessageSquarePlus, Users, X,
} from 'lucide-react'
import { CreditMeter } from '@/components/assistant/credit-meter'
import { ToolConfirmationCard } from '@/components/assistant/tool-confirmation-card'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type {
    ConversationListItem,
    AssistantMessage,
    AssistantMessagePart,
} from '@/lib/assistant/conversations'

interface StudentLite { id: string; name: string }

interface Props {
    initialSummary: AiUsageSummary
    initialConversations: ConversationListItem[]
    students: StudentLite[]
    trainerName: string | null
}

// ── Avatares (cores derivadas do nome) ──────────────────────────────────────
const AV_GRADIENTS = [
    'linear-gradient(135deg,#FF6482,#FF2D92)',
    'linear-gradient(135deg,#0A84FF,#06B6D4)',
    'linear-gradient(135deg,#30D158,#A3E635)',
    'linear-gradient(135deg,#FF9F0A,#FF6482)',
    'linear-gradient(135deg,#7C3AED,#A78BFA)',
    'linear-gradient(135deg,#5E5CE6,#0A84FF)',
]
function avatarFor(name: string | null): { initials: string; bg: string } {
    const n = (name ?? '').trim()
    const initials = n
        ? n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
        : '?'
    let hash = 0
    for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0
    return { initials: initials || '?', bg: AV_GRADIENTS[hash % AV_GRADIENTS.length] }
}

// ── Agrupamento de threads por recência ─────────────────────────────────────
function startOfDay(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
function groupLabel(iso: string): string {
    const today = startOfDay(new Date())
    const day = startOfDay(new Date(iso))
    const diff = Math.round((today - day) / 86400000)
    if (diff <= 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    if (diff <= 7) return 'Semana passada'
    return 'Anteriores'
}
const GROUP_ORDER = ['Hoje', 'Ontem', 'Semana passada', 'Anteriores']
function timeShort(iso: string): string {
    const d = new Date(iso)
    const today = startOfDay(new Date())
    const day = startOfDay(d)
    if (day === today) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const diff = Math.round((today - day) / 86400000)
    if (diff === 1) return 'ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Rótulos amigáveis das ações executadas ──────────────────────────────────
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

export function AssistantWorkspace({ initialSummary, initialConversations, students, trainerName }: Props) {
    const [summary, setSummary] = useState(initialSummary)
    const [conversations, setConversations] = useState(initialConversations)
    const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null)
    const [messages, setMessages] = useState<AssistantMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickerQuery, setPickerQuery] = useState('')
    const [errorBanner, setErrorBanner] = useState<string | null>(null)

    const streamRef = useRef<HTMLDivElement>(null)
    const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId])

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight
        })
    }, [])

    // Carrega mensagens ao trocar de thread.
    const loadMessages = useCallback(async (id: string) => {
        setLoadingMessages(true)
        try {
            const res = await fetch(`/api/assistant/conversations/${id}`)
            if (res.ok) {
                const data = await res.json()
                setMessages(data.messages ?? [])
            } else {
                setMessages([])
            }
        } catch {
            setMessages([])
        } finally {
            setLoadingMessages(false)
            scrollToBottom()
        }
    }, [scrollToBottom])

    useEffect(() => {
        if (activeId) loadMessages(activeId)
        else setMessages([])
    }, [activeId, loadMessages])

    const grouped = useMemo(() => {
        const map = new Map<string, ConversationListItem[]>()
        for (const c of conversations) {
            const label = groupLabel(c.last_message_at)
            if (!map.has(label)) map.set(label, [])
            map.get(label)!.push(c)
        }
        return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }))
    }, [conversations])

    // Cria nova conversa (Geral ou com aluno).
    const createConversation = useCallback(async (studentId: string | null) => {
        setPickerOpen(false); setPickerQuery('')
        try {
            const res = await fetch('/api/assistant/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentId ? { studentId } : {}),
            })
            if (!res.ok) return
            const { conversation } = await res.json()
            const student = studentId ? students.find((s) => s.id === studentId) : null
            const item: ConversationListItem = { ...conversation, studentName: student?.name ?? null }
            setConversations((prev) => [item, ...prev])
            setMessages([])
            setActiveId(item.id)
        } catch { /* noop */ }
    }, [students])

    // Envia um turno.
    const send = useCallback(async () => {
        const text = input.trim()
        if (!text || sending || !activeId) return
        setInput(''); setSending(true); setErrorBanner(null)

        const optimistic: AssistantMessage = {
            id: `tmp-${Date.now()}`, role: 'user', content: text, parts: [], credits_cost: 0,
            created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, optimistic])
        scrollToBottom()

        try {
            const res = await fetch(`/api/assistant/conversations/${activeId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: text }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setErrorBanner(data?.message ?? 'Não foi possível processar a mensagem.')
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
                return
            }
            setMessages((prev) => {
                const withoutTmp = prev.filter((m) => m.id !== optimistic.id)
                const next = [...withoutTmp]
                if (data.userMessage) next.push(data.userMessage)
                if (data.message) next.push(data.message)
                return next
            })
            if (data.summary) setSummary(data.summary)
            // Atualiza a thread na lista (sobe + título).
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === activeId)
                if (idx < 0) return prev
                const updated = { ...prev[idx], last_message_at: new Date().toISOString() }
                if (updated.title === 'Nova conversa') updated.title = text.slice(0, 70)
                const rest = prev.filter((c) => c.id !== activeId)
                return [updated, ...rest]
            })
        } catch {
            setErrorBanner('Falha de conexão.')
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        } finally {
            setSending(false)
            scrollToBottom()
        }
    }, [input, sending, activeId, scrollToBottom])

    // Persiste o desfecho de uma confirmação HITL.
    const recordConfirmation = useCallback(async (toolName: string, confirmed: boolean, result?: unknown) => {
        if (!activeId) return
        try {
            const res = await fetch(`/api/assistant/conversations/${activeId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: { toolName, status: confirmed ? 'confirmed' : 'cancelled', result } }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.message) setMessages((prev) => [...prev, data.message])
        } catch { /* noop */ }
        scrollToBottom()
    }, [activeId, scrollToBottom])

    const filteredStudents = useMemo(() => {
        const q = pickerQuery.trim().toLowerCase()
        if (!q) return students.slice(0, 50)
        return students.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 50)
    }, [students, pickerQuery])

    const trainerAv = avatarFor(trainerName)

    return (
        <div className="-m-8 grid h-[100dvh] grid-cols-[290px_1fr] overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">

            {/* ── THREADS ── */}
            <aside className="flex min-h-0 flex-col border-r border-[#E8E8ED] bg-white">
                <div className="px-[18px] pb-1 pt-[22px]">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#EDE9FE]">
                            <Sparkles className="h-[17px] w-[17px] text-[#7C3AED]" strokeWidth={1.8} />
                        </span>
                        <div>
                            <b className="block text-[16px] font-bold tracking-tight">Assistente</b>
                            <span className="text-[11.5px] text-[#86868B]">Opere o Kinevo conversando</span>
                        </div>
                    </div>
                </div>

                {/* Nova conversa + picker */}
                <div className="relative px-[18px]">
                    <button
                        onClick={() => setPickerOpen((v) => !v)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.5)] transition hover:brightness-105"
                    >
                        <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} /> Nova conversa
                    </button>
                    {pickerOpen && (
                        <div className="absolute left-[18px] right-[18px] z-30 mt-2 overflow-hidden rounded-[14px] border border-[#E8E8ED] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
                            <div className="flex items-center gap-2 border-b border-[#F0F0F3] px-3 py-2">
                                <Search className="h-[14px] w-[14px] text-[#AEAEB2]" strokeWidth={1.9} />
                                <input
                                    autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)}
                                    placeholder="Buscar aluno…"
                                    className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#AEAEB2]"
                                />
                                <button onClick={() => setPickerOpen(false)}><X className="h-[14px] w-[14px] text-[#AEAEB2]" /></button>
                            </div>
                            <div className="max-h-[280px] overflow-y-auto py-1">
                                <button
                                    onClick={() => createConversation(null)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#F5F5F7]"
                                >
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                                        <Sparkles className="h-[14px] w-[14px]" strokeWidth={2} />
                                    </span>
                                    <span className="text-[13px] font-medium">Geral · visão do estúdio</span>
                                </button>
                                {filteredStudents.map((s) => {
                                    const av = avatarFor(s.name)
                                    return (
                                        <button key={s.id} onClick={() => createConversation(s.id)}
                                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#F5F5F7]">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: av.bg }}>{av.initials}</span>
                                            <span className="truncate text-[13px] font-medium">{s.name}</span>
                                        </button>
                                    )
                                })}
                                {filteredStudents.length === 0 && (
                                    <p className="px-3 py-3 text-[12px] text-[#AEAEB2]">Nenhum aluno encontrado.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Lista de threads */}
                <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
                    {conversations.length === 0 && (
                        <p className="px-3 py-6 text-center text-[12.5px] text-[#AEAEB2]">
                            Nenhuma conversa ainda.<br />Crie uma para começar.
                        </p>
                    )}
                    {grouped.map((group) => (
                        <div key={group.label}>
                            <div className="px-2 pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.09em] text-[#AEAEB2]">{group.label}</div>
                            {group.items.map((c) => {
                                const av = avatarFor(c.studentName)
                                const isGeneral = !c.student_id
                                const isOn = c.id === activeId
                                return (
                                    <button key={c.id} onClick={() => setActiveId(c.id)}
                                        className={`mb-0.5 flex w-full items-center gap-2.5 rounded-[12px] p-2.5 text-left transition ${isOn ? 'border border-[rgba(124,58,237,0.16)] bg-[rgba(124,58,237,0.06)]' : 'border border-transparent hover:bg-[#F5F5F7]'}`}>
                                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold text-white"
                                            style={{ background: isGeneral ? 'linear-gradient(135deg,#7C3AED,#A78BFA)' : av.bg }}>
                                            {isGeneral ? <Sparkles className="h-4 w-4" strokeWidth={2} /> : av.initials}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-1.5">
                                                <span className={`truncate text-[13px] font-semibold ${isOn ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'}`}>
                                                    {c.studentName ?? (isGeneral ? 'Geral · estúdio' : c.title)}
                                                </span>
                                                <span className="ml-auto shrink-0 text-[10.5px] text-[#AEAEB2]">{timeShort(c.last_message_at)}</span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-[11.5px] text-[#86868B]">{c.title}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </aside>

            {/* ── CONVERSA ── */}
            <main className="flex min-h-0 flex-col bg-[#F5F5F7]">
                {/* header */}
                <header className="flex items-center gap-3.5 border-b border-[#E8E8ED] bg-white/70 px-6 py-3.5 backdrop-blur">
                    {active ? (
                        <div className="flex items-center gap-2.5 rounded-[12px] border border-[#D2D2D7] bg-white px-3 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[12px] font-bold text-white"
                                style={{ background: active.student_id ? avatarFor(active.studentName).bg : 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                                {active.student_id ? avatarFor(active.studentName).initials : <Sparkles className="h-4 w-4" strokeWidth={2} />}
                            </span>
                            <div>
                                <b className="block text-[13.5px] tracking-tight">{active.studentName ?? 'Geral · visão do estúdio'}</b>
                                <span className="text-[10.5px] text-[#86868B]">{active.student_id ? 'Conversa sobre o aluno' : 'Todos os alunos'}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[14px] font-semibold text-[#6E6E73]">Assistente</div>
                    )}
                    <div className="flex-1" />
                    <div className="hidden w-[260px] sm:block">
                        <CreditMeter summary={summary} compact />
                    </div>
                </header>

                {errorBanner && (
                    <div className="mx-6 mt-3 rounded-xl border border-[#F5C2C0] bg-[#FEF2F2] px-4 py-2.5 text-[12.5px] font-medium text-[#B91C1C]">
                        {errorBanner}
                    </div>
                )}

                {/* stream */}
                <div ref={streamRef} className="flex-1 overflow-y-auto py-7">
                    <div className="mx-auto max-w-[768px] px-7">
                        {!active && <EmptyState onNew={() => setPickerOpen(true)} />}
                        {active && messages.length === 0 && !loadingMessages && (
                            <StarterState studentName={active.studentName} />
                        )}
                        {loadingMessages && (
                            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#AEAEB2]" /></div>
                        )}
                        {messages.map((m) => (
                            <MessageRow key={m.id} message={m} trainerAv={trainerAv} onConfirmResolved={recordConfirmation} />
                        ))}
                        {sending && <TypingRow />}
                    </div>
                </div>

                {/* composer */}
                <div className="border-t border-[#E8E8ED] bg-white/80 py-3.5 backdrop-blur">
                    <div className="mx-auto max-w-[768px] px-7">
                        <div className={`flex items-center gap-2.5 rounded-[15px] border bg-white px-2 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition ${active ? 'border-[#D2D2D7] focus-within:border-[#7C3AED] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.1)]' : 'border-[#E8E8ED] opacity-60'}`}>
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                                disabled={!active || sending}
                                placeholder={active ? (active.studentName ? `Diga o que fazer com ${active.studentName.split(' ')[0]}…` : 'Diga o que fazer no Kinevo…') : 'Crie ou selecione uma conversa para começar'}
                                className="flex-1 bg-transparent px-2 py-2 text-[14.5px] outline-none placeholder:text-[#AEAEB2]"
                            />
                            <button
                                onClick={send} disabled={!active || sending || !input.trim()}
                                className="flex h-[38px] items-center gap-2 rounded-[11px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-[18px] text-[13.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] transition hover:brightness-105 disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2} />} Agir
                            </button>
                        </div>
                        <div className="mt-2.5 flex justify-center gap-5 text-[10.5px] text-[#AEAEB2]">
                            <span><kbd className="rounded border border-[#E8E8ED] bg-white px-1.5 font-mono text-[#86868B]">Enter</kbd> enviar</span>
                            <span><kbd className="rounded border border-[#E8E8ED] bg-white px-1.5 font-mono text-[#86868B]">⌘K</kbd> ação rápida na tela atual</span>
                            <span>ações sensíveis sempre pedem confirmação</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

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
                        <div className="inline-block rounded-[14px] rounded-tl-[5px] border border-[#E8E8ED] bg-white px-4 py-3 text-[14.5px] leading-relaxed shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                            {message.content}
                        </div>
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
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34C759]">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                )}
                <span className="font-semibold">{executedText(part)}</span>
            </div>
        )
    }
    // confirmation
    if (part.status === 'pending') {
        return (
            <div className="mt-3.5">
                <ToolConfirmationCard
                    request={part.request}
                    surface="workspace"
                    onResolved={(result, toolResult) => onConfirmResolved(part.request.toolName, result.confirmed, toolResult)}
                />
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
            <div className="flex items-center gap-1.5 pt-2 text-[#86868B]">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A78BFA] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A78BFA] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#A78BFA] [animation-delay:300ms]" />
            </div>
        </div>
    )
}

function EmptyState({ onNew }: { onNew: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EDE9FE]">
                <Sparkles className="h-8 w-8 text-[#7C3AED]" strokeWidth={1.6} />
            </span>
            <h2 className="text-[20px] font-bold tracking-tight">Seu Assistente do Kinevo</h2>
            <p className="mt-2 max-w-[420px] text-[14px] text-[#6E6E73]">
                Converse para operar o Kinevo: analisar alunos, ajustar treinos, lançar pagamentos, agendar sessões — com confirmação nas ações sensíveis.
            </p>
            <button onClick={onNew} className="mt-6 inline-flex items-center gap-2 rounded-[11px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] transition hover:brightness-105">
                <MessageSquarePlus className="h-[18px] w-[18px]" strokeWidth={2} /> Nova conversa
            </button>
        </div>
    )
}

function StarterState({ studentName }: { studentName: string | null }) {
    const first = studentName?.split(' ')[0]
    const suggestions = studentName
        ? [`Como está a evolução ${first ? `da ${first}` : 'do aluno'} nas últimas semanas?`,
           `Gere um novo programa de treino`,
           `Tem algum alerta sobre ${first ?? 'esse aluno'}?`]
        : ['Quem está inadimplente este mês?', 'Qual o MRR atual?', 'Quais alunos estão sem treino ativo?']
    return (
        <div className="py-10">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#86868B]">
                <Users className="h-4 w-4" /> Comece por aqui
            </div>
            <div className="mt-3 flex flex-col gap-2">
                {suggestions.map((s) => (
                    <div key={s} className="rounded-[12px] border border-[#E8E8ED] bg-white px-4 py-3 text-[13.5px] text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                        {s}
                    </div>
                ))}
            </div>
        </div>
    )
}

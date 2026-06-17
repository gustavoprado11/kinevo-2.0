'use client'

/**
 * AssistantWorkspace — conteúdo do Dashboard no modo Assistente.
 *
 * Renderiza DENTRO do AppLayout (a navegação/toggle/perfil vêm da Sidebar global).
 * Aqui só o que é exclusivo do chat: o rail de Conversas/Alunos + a área principal
 * (home OU conversa). Detém o estado e os handlers (criar/abrir conversa, enviar
 * turno, HITL). O toggle de modo agora vive na Sidebar global, não aqui.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setHomeStyle } from '@/actions/assistant/set-home-style'
import { setCachedAiAllowed, setCachedHomeStyle } from '@/components/assistant/command-bar/command-bar'
import type { SidebarStudent } from './assistant-rail'
import { AssistantSidebar } from './assistant-sidebar'
import { AssistantHome } from './assistant-home'
import { ConversationView } from './conversation-view'
import { bannerFromError, type AssistantBannerData } from './assistant-banner'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem, AssistantMessage } from '@/lib/assistant/conversations'

interface StudentLite { id: string; name: string; status: string; avatarUrl: string | null }

interface Props {
    initialSummary: AiUsageSummary
    initialConversations: ConversationListItem[]
    students: StudentLite[]
    attention: AttentionItem[]
    trainerName: string | null
    trainerEmail: string | null
    trainerAvatarUrl: string | null
}

export function AssistantWorkspace({ initialSummary, initialConversations, students, attention, trainerName, trainerEmail, trainerAvatarUrl }: Props) {
    const router = useRouter()
    const [summary, setSummary] = useState(initialSummary)
    const [conversations, setConversations] = useState(initialConversations)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [messages, setMessages] = useState<AssistantMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [segment, setSegment] = useState<'alunos' | 'conversas'>('alunos')
    const [search, setSearch] = useState('')
    const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null)
    const [error, setError] = useState<AssistantBannerData | null>(null)

    const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId])
    const focusedStudentName = useMemo(
        () => (focusedStudentId ? students.find((s) => s.id === focusedStudentId)?.name ?? null : null),
        [focusedStudentId, students],
    )

    // Alunos do rail: pinta de âmbar quem tem insight ativo (precisa de atenção).
    const attentionByStudent = useMemo(() => {
        const m = new Map<string, string>()
        for (const a of attention) if (a.studentId && !m.has(a.studentId)) m.set(a.studentId, a.title)
        return m
    }, [attention])

    const railStudents: SidebarStudent[] = useMemo(
        () => students.map((s) => {
            const att = attentionByStudent.get(s.id)
            return {
                id: s.id,
                name: s.name,
                avatarUrl: s.avatarUrl,
                dot: att ? 'amber' : s.status && s.status !== 'active' ? 'amber' : 'green',
                subtitle: att ?? '',
            }
        }),
        [students, attentionByStudent],
    )

    const recents = useMemo(() => conversations.slice(0, 5), [conversations])

    const loadMessages = useCallback(async (id: string) => {
        setLoadingMessages(true)
        try {
            const res = await fetch(`/api/assistant/conversations/${id}`)
            setMessages(res.ok ? (await res.json()).messages ?? [] : [])
        } catch { setMessages([]) } finally { setLoadingMessages(false) }
    }, [])

    const selectConversation = useCallback((id: string) => {
        const conv = conversations.find((c) => c.id === id)
        setActiveId(id)
        setFocusedStudentId(conv?.student_id ?? null)
        loadMessages(id)
    }, [conversations, loadMessages])

    const selectStudent = useCallback((id: string) => {
        setFocusedStudentId(id)
        setActiveId(null)
        setMessages([])
    }, [])

    const goHome = useCallback(() => { setActiveId(null); setMessages([]) }, [])
    // Nova conversa: home limpa (sem conversa, sem aluno em foco, input vazio).
    const newConversation = useCallback(() => { setActiveId(null); setFocusedStudentId(null); setMessages([]); setInput('') }, [])

    // Toggle → Clássico: navegação ótimista (?h=classic evita bounce ao Assistente
    // enquanto a preferência sincroniza em background). O pill mostra spinner.
    const [isSwitching, startSwitch] = useTransition()
    const toggleClassic = useCallback(() => {
        setCachedHomeStyle('classic')
        void setHomeStyle('classic')
        startSwitch(() => { router.push('/dashboard?h=classic') })
    }, [router])

    const send = useCallback(async (override?: string) => {
        const text = (override ?? input).trim()
        if (!text || sending) return
        if (!override) setInput('')
        setError(null)
        setSending(true)

        let convId = activeId
        try {
            if (!convId) {
                const res = await fetch('/api/assistant/conversations', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(focusedStudentId ? { studentId: focusedStudentId } : {}),
                })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    setError(bannerFromError(res.status, data))
                    if (!override) setInput(text) // devolve o texto p/ o usuário reenviar
                    setSending(false)
                    return
                }
                const { conversation } = await res.json()
                const sname = focusedStudentId ? students.find((s) => s.id === focusedStudentId)?.name ?? null : null
                const item: ConversationListItem = { ...conversation, studentName: sname }
                setConversations((prev) => [item, ...prev])
                setActiveId(conversation.id)
                setMessages([])
                convId = conversation.id
            }

            const optimistic: AssistantMessage = {
                id: `tmp-${Date.now()}`, role: 'user', content: text, parts: [], credits_cost: 0,
                created_at: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, optimistic])

            const res = await fetch(`/api/assistant/conversations/${convId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: text }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
                setError(bannerFromError(res.status, data))
                if (!override) setInput(text) // devolve o texto p/ o usuário reenviar
                return
            }
            setMessages((prev) => {
                const without = prev.filter((m) => m.id !== optimistic.id)
                const next = [...without]
                if (data.userMessage) next.push(data.userMessage)
                if (data.message) next.push(data.message)
                return next
            })
            if (data.summary) setSummary(data.summary)
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === convId)
                if (idx < 0) return prev
                const updated = { ...prev[idx], last_message_at: new Date().toISOString() }
                if (updated.title === 'Nova conversa') updated.title = text.slice(0, 70)
                return [updated, ...prev.filter((c) => c.id !== convId)]
            })
        } catch { /* noop */ } finally { setSending(false) }
    }, [input, sending, activeId, focusedStudentId, students])

    const starter = useCallback((prompt: string) => { void send(prompt) }, [send])
    // Cards da home: preenchem o composer p/ o treinador revisar/ajustar antes de
    // enviar (não disparam automaticamente).
    const fillInput = useCallback((prompt: string) => { setInput(prompt) }, [])

    // Renomear a conversa ativa (botão Pencil no header). Otimista + PATCH.
    const renameActive = useCallback(async () => {
        if (!activeId || typeof window === 'undefined') return
        const current = conversations.find((c) => c.id === activeId)
        const next = window.prompt('Renomear conversa', current?.title ?? '')?.trim()
        if (!next) return
        const title = next.slice(0, 70)
        setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, title } : c)))
        try {
            await fetch(`/api/assistant/conversations/${activeId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            })
        } catch { /* otimista; nome local já atualizado */ }
    }, [activeId, conversations])

    const recordConfirmation = useCallback(async (toolName: string, confirmed: boolean, result?: unknown) => {
        if (!activeId) return
        try {
            const res = await fetch(`/api/assistant/conversations/${activeId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: { toolName, status: confirmed ? 'confirmed' : 'cancelled', result } }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.message) setMessages((prev) => [...prev, data.message])
        } catch { /* noop */ }
    }, [activeId])

    // Estamos no Assistente (⇒ Pro+ + modo 'assistant'): semeia o cache do gate de
    // IA e do modo para a Sidebar global pintar o toggle correto já na 1ª pintura.
    useEffect(() => {
        setCachedAiAllowed(true)
        setCachedHomeStyle('assistant')
    }, [])

    // Banner ativo: erro de turno tem prioridade; senão cota esgotada (persistente).
    const banner: AssistantBannerData | null =
        error ?? (summary?.exhausted ? bannerFromError(402, {}) : null)

    return (
        <div className="kv-mode-in flex h-[100dvh] overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
            <AssistantSidebar
                trainerName={trainerName}
                trainerEmail={trainerEmail}
                trainerAvatarUrl={trainerAvatarUrl}
                students={railStudents}
                conversations={conversations}
                activeConversationId={activeId}
                focusedStudentId={focusedStudentId}
                segment={segment}
                search={search}
                onSegment={setSegment}
                onSearch={setSearch}
                onHome={goHome}
                onNewConversation={newConversation}
                onSelectStudent={selectStudent}
                onSelectConversation={selectConversation}
                onToggleClassic={toggleClassic}
                switchingClassic={isSwitching}
            />

            {active ? (
                <ConversationView
                    active={active}
                    summary={summary}
                    messages={messages}
                    loadingMessages={loadingMessages}
                    sending={sending}
                    input={input}
                    trainerName={trainerName}
                    students={students}
                    banner={banner}
                    onDismissBanner={() => setError(null)}
                    onInput={setInput}
                    onSend={() => send()}
                    onSendText={starter}
                    onBackHome={goHome}
                    onRename={renameActive}
                    onConfirmResolved={recordConfirmation}
                />
            ) : (
                <AssistantHome
                    trainerName={trainerName}
                    summary={summary}
                    attention={attention}
                    recents={recents}
                    focusedStudentName={focusedStudentName}
                    hasStudents={students.length > 0}
                    input={input}
                    sending={sending}
                    banner={banner}
                    onDismissBanner={() => setError(null)}
                    onInput={setInput}
                    onSend={() => send()}
                    onStarter={fillInput}
                    onPickFocus={() => setSegment('alunos')}
                    onClearFocus={() => setFocusedStudentId(null)}
                    onOpenConversation={selectConversation}
                />
            )}
        </div>
    )
}

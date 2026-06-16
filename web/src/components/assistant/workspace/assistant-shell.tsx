'use client'

/**
 * AssistantShell — orquestrador do modo Assistente (Cowork). Shell próprio
 * (sem AppLayout): sidebar (toggle/nav/Alunos/Conversas) + main (home OU chat).
 * Detém o estado e os handlers (criar/abrir conversa, enviar turno, HITL, toggle).
 */

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setHomeStyle } from '@/actions/assistant/set-home-style'
import { AssistantSidebar, type SidebarStudent } from './assistant-sidebar'
import { AssistantHome } from './assistant-home'
import { ConversationView } from './conversation-view'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem, AssistantMessage } from '@/lib/assistant/conversations'

interface StudentLite { id: string; name: string; status: string }

interface Props {
    initialSummary: AiUsageSummary
    initialConversations: ConversationListItem[]
    students: StudentLite[]
    attention: AttentionItem[]
    trainerName: string | null
}

export function AssistantShell({ initialSummary, initialConversations, students, attention, trainerName }: Props) {
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

    const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId])
    const focusedStudentName = useMemo(
        () => (focusedStudentId ? students.find((s) => s.id === focusedStudentId)?.name ?? null : null),
        [focusedStudentId, students],
    )

    // Alunos da sidebar: pinta de âmbar quem tem insight ativo (precisa de atenção).
    const attentionByStudent = useMemo(() => {
        const m = new Map<string, string>()
        for (const a of attention) if (a.studentId && !m.has(a.studentId)) m.set(a.studentId, a.title)
        return m
    }, [attention])

    const sidebarStudents: SidebarStudent[] = useMemo(
        () => students.map((s) => {
            const att = attentionByStudent.get(s.id)
            return {
                id: s.id,
                name: s.name,
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
    const newConversation = useCallback(() => { setActiveId(null); setFocusedStudentId(null); setMessages([]); setInput('') }, [])

    const send = useCallback(async (override?: string) => {
        const text = (override ?? input).trim()
        if (!text || sending) return
        if (!override) setInput('')
        setSending(true)

        let convId = activeId
        try {
            if (!convId) {
                const res = await fetch('/api/assistant/conversations', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(focusedStudentId ? { studentId: focusedStudentId } : {}),
                })
                if (!res.ok) { setSending(false); return }
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

    const chooseMode = useCallback(async (mode: 'classic' | 'assistant') => {
        await setHomeStyle(mode)
        if (mode === 'classic') router.push('/dashboard')
    }, [router])

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
            <AssistantSidebar
                trainerName={trainerName}
                students={sidebarStudents}
                conversations={conversations}
                activeConversationId={activeId}
                focusedStudentId={focusedStudentId}
                segment={segment}
                search={search}
                onSegment={setSegment}
                onSearch={setSearch}
                onNewConversation={newConversation}
                onSelectStudent={selectStudent}
                onSelectConversation={selectConversation}
                onToggleClassic={() => chooseMode('classic')}
                onToggleAssistant={() => chooseMode('assistant')}
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
                    onInput={setInput}
                    onSend={() => send()}
                    onBackHome={goHome}
                    onConfirmResolved={recordConfirmation}
                />
            ) : (
                <AssistantHome
                    trainerName={trainerName}
                    summary={summary}
                    attention={attention}
                    recents={recents}
                    focusedStudentName={focusedStudentName}
                    input={input}
                    sending={sending}
                    onInput={setInput}
                    onSend={() => send()}
                    onStarter={starter}
                    onPickFocus={() => setSegment('alunos')}
                    onClearFocus={() => setFocusedStudentId(null)}
                    onOpenConversation={selectConversation}
                />
            )}
        </div>
    )
}

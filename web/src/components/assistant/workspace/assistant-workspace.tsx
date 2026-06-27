'use client'

/**
 * AssistantWorkspace — casca própria do modo Assistente (tela de chat).
 *
 * Coluna única conversa-first: a AssistantSidebar (marca + toggle + "Nova
 * conversa" + "Ir para…" + Alunos/Conversas + perfil) à esquerda e a área
 * principal (home OU conversa) à direita. Detém o estado e os handlers
 * (criar/abrir conversa, enviar turno, HITL).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    const searchParams = useSearchParams()
    const [summary, setSummary] = useState(initialSummary)
    const [conversations, setConversations] = useState(initialConversations)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [messages, setMessages] = useState<AssistantMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [liveSteps, setLiveSteps] = useState<string[]>([])
    const [segment, setSegment] = useState<'alunos' | 'conversas'>('alunos')
    const [search, setSearch] = useState('')
    const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null)
    const [error, setError] = useState<AssistantBannerData | null>(null)
    const abortRef = useRef<AbortController | null>(null) // U-STOP: turno em andamento
    const [creditWarnDismissed, setCreditWarnDismissed] = useState(false) // U-CRED

    const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId])

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

    // Excluir conversa: soft-delete (arquiva) — sai da lista, reversível no banco.
    // Otimista: remove localmente já; se estava aberta, volta pra home.
    const deleteConversation = useCallback(async (id: string) => {
        if (typeof window !== 'undefined' && !window.confirm('Excluir esta conversa? Ela sairá da sua lista.')) return
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (activeId === id) { setActiveId(null); setMessages([]) }
        try {
            await fetch(`/api/assistant/conversations/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: true }),
            })
        } catch { /* otimista; já removida localmente */ }
    }, [activeId])

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
        const clientMessageId = crypto.randomUUID() // C4: idempotência do turno (anti re-envio)
        const ac = new AbortController() // U-STOP: permite Parar o turno
        abortRef.current = ac
        let optimisticId = ''

        let convId = activeId
        try {
            if (!convId) {
                const res = await fetch('/api/assistant/conversations', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(focusedStudentId ? { studentId: focusedStudentId } : {}),
                    signal: ac.signal,
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
            optimisticId = optimistic.id
            setMessages((prev) => [...prev, optimistic])

            const res = await fetch(`/api/assistant/conversations/${convId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: text, clientMessageId }),
                signal: ac.signal,
            })
            // Erros de setup (gate/cota/rate/validação) vêm como JSON não-2xx.
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}))
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
                setError(bannerFromError(res.status, data))
                if (!override) setInput(text) // devolve o texto p/ o usuário reenviar
                return
            }
            // Stream NDJSON: {type:'progress'} ao vivo + {type:'done'} no fim.
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let final: { userMessage?: AssistantMessage; message?: AssistantMessage; summary?: AiUsageSummary } | null = null
            let streamError = false
            for (;;) {
                const { value, done: rdDone } = await reader.read()
                if (rdDone) break
                buffer += decoder.decode(value, { stream: true })
                let nl: number
                while ((nl = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, nl).trim()
                    buffer = buffer.slice(nl + 1)
                    if (!line) continue
                    let ev: { type?: string; label?: string; userMessage?: AssistantMessage; message?: AssistantMessage; summary?: AiUsageSummary }
                    try { ev = JSON.parse(line) } catch { continue }
                    if (ev.type === 'progress' && ev.label) setLiveSteps((s) => [...s, ev.label as string])
                    else if (ev.type === 'done') final = ev
                    else if (ev.type === 'error') streamError = true
                }
            }
            setLiveSteps([])
            if (streamError || !final) {
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
                setError(bannerFromError(500, {}))
                if (!override) setInput(text)
                return
            }
            setMessages((prev) => {
                const without = prev.filter((m) => m.id !== optimistic.id)
                const next = [...without]
                if (final!.userMessage) next.push(final!.userMessage)
                if (final!.message) next.push(final!.message)
                return next
            })
            if (final.summary) setSummary(final.summary)
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === convId)
                if (idx < 0) return prev
                const updated = { ...prev[idx], last_message_at: new Date().toISOString() }
                if (updated.title === 'Nova conversa') updated.title = text.slice(0, 70)
                return [updated, ...prev.filter((c) => c.id !== convId)]
            })
        } catch (e) {
            // U-ERR: não engole a falha. Parar (AbortError) é intencional — mantém a msg
            // do usuário; a resposta, se concluiu no servidor, aparece ao reabrir a
            // conversa. Outras falhas (rede/timeout) → banner + restaura o texto.
            if ((e as Error)?.name !== 'AbortError') {
                if (optimisticId) setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
                setError(bannerFromError(500, {}))
                if (!override) setInput(text)
            }
        } finally {
            setSending(false); setLiveSteps([]); abortRef.current = null
        }
    }, [input, sending, activeId, focusedStudentId, students])

    // U-STOP: interrompe o turno em andamento (aborta o fetch/stream).
    const stop = useCallback(() => { abortRef.current?.abort() }, [])

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

    // Estamos no Assistente (⇒ tier com IA + modo 'assistant'): semeia o cache do gate de
    // IA e do modo para a Sidebar global pintar o toggle correto já na 1ª pintura.
    useEffect(() => {
        setCachedAiAllowed(true)
        setCachedHomeStyle('assistant')
    }, [])

    // Ao chegar de outra aba pelo rail persistente (AssistantNavSidebar), abre o
    // contexto pedido na URL: ?c=<conversa> ou ?s=<aluno em foco>. ?new = home limpa.
    useEffect(() => {
        const c = searchParams.get('c')
        const s = searchParams.get('s')
        if (c) selectConversation(c)
        else if (s) { selectStudent(s); setSegment('alunos') }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // U-CRED: aviso de crédito ACABANDO (≥85% usado), antes de zerar.
    const lowCredit: AssistantBannerData | null =
        summary && !summary.exhausted && summary.tier !== 'free' && summary.creditsTotal > 0 &&
        summary.creditsRemaining <= Math.ceil(summary.creditsTotal * 0.15) && !creditWarnDismissed
            ? {
                  tone: 'warning',
                  message: `Seus créditos de IA estão acabando — restam ${summary.creditsRemaining} de ${summary.creditsTotal}. Renovam no próximo ciclo.`,
              }
            : null

    // Banner ativo: erro de turno > cota esgotada > crédito acabando.
    const banner: AssistantBannerData | null =
        error ?? (summary?.exhausted ? bannerFromError(402, {}) : lowCredit)

    const dismissBanner = useCallback(() => { setError(null); setCreditWarnDismissed(true) }, [])

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
                onDeleteConversation={deleteConversation}
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
                    liveSteps={liveSteps}
                    input={input}
                    trainerName={trainerName}
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
                />
            ) : (
                <AssistantHome
                    trainerName={trainerName}
                    summary={summary}
                    attention={attention}
                    recents={recents}
                    focusedStudentId={focusedStudentId}
                    students={students.map((s) => ({ id: s.id, name: s.name, avatarUrl: s.avatarUrl }))}
                    hasStudents={students.length > 0}
                    input={input}
                    sending={sending}
                    banner={banner}
                    onDismissBanner={dismissBanner}
                    onInput={setInput}
                    onSend={() => send()}
                    onStarter={fillInput}
                    onFocusStudent={setFocusedStudentId}
                    onOpenConversation={selectConversation}
                />
            )}
        </div>
    )
}

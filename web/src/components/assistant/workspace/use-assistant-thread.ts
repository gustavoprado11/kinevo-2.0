'use client'

/**
 * useAssistantThread — o "motor de cliente" de uma thread do Assistente:
 * conversas (criar/abrir/arquivar/renomear), envio de turno com streaming
 * NDJSON (progress/text/text_reset/done), Parar de verdade (abort → o servidor
 * cancela o LLM), desfecho de confirmação HITL e o banner de cota/crédito.
 *
 * Extraído do AssistantWorkspace (Onda 4) para ser compartilhado entre a
 * página /assistente e o dock lateral (UnifiedCommunicationPanel) — uma única
 * implementação do protocolo de turno; as cascas só apresentam.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { bannerFromError, type AssistantBannerData } from './assistant-banner'
import type { AssistantTurnMode } from '@/lib/assistant/command-engine'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { ConversationListItem, AssistantMessage } from '@/lib/assistant/conversations'
import { markFirstAssistantChat } from '@/lib/assistant/onboarding-milestone'

export interface ThreadStudent { id: string; name: string }

interface Opts {
    /** Summary já conhecido (SSR na página; o dock hidrata depois via setSummary). */
    initialSummary?: AiUsageSummary | null
    initialConversations?: ConversationListItem[]
    /** Usado só para nomear a conversa otimista quando ela nasce escopada. */
    students?: ThreadStudent[]
}

export function useAssistantThread({ initialSummary = null, initialConversations = [], students = [] }: Opts = {}) {
    const [summary, setSummary] = useState<AiUsageSummary | null>(initialSummary)
    const [conversations, setConversations] = useState<ConversationListItem[]>(initialConversations)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [messages, setMessages] = useState<AssistantMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [input, setInput] = useState('')
    // Modo do composer (Agir/Planejar/Analisar) — enviado a cada turno. Vive na
    // thread p/ persistir na transição home → conversa dentro da sessão.
    const [mode, setMode] = useState<AssistantTurnMode>('agir')
    const [sending, setSending] = useState(false)
    const [liveSteps, setLiveSteps] = useState<string[]>([])
    const [liveText, setLiveText] = useState('') // U-STREAM: texto da resposta chegando token a token
    // Sinal EXPLÍCITO de text_reset (fallback de modelo) p/ consumidores do stream
    // (modo voz): inferir pelo encolhimento do liveText é ambíguo com a limpeza
    // de fim de turno e causava fala duplicada.
    const [textResetCount, setTextResetCount] = useState(0)
    const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null)
    const [error, setError] = useState<AssistantBannerData | null>(null)
    const abortRef = useRef<AbortController | null>(null) // U-STOP: turno em andamento
    const [creditWarnDismissed, setCreditWarnDismissed] = useState(false) // U-CRED

    const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId])

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
        void loadMessages(id)
    }, [conversations, loadMessages])

    // Trocar o escopo (aluno ou Geral) abre uma conversa NOVA: o student_id é
    // fixado na criação da thread no servidor, então mudar de aluno no meio de
    // uma conversa existente não teria efeito no contexto do turno.
    const selectStudent = useCallback((id: string | null) => {
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

    // Próxima conversa a ser criada é a ENTREVISTA DE ESTILO (o card-convite da
    // home liga isto e dispara a primeira mensagem no mesmo gesto).
    const styleInterviewRef = useRef(false)

    const send = useCallback(async (override?: string, opts?: { voice?: boolean }): Promise<AssistantMessage | null> => {
        const text = (override ?? input).trim()
        if (!text || sending) return null
        if (!override) setInput('')
        setError(null)
        setSending(true)
        setLiveText('')
        const clientMessageId = crypto.randomUUID() // C4: idempotência do turno (anti re-envio)
        const ac = new AbortController() // U-STOP: permite Parar o turno
        abortRef.current = ac
        let optimisticId = ''

        let convId = activeId
        try {
            if (!convId) {
                const styleInterview = styleInterviewRef.current
                styleInterviewRef.current = false
                const res = await fetch('/api/assistant/conversations', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    // A criação da entrevista roda a MINERAÇÃO no servidor — o primeiro
                    // turno já chega sabendo o que não precisa perguntar.
                    body: JSON.stringify(
                        styleInterview
                            ? { kind: 'style_interview' }
                            : focusedStudentId
                              ? { studentId: focusedStudentId }
                              : {},
                    ),
                    signal: ac.signal,
                })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    setError(bannerFromError(res.status, data))
                    if (!override) setInput(text) // devolve o texto p/ o usuário reenviar
                    setSending(false)
                    return null
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
                // Onda 6: voice=true → surface 'voice' no servidor (resposta falável).
                // mode: Agir/Planejar/Analisar (Analisar = turno somente-leitura).
                body: JSON.stringify({ input: text, clientMessageId, mode, ...(opts?.voice ? { voice: true } : {}) }),
                signal: ac.signal,
            })
            // Erros de setup (gate/cota/rate/validação) vêm como JSON não-2xx.
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({}))
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
                setError(bannerFromError(res.status, data))
                if (!override) setInput(text) // devolve o texto p/ o usuário reenviar
                return null
            }
            // Stream NDJSON: {type:'progress'} + {type:'text', delta} (U-STREAM) ao
            // vivo + {type:'done'} no fim. text_reset = fallback de modelo (descarta
            // o texto parcial).
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
                    let ev: { type?: string; label?: string; delta?: string; userMessage?: AssistantMessage; message?: AssistantMessage; summary?: AiUsageSummary }
                    try { ev = JSON.parse(line) } catch { continue }
                    if (ev.type === 'progress' && ev.label) setLiveSteps((s) => [...s, ev.label as string])
                    else if (ev.type === 'text' && typeof ev.delta === 'string') setLiveText((t) => t + (ev.delta as string))
                    else if (ev.type === 'text_reset') { setLiveText(''); setTextResetCount((n) => n + 1) }
                    else if (ev.type === 'done') final = ev
                    else if (ev.type === 'error') streamError = true
                }
            }
            setLiveSteps([])
            if (streamError || !final) {
                setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
                setError(bannerFromError(500, {}))
                if (!override) setInput(text)
                return null
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
            markFirstAssistantChat()
            return final.message ?? null
        } catch (e) {
            // U-ERR: não engole a falha. Parar (AbortError) é intencional — mantém a msg
            // do usuário; a resposta, se concluiu no servidor, aparece ao reabrir a
            // conversa. Outras falhas (rede/timeout) → banner + restaura o texto.
            if ((e as Error)?.name !== 'AbortError') {
                if (optimisticId) setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
                setError(bannerFromError(500, {}))
                if (!override) setInput(text)
            }
            return null
        } finally {
            setSending(false); setLiveSteps([]); setLiveText(''); abortRef.current = null
        }
    }, [input, sending, activeId, focusedStudentId, students, mode])

    // Onda 6: turno por voz (hands-free) — mesma thread, resposta curta/falável.
    // Devolve a mensagem final para o cliente FALAR (TTS) e decidir o próximo passo.
    const sendVoice = useCallback((text: string) => send(text, { voice: true }), [send])

    // U-STOP: interrompe o turno — o abort do fetch derruba a conexão e o servidor
    // aborta o LLM de verdade (request.signal → abortSignal do motor).
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

    /** Abre a entrevista de estilo: cria a conversa (com mineração) e já dispara o
     *  primeiro turno, que faz a primeira pergunta do roteiro. */
    const startStyleInterview = useCallback(() => {
        styleInterviewRef.current = true
        void send('Quero configurar o meu estilo de prescrição.')
    }, [send])

    return {
        startStyleInterview,
        summary, setSummary,
        conversations, setConversations,
        activeId, active,
        messages, loadingMessages,
        input, setInput,
        mode, setMode,
        sending, liveSteps, liveText, textResetCount,
        focusedStudentId, setFocusedStudentId,
        banner, dismissBanner,
        loadMessages, selectConversation, selectStudent, goHome, newConversation,
        deleteConversation, renameActive,
        send, sendVoice, stop, starter, fillInput, recordConfirmation,
    }
}

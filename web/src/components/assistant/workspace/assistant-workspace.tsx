'use client'

/**
 * AssistantWorkspace — casca própria do modo Assistente (tela de chat).
 *
 * Coluna única conversa-first: a AssistantSidebar (marca + toggle + "Nova
 * conversa" + "Ir para…" + Alunos/Conversas + perfil) à esquerda e a área
 * principal (home OU conversa) à direita. A mecânica da thread (conversas,
 * turno com streaming, HITL, banner) vive no useAssistantThread — compartilhado
 * com o dock lateral (Onda 4); aqui ficam só a casca e a navegação.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { setHomeStyle } from '@/actions/assistant/set-home-style'
import { setCachedAiAllowed, setCachedHomeStyle } from '@/components/assistant/command-bar/command-bar'
import type { SidebarStudent } from './assistant-rail'
import { AssistantSidebar } from './assistant-sidebar'
import { AssistantHome } from './assistant-home'
import { ConversationView } from './conversation-view'
import { StudentContextPanel } from './student-context-panel'
import { useAssistantThread } from './use-assistant-thread'
import type { AiUsageSummary } from '@/lib/ai-usage/usage-summary'
import type { AttentionItem } from '@/lib/assistant/home-data'
import type { ConversationListItem } from '@/lib/assistant/conversations'

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
    const [segment, setSegment] = useState<'alunos' | 'conversas'>('alunos')
    const [search, setSearch] = useState('')

    const {
        summary,
        conversations,
        activeId, active,
        messages, loadingMessages,
        input, setInput,
        sending, liveSteps, liveText, textResetCount,
        focusedStudentId, setFocusedStudentId,
        banner, dismissBanner,
        selectConversation, selectStudent, goHome, newConversation,
        deleteConversation, renameActive,
        send, sendVoice, stop, starter, fillInput, recordConfirmation,
    } = useAssistantThread({ initialSummary, initialConversations, students })

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

    // ── Coluna de contexto do aluno (3ª coluna) ──
    // Aluno exibido: na conversa vale o escopo da conversa; na home vale o foco.
    const panelStudentId = active?.student_id ?? focusedStudentId
    const panelFromConversation = !!active?.student_id

    // Colapso persistido; default aberto. Lê o localStorage após a hidratação.
    const [contextOpen, setContextOpen] = useState(true)
    useEffect(() => {
        const saved = window.localStorage.getItem('kinevo:assistant-context-open')
        if (saved !== null) setContextOpen(saved === '1')
    }, [])
    const toggleContext = useCallback(() => {
        setContextOpen((o) => {
            const next = !o
            try { window.localStorage.setItem('kinevo:assistant-context-open', next ? '1' : '0') } catch { /* noop */ }
            return next
        })
    }, [])

    // Focar um aluno (novo/diferente) reabre o painel se estiver colapsado.
    const prevPanelStudent = useRef<string | null>(null)
    useEffect(() => {
        const prev = prevPanelStudent.current
        prevPanelStudent.current = panelStudentId
        if (panelStudentId && prev !== panelStudentId) setContextOpen(true)
    }, [panelStudentId])

    // Pré-armar o composer (fillInput) + focar — mesmo padrão dos cards da home.
    const prefillComposer = useCallback((prompt: string) => {
        fillInput(prompt)
        requestAnimationFrame(() => {
            const el = document.querySelector<HTMLTextAreaElement>('[data-assistant-composer]')
            if (!el) return
            el.focus()
            const end = el.value.length
            try { el.setSelectionRange(end, end) } catch { /* noop */ }
        })
    }, [fillInput])

    // Toggle → Clássico: navegação ótimista (?h=classic evita bounce ao Assistente
    // enquanto a preferência sincroniza em background). O pill mostra spinner.
    const [isSwitching, startSwitch] = useTransition()
    const toggleClassic = useCallback(() => {
        setCachedHomeStyle('classic')
        void setHomeStyle('classic')
        startSwitch(() => { router.push('/dashboard?h=classic') })
    }, [router])

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

    return (
        <div className="kv-mode-in flex h-[100dvh] overflow-hidden bg-[#F5F5F7] text-[#1D1D1F] dark:bg-background dark:text-foreground">
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
                    summary={summary ?? initialSummary}
                    messages={messages}
                    loadingMessages={loadingMessages}
                    sending={sending}
                    liveSteps={liveSteps}
                    liveText={liveText}
                    textResetCount={textResetCount}
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
                    onVoiceTurn={sendVoice}
                />
            ) : (
                <AssistantHome
                    trainerName={trainerName}
                    summary={summary ?? initialSummary}
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

            <StudentContextPanel
                studentId={panelStudentId}
                fromConversation={panelFromConversation}
                open={contextOpen}
                onToggle={toggleContext}
                onRemove={() => setFocusedStudentId(null)}
                onPrefill={prefillComposer}
            />
        </div>
    )
}

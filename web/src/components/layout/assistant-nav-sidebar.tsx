'use client'

/**
 * AssistantNavSidebar — a AssistantSidebar (conversa-first) renderizada pela
 * casca global (AppLayout) no modo Assistente, para PERSISTIR em todas as abas.
 *
 * Aqui o rail é "navegacional": clicar num aluno/conversa leva à tela do chat
 * (/assistente) com o contexto via query (?s / ?c / ?new). Os dados do rail vêm
 * de /api/assistant/rail-data. Na própria home do chat quem renderiza a sidebar
 * é o AssistantWorkspace (rail controla o chat in-place).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setHomeStyle } from '@/actions/assistant/set-home-style'
import { setCachedHomeStyle } from '@/components/assistant/command-bar/command-bar'
import { AssistantSidebar } from '@/components/assistant/workspace/assistant-sidebar'
import type { SidebarStudent } from '@/components/assistant/workspace/assistant-rail'
import type { ConversationListItem } from '@/lib/assistant/conversations'

interface Props {
    trainerName: string | null
    trainerEmail?: string | null
    trainerAvatarUrl?: string | null
}

export function AssistantNavSidebar({ trainerName, trainerEmail, trainerAvatarUrl }: Props) {
    const router = useRouter()
    const [students, setStudents] = useState<SidebarStudent[]>([])
    const [conversations, setConversations] = useState<ConversationListItem[]>([])
    const [segment, setSegment] = useState<'alunos' | 'conversas'>('alunos')
    const [search, setSearch] = useState('')
    const [switchingClassic, setSwitchingClassic] = useState(false)

    useEffect(() => {
        let active = true
        fetch('/api/assistant/rail-data')
            .then((r) => (r.ok ? r.json() : { students: [], conversations: [] }))
            .then((d) => {
                if (!active) return
                setStudents((d.students ?? []) as SidebarStudent[])
                setConversations((d.conversations ?? []) as ConversationListItem[])
            })
            .catch(() => { /* rail vazio em caso de erro; navegação segue funcionando */ })
        return () => { active = false }
    }, [])

    const toggleClassic = () => {
        setSwitchingClassic(true)
        setCachedHomeStyle('classic')
        void setHomeStyle('classic')
        router.push('/dashboard?h=classic')
    }

    // Excluir conversa: soft-delete (arquiva). Remove da lista local; o backend
    // marca archived_at e ela some de listConversations.
    const deleteConversation = (id: string) => {
        if (typeof window !== 'undefined' && !window.confirm('Excluir esta conversa? Ela sairá da sua lista.')) return
        setConversations((prev) => prev.filter((c) => c.id !== id))
        fetch(`/api/assistant/conversations/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: true }),
        }).catch(() => { /* otimista; já removida localmente */ })
    }

    return (
        <AssistantSidebar
            fixed
            trainerName={trainerName}
            trainerEmail={trainerEmail ?? null}
            trainerAvatarUrl={trainerAvatarUrl ?? null}
            students={students}
            conversations={conversations}
            activeConversationId={null}
            focusedStudentId={null}
            segment={segment}
            search={search}
            onSegment={setSegment}
            onSearch={setSearch}
            onHome={() => router.push('/assistente')}
            onNewConversation={() => router.push('/assistente?new=1')}
            onSelectStudent={(id) => router.push(`/assistente?s=${id}`)}
            onSelectConversation={(id) => router.push(`/assistente?c=${id}`)}
            onDeleteConversation={deleteConversation}
            onToggleClassic={toggleClassic}
            switchingClassic={switchingClassic}
        />
    )
}

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
            onToggleClassic={toggleClassic}
            switchingClassic={switchingClassic}
        />
    )
}

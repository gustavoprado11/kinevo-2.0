'use client'

/**
 * AssistantRail — coluna de Conversas/Alunos da tela de chat (modo Assistente).
 *
 * Extraída da antiga AssistantSidebar: a navegação do app, toggle de modo e perfil
 * agora vêm da Sidebar global (components/layout/sidebar.tsx). Este rail é exclusivo
 * do conteúdo do Dashboard-Assistente: segmento Alunos/Conversas + busca + lista.
 * Apresentacional: dados e callbacks vêm do AssistantWorkspace.
 */

import { Search, Sparkles } from 'lucide-react'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, groupLabel, GROUP_ORDER, timeShort } from './ui-util'

export interface SidebarStudent {
    id: string
    name: string
    dot: 'green' | 'amber' | 'red'
    subtitle: string
}

const DOT: Record<SidebarStudent['dot'], string> = {
    green: 'bg-[#16A34A]', amber: 'bg-[#F59E0B]', red: 'bg-[#EF4444]',
}

interface Props {
    students: SidebarStudent[]
    conversations: ConversationListItem[]
    activeConversationId: string | null
    focusedStudentId: string | null
    segment: 'alunos' | 'conversas'
    search: string
    onSegment: (s: 'alunos' | 'conversas') => void
    onSearch: (v: string) => void
    onSelectStudent: (id: string) => void
    onSelectConversation: (id: string) => void
}

export function AssistantRail({
    students, conversations, activeConversationId, focusedStudentId,
    segment, search, onSegment, onSearch, onSelectStudent, onSelectConversation,
}: Props) {
    const q = search.trim().toLowerCase()
    const filteredStudents = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students
    const filteredConvs = q
        ? conversations.filter((c) => (c.studentName ?? c.title).toLowerCase().includes(q))
        : conversations

    const groupedConvs = GROUP_ORDER.map((label) => ({
        label,
        items: filteredConvs.filter((c) => groupLabel(c.last_message_at) === label),
    })).filter((g) => g.items.length > 0)

    return (
        <aside className="flex w-[264px] min-w-[264px] flex-col border-r border-[#E8E8ED] bg-white">
            {/* Segmento Alunos / Conversas */}
            <div className="px-4 pb-2 pt-3.5">
                <div className="flex rounded-[10px] border border-[#E8E8ED] bg-[#F5F5F7] p-[3px]">
                    <button onClick={() => onSegment('alunos')}
                        className={`flex-1 rounded-[8px] py-1.5 text-[12px] font-semibold transition ${segment === 'alunos' ? 'bg-white text-[#7C3AED] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#86868B]'}`}>
                        Alunos <span className="font-medium text-[#AEAEB2]">{students.length}</span>
                    </button>
                    <button onClick={() => onSegment('conversas')}
                        className={`flex-1 rounded-[8px] py-1.5 text-[12px] font-semibold transition ${segment === 'conversas' ? 'bg-white text-[#7C3AED] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-[#86868B]'}`}>
                        Conversas <span className="font-medium text-[#AEAEB2]">{conversations.length}</span>
                    </button>
                </div>
            </div>

            {/* Busca */}
            <div className="mx-4 mb-1.5 flex items-center gap-2 rounded-[9px] border border-[#E8E8ED] bg-[#F5F5F7] px-2.5 py-2">
                <Search className="h-3.5 w-3.5 text-[#AEAEB2]" strokeWidth={1.8} />
                <input value={search} onChange={(e) => onSearch(e.target.value)}
                    placeholder={segment === 'alunos' ? 'Buscar aluno…' : 'Buscar conversa…'}
                    className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[#AEAEB2]" />
            </div>

            {/* Lista */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
                {segment === 'alunos' ? (
                    <>
                        {filteredStudents.map((s) => {
                            const av = avatarFor(s.name)
                            const on = s.id === focusedStudentId
                            return (
                                <button key={s.id} onClick={() => onSelectStudent(s.id)}
                                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition ${on ? 'bg-[rgba(124,58,237,0.10)]' : 'hover:bg-[#F5F5F7]'}`}>
                                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold" style={{ background: av.bg, color: av.fg }}>{av.initials}</span>
                                    <span className="min-w-0 flex-1">
                                        <b className="block truncate text-[13px] font-semibold text-[#1D1D1F]">{s.name}</b>
                                        {s.subtitle && <span className="block truncate text-[11px] text-[#86868B]">{s.subtitle}</span>}
                                    </span>
                                    <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT[s.dot]}`} />
                                </button>
                            )
                        })}
                        {filteredStudents.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-[#AEAEB2]">Nenhum aluno.</p>}
                    </>
                ) : (
                    <>
                        {groupedConvs.map((g) => (
                            <div key={g.label}>
                                <div className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.09em] text-[#AEAEB2]">{g.label}</div>
                                {g.items.map((c) => {
                                    const av = avatarFor(c.studentName)
                                    const isGeneral = !c.student_id
                                    const on = c.id === activeConversationId
                                    return (
                                        <button key={c.id} onClick={() => onSelectConversation(c.id)}
                                            className={`mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition ${on ? 'bg-[rgba(124,58,237,0.10)]' : 'hover:bg-[#F5F5F7]'}`}>
                                            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold" style={isGeneral ? { background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' } : { background: av.bg, color: av.fg }}>
                                                {isGeneral ? <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} /> : av.initials}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5">
                                                    <b className="truncate text-[13px] font-semibold text-[#1D1D1F]">{c.studentName ?? (isGeneral ? 'Geral' : c.title)}</b>
                                                    <span className="ml-auto shrink-0 text-[10px] text-[#AEAEB2]">{timeShort(c.last_message_at)}</span>
                                                </span>
                                                <span className="block truncate text-[11px] text-[#86868B]">{c.title}</span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        ))}
                        {filteredConvs.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-[#AEAEB2]">Nenhuma conversa ainda.</p>}
                    </>
                )}
            </div>
        </aside>
    )
}

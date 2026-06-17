'use client'

/**
 * AssistantRail — bloco de Conversas/Alunos embutido na sidebar única do Assistente
 * (segmento Alunos/Conversas + busca + lista). Content-only: NÃO tem casca/largura
 * própria — quem dá largura/borda é o AssistantSidebar. Apresentacional: dados e
 * callbacks vêm do AssistantWorkspace.
 */

import Image from 'next/image'
import { Search, Sparkles } from 'lucide-react'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, groupLabel, GROUP_ORDER, timeShort } from './ui-util'

export interface SidebarStudent {
    id: string
    name: string
    avatarUrl: string | null
    dot: 'green' | 'amber' | 'red'
    subtitle: string
}

const DOT: Record<SidebarStudent['dot'], string> = {
    green: 'bg-[#16A34A]', amber: 'bg-[#F59E0B]', red: 'bg-[#EF4444]',
}

/** Avatar 32px: foto real (avatar_url) quando houver, senão iniciais coloridas.
 *  Wrapper de tamanho fixo (como o perfil do Clássico) + imagem h-full/w-full —
 *  garante que a foto preencha o box exatamente. */
function Avatar({ name, url }: { name: string | null; url: string | null }) {
    const av = avatarFor(name)
    if (url) {
        return (
            <span className="flex h-[32px] w-[32px] shrink-0 overflow-hidden rounded-[10px]">
                <Image src={url} alt={name ?? ''} width={32} height={32} unoptimized className="h-full w-full object-cover" />
            </span>
        )
    }
    return (
        <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold"
            style={{ background: av.bg, color: av.fg }}>{av.initials}</span>
    )
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

    // student_id → foto, p/ as conversas mostrarem a foto real do aluno.
    const studentAvatar = new Map(students.map((s) => [s.id, s.avatarUrl]))

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Segmento Alunos / Conversas */}
            <div className="px-4 pb-2 pt-1.5">
                <div className="flex rounded-[10px] bg-[#F5F5F7] p-[3px]">
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
            <div className="mx-4 mb-1.5 flex items-center gap-2 rounded-[9px] bg-[#F5F5F7] px-2.5 py-2">
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
                            const on = s.id === focusedStudentId
                            return (
                                <button key={s.id} onClick={() => onSelectStudent(s.id)}
                                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition ${on ? 'bg-[rgba(124,58,237,0.10)]' : 'hover:bg-[#F5F5F7]'}`}>
                                    <Avatar name={s.name} url={s.avatarUrl} />
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
                                    const isGeneral = !c.student_id
                                    const on = c.id === activeConversationId
                                    return (
                                        <button key={c.id} onClick={() => onSelectConversation(c.id)}
                                            className={`mb-0.5 flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition ${on ? 'bg-[rgba(124,58,237,0.10)]' : 'hover:bg-[#F5F5F7]'}`}>
                                            {isGeneral ? (
                                                <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)' }}>
                                                    <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                                                </span>
                                            ) : (
                                                <Avatar name={c.studentName} url={c.student_id ? studentAvatar.get(c.student_id) ?? null : null} />
                                            )}
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
        </div>
    )
}

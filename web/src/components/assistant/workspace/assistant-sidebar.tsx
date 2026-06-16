'use client'

/**
 * AssistantSidebar — sidebar do modo Assistente (Cowork). Toggle Início,
 * Nova conversa, navegação do app, e segmento Alunos/Conversas com busca.
 * Apresentacional: dados e callbacks vêm do AssistantShell.
 */

import Link from 'next/link'
import {
    Sparkles, Plus, Search, LayoutGrid, LayoutDashboard, Users,
    CalendarDays, Wallet, Calendar, Dumbbell,
} from 'lucide-react'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, groupLabel, GROUP_ORDER, timeShort } from './ui-util'

export interface SidebarStudent {
    id: string
    name: string
    dot: 'green' | 'amber' | 'red'
    subtitle: string
}

const NAV = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Alunos', href: '/students', icon: Users },
    { label: 'Agenda', href: '/schedule', icon: CalendarDays },
    { label: 'Financeiro', href: '/financial', icon: Wallet },
    { label: 'Programas', href: '/programs', icon: Calendar },
    { label: 'Exercícios', href: '/exercises', icon: Dumbbell },
]

const DOT: Record<SidebarStudent['dot'], string> = {
    green: 'bg-[#34C759]', amber: 'bg-[#FF9F0A]', red: 'bg-[#FF3B30]',
}

interface Props {
    trainerName: string | null
    students: SidebarStudent[]
    conversations: ConversationListItem[]
    activeConversationId: string | null
    focusedStudentId: string | null
    segment: 'alunos' | 'conversas'
    search: string
    onSegment: (s: 'alunos' | 'conversas') => void
    onSearch: (v: string) => void
    onNewConversation: () => void
    onSelectStudent: (id: string) => void
    onSelectConversation: (id: string) => void
    onToggleClassic: () => void
    onToggleAssistant: () => void
}

export function AssistantSidebar({
    trainerName, students, conversations, activeConversationId, focusedStudentId,
    segment, search, onSegment, onSearch, onNewConversation, onSelectStudent,
    onSelectConversation, onToggleClassic, onToggleAssistant,
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

    const me = avatarFor(trainerName)

    return (
        <aside className="flex w-[248px] min-w-[248px] flex-col bg-white shadow-[1px_0_0_rgba(0,0,0,0.06)]">
            {/* Brand */}
            <div className="flex items-center gap-2.5 px-[18px] pb-3.5 pt-[22px]">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-gradient-to-br from-[#7C3AED] to-[#a78bfa] text-[16px] font-extrabold text-white">K</span>
                <b className="text-[17px] font-bold tracking-tight">Kinevo</b>
            </div>

            {/* Toggle Início */}
            <div className="mx-4 mb-2.5 mt-1 flex gap-[3px] rounded-[11px] border border-[#E8E8ED] bg-[#F5F5F7] p-[3px]">
                <button onClick={onToggleClassic}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-[7px] text-[12px] font-semibold text-[#6E6E73] transition hover:text-[#1D1D1F]">
                    <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} /> Clássico
                </button>
                <button onClick={onToggleAssistant}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-white py-[7px] text-[12px] font-semibold text-[#7C3AED] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> Assistente
                </button>
            </div>

            {/* Nova conversa */}
            <button onClick={onNewConversation}
                className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#7C3AED] to-[#8b5cf6] py-[9px] text-[13px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.5)] transition hover:brightness-105">
                <Plus className="h-[15px] w-[15px]" strokeWidth={2.3} /> Nova conversa
            </button>

            {/* Nav */}
            <nav className="px-3 pb-1.5 pt-1">
                {NAV.map((n) => (
                    <Link key={n.href} href={n.href}
                        className="group relative flex items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#6E6E73] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]">
                        <n.icon className="h-[17px] w-[17px] shrink-0 text-[#AEAEB2] transition group-hover:text-[#6E6E73]" strokeWidth={1.6} />
                        {n.label}
                    </Link>
                ))}
            </nav>

            <div className="mx-4 my-1.5 h-px bg-[#E8E8ED]" />

            {/* Segmento Alunos / Conversas */}
            <div className="px-4 pb-2 pt-1.5">
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
                                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold text-white" style={{ background: av.bg }}>{av.initials}</span>
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
                                            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold text-white" style={{ background: isGeneral ? 'linear-gradient(135deg,#7C3AED,#A78BFA)' : av.bg }}>
                                                {isGeneral ? <Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> : av.initials}
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

            {/* Profile */}
            <div className="flex items-center gap-2.5 border-t border-[#E8E8ED] px-[18px] py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: me.bg }}>{me.initials}</span>
                <div className="min-w-0">
                    <b className="block truncate text-[13px]">{trainerName ?? 'Treinador'}</b>
                    <span className="text-[11px] text-[#86868B]">Assistente IA</span>
                </div>
            </div>
        </aside>
    )
}

'use client'

/**
 * AssistantRail — bloco de Conversas/Alunos da home conversacional do Assistente
 * (segmento Alunos/Conversas + busca + lista). Content-only: NÃO tem casca/largura
 * própria — quem dá largura/borda é a coluna da home no AssistantWorkspace.
 * Apresentacional: dados e callbacks vêm do AssistantWorkspace.
 */

import Image from 'next/image'
import { Search, Trash2 } from 'lucide-react'
import type { ConversationListItem } from '@/lib/assistant/conversations'
import { avatarFor, groupLabel, GROUP_ORDER, timeShort } from './ui-util'
import { AssistantMark } from '@/components/assistant/assistant-mark'

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

/** Avatar 32px: foto real (avatar_url) quando houver, senão iniciais NEUTRAS
 *  (tinta sobre inset — idioma "ferramenta profissional"; matiz por nome saiu).
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
        <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] border border-k-border-subtle bg-surface-inset text-[11px] font-semibold text-k-text-secondary">
            {av.initials}
        </span>
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
    onDeleteConversation?: (id: string) => void
}

export function AssistantRail({
    students, conversations, activeConversationId, focusedStudentId,
    segment, search, onSegment, onSearch, onSelectStudent, onSelectConversation, onDeleteConversation,
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
                <div className="flex rounded-control bg-surface-inset p-[3px]">
                    <button onClick={() => onSegment('alunos')}
                        className={`flex-1 rounded-[6px] py-1.5 text-[12px] font-semibold transition ${segment === 'alunos' ? 'border border-k-border-subtle bg-surface-card text-k-text-primary' : 'border border-transparent text-k-text-tertiary hover:text-k-text-primary'}`}>
                        Alunos <span className="font-medium tabular-nums text-k-text-quaternary">{students.length}</span>
                    </button>
                    <button onClick={() => onSegment('conversas')}
                        className={`flex-1 rounded-[6px] py-1.5 text-[12px] font-semibold transition ${segment === 'conversas' ? 'border border-k-border-subtle bg-surface-card text-k-text-primary' : 'border border-transparent text-k-text-tertiary hover:text-k-text-primary'}`}>
                        Conversas <span className="font-medium tabular-nums text-k-text-quaternary">{conversations.length}</span>
                    </button>
                </div>
            </div>

            {/* Busca */}
            <div className="mx-4 mb-1.5 flex items-center gap-2 rounded-[9px] bg-surface-inset dark:bg-glass-bg px-2.5 py-2">
                <Search className="h-3.5 w-3.5 text-k-text-quaternary dark:text-muted-foreground/60" strokeWidth={1.8} />
                <input value={search} onChange={(e) => onSearch(e.target.value)}
                    placeholder={segment === 'alunos' ? 'Buscar aluno…' : 'Buscar conversa…'}
                    className="w-full bg-transparent text-[12.5px] text-k-text-primary dark:text-foreground outline-none placeholder:text-k-text-quaternary dark:placeholder:text-muted-foreground/60" />
            </div>

            {/* Lista */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
                {segment === 'alunos' ? (
                    <>
                        {filteredStudents.map((s) => {
                            const on = s.id === focusedStudentId
                            return (
                                <button key={s.id} onClick={() => onSelectStudent(s.id)}
                                    className={`flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition ${on ? 'bg-surface-inset' : 'hover:bg-glass-bg-hover'}`}>
                                    <Avatar name={s.name} url={s.avatarUrl} />
                                    <span className="min-w-0 flex-1">
                                        <b className="block truncate text-[13px] font-semibold text-k-text-primary dark:text-foreground">{s.name}</b>
                                        {s.subtitle && <span className="block truncate text-[11px] text-k-text-tertiary dark:text-muted-foreground">{s.subtitle}</span>}
                                    </span>
                                    <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT[s.dot]}`} />
                                </button>
                            )
                        })}
                        {filteredStudents.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-k-text-quaternary dark:text-muted-foreground/60">Nenhum aluno.</p>}
                    </>
                ) : (
                    <>
                        {groupedConvs.map((g) => (
                            <div key={g.label}>
                                <div className="px-2 pb-1 pt-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-k-text-quaternary">{g.label}</div>
                                {g.items.map((c) => {
                                    const isGeneral = !c.student_id
                                    const on = c.id === activeConversationId
                                    return (
                                        <div key={c.id} className="group relative">
                                            <button onClick={() => onSelectConversation(c.id)}
                                                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition ${on ? 'bg-surface-inset' : 'hover:bg-glass-bg-hover'}`}>
                                                {isGeneral ? (
                                                    <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'var(--primary)' }}>
                                                        <AssistantMark variant="filled" className="h-3.5 w-3.5 text-white" />
                                                    </span>
                                                ) : (
                                                    <Avatar name={c.studentName} url={c.student_id ? studentAvatar.get(c.student_id) ?? null : null} />
                                                )}
                                                <span className="min-w-0 flex-1 group-hover:pr-9">
                                                    <span className="flex items-center gap-1.5">
                                                        <b className="truncate text-[13px] font-semibold text-k-text-primary dark:text-foreground">{c.studentName ?? (isGeneral ? 'Geral' : c.title)}</b>
                                                        <span className="ml-auto shrink-0 text-[10px] text-k-text-quaternary dark:text-muted-foreground/60 transition-opacity group-hover:opacity-0">{timeShort(c.last_message_at)}</span>
                                                    </span>
                                                    <span className="block truncate text-[11px] text-k-text-tertiary dark:text-muted-foreground">{c.title}</span>
                                                </span>
                                            </button>
                                            {onDeleteConversation && (
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id) }}
                                                    title="Excluir conversa" aria-label="Excluir conversa"
                                                    className="absolute right-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-k-text-quaternary transition hover:bg-rose-50 hover:text-rose-600 group-hover:flex dark:hover:bg-rose-500/15 dark:hover:text-rose-300">
                                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                        {filteredConvs.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-k-text-quaternary dark:text-muted-foreground/60">Nenhuma conversa ainda.</p>}
                    </>
                )}
            </div>
        </div>
    )
}

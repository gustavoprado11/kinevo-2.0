'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { StudentModal } from '@/components/student-modal'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { Plus, Search, ChevronRight, ChevronUp, ChevronDown, Users } from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
}

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality: 'online' | 'presential'
    avatar_url: string | null
    created_at: string
    is_trainer_profile: boolean | null
    programName: string | null
    lastSessionDate: string | null
    sessionsThisWeek: number
    expectedPerWeek: number
}

type AttentionLevel = 'ok' | 'warning' | 'urgent'
type FilterKey = 'all' | 'attention' | 'online' | 'presential' | 'no_program'
type SortKey = 'attention' | 'name' | 'lastWorkout' | 'weekProgress'
type SortDir = 'asc' | 'desc'

interface StudentsClientProps {
    trainer: Trainer
    initialStudents: Student[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIMEZONE = 'America/Sao_Paulo'

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const todayKey = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const dateKey = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const diffDays = Math.floor((new Date(todayKey).getTime() - new Date(dateKey).getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 5) return `há ${diffWeeks}sem`
    const diffMonths = Math.floor(diffDays / 30)
    return `há ${diffMonths}m`
}

function getAttentionLevel(student: Student): AttentionLevel {
    if (!student.lastSessionDate && student.programName) return 'urgent'
    if (!student.programName && student.status === 'active') return 'warning'

    if (student.lastSessionDate) {
        const now = new Date()
        const last = new Date(student.lastSessionDate)
        const todayKey = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
        const dateKey = last.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
        const daysSince = Math.floor((new Date(todayKey).getTime() - new Date(dateKey).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince >= 7) return 'urgent'
        if (daysSince >= 3) return 'warning'
    }

    return 'ok'
}

const ATTENTION_ORDER: Record<AttentionLevel, number> = { urgent: 0, warning: 1, ok: 2 }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StudentsClient({ trainer, initialStudents }: StudentsClientProps) {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>(initialStudents)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
    const [sortKey, setSortKey] = useState<SortKey>('attention')
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    const handleStudentCreated = (newStudent: Record<string, any>) => {
        setStudents([{
            is_trainer_profile: null,
            programName: null,
            lastSessionDate: null,
            sessionsThisWeek: 0,
            expectedPerWeek: 0,
            ...newStudent
        } as Student, ...students])
    }

    // Enrich with attention level
    const studentsWithAttention = useMemo(() =>
        students.map(s => ({ ...s, attention: getAttentionLevel(s) })),
        [students]
    )

    // Filter counts for chips
    const filterCounts = useMemo(() => {
        const all = studentsWithAttention
        return {
            all: all.length,
            attention: all.filter(s => s.attention !== 'ok').length,
            online: all.filter(s => s.modality === 'online').length,
            presential: all.filter(s => s.modality === 'presential').length,
            no_program: all.filter(s => !s.programName && s.status === 'active').length,
        }
    }, [studentsWithAttention])

    // Apply search + filter + sort
    const filteredStudents = useMemo(() => {
        let result = studentsWithAttention

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
            )
        }

        // Filter
        if (activeFilter === 'attention') result = result.filter(s => s.attention !== 'ok')
        else if (activeFilter === 'online') result = result.filter(s => s.modality === 'online')
        else if (activeFilter === 'presential') result = result.filter(s => s.modality === 'presential')
        else if (activeFilter === 'no_program') result = result.filter(s => !s.programName && s.status === 'active')

        // Sort — trainer profile always first
        result = [...result].sort((a, b) => {
            if (a.is_trainer_profile) return -1
            if (b.is_trainer_profile) return 1

            let cmp = 0
            switch (sortKey) {
                case 'attention':
                    cmp = ATTENTION_ORDER[a.attention] - ATTENTION_ORDER[b.attention]
                    break
                case 'name':
                    cmp = a.name.localeCompare(b.name, 'pt-BR')
                    break
                case 'lastWorkout': {
                    const aTime = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : 0
                    const bTime = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : 0
                    cmp = aTime - bTime
                    break
                }
                case 'weekProgress':
                    cmp = a.sessionsThisWeek - b.sessionsThisWeek
                    break
            }

            return sortDir === 'asc' ? cmp : -cmp
        })

        return result
    }, [studentsWithAttention, searchQuery, activeFilter, sortKey, sortDir])

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(key === 'name' ? 'asc' : 'asc')
        }
    }

    const getStatusBadge = (status: Student['status']) => {
        const styles = {
            active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            inactive: 'bg-glass-bg text-muted-foreground border-k-border-primary',
            pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        }
        const labels = { active: 'Ativo', inactive: 'Inativo', pending: 'Pendente' }
        return (
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${styles[status]}`}>
                {labels[status]}
            </span>
        )
    }

    const filters: { key: FilterKey; label: string; count: number }[] = [
        { key: 'all', label: 'Todos', count: filterCounts.all },
        { key: 'attention', label: 'Atenção', count: filterCounts.attention },
        { key: 'no_program', label: 'Sem programa', count: filterCounts.no_program },
        { key: 'online', label: 'Online', count: filterCounts.online },
        { key: 'presential', label: 'Presencial', count: filterCounts.presential },
    ]

    function SortHeader({ label, sortKeyValue, className = '' }: { label: string; sortKeyValue: SortKey; className?: string }) {
        const isActive = sortKey === sortKeyValue
        return (
            <th
                onClick={() => handleSort(sortKeyValue)}
                className={`px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary cursor-pointer select-none hover:text-k-text-tertiary transition-colors ${className}`}
            >
                <div className="flex items-center gap-1">
                    {label}
                    {isActive && (
                        sortDir === 'asc'
                            ? <ChevronUp size={12} className="text-violet-400" />
                            : <ChevronDown size={12} className="text-violet-400" />
                    )}
                </div>
            </th>
        )
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            {/* Page Header — clean, no subtitle */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-white tracking-tight">Alunos</h1>
                    <span className="px-2 py-0.5 text-xs font-bold text-k-text-quaternary bg-glass-bg rounded-md border border-k-border-subtle">
                        {students.length}
                    </span>
                </div>
                <Button
                    data-onboarding="students-add-btn"
                    onClick={() => setIsModalOpen(true)}
                    className="gap-2 bg-violet-600 hover:bg-violet-500 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-lg shadow-violet-500/20 transition-all"
                >
                    <Plus size={14} strokeWidth={2.5} />
                    Novo Aluno
                </Button>
            </div>

            {/* Search */}
            <div data-onboarding="students-search" className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-k-text-quaternary" strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-k-border-subtle bg-glass-bg py-2.5 pl-10 pr-4 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 transition-all"
                    />
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-2 mb-5 overflow-x-auto">
                {filters.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setActiveFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeFilter === f.key
                                ? 'bg-violet-600/15 text-violet-400 border border-violet-500/30'
                                : 'text-k-text-quaternary hover:text-k-text-tertiary hover:bg-glass-bg border border-transparent'
                        }`}
                    >
                        {f.label}
                        <span className={`ml-1.5 ${activeFilter === f.key ? 'text-violet-400/60' : 'text-k-text-quaternary/50'}`}>
                            {f.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Students Table */}
            <div className="rounded-2xl border border-k-border-subtle bg-surface-card shadow-xl overflow-hidden">
                {filteredStudents.length === 0 ? (
                    <div className="py-16 text-center">
                        {searchQuery || activeFilter !== 'all' ? (
                            <>
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-glass-bg border border-k-border-subtle">
                                    <Search className="h-5 w-5 text-k-text-quaternary" strokeWidth={1.5} />
                                </div>
                                <p className="text-sm text-k-text-quaternary">
                                    {searchQuery
                                        ? <>Nenhum aluno encontrado para &ldquo;{searchQuery}&rdquo;</>
                                        : 'Nenhum aluno neste filtro'
                                    }
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-glass-bg border border-k-border-subtle">
                                    <Users className="h-6 w-6 text-k-text-quaternary" strokeWidth={1.5} />
                                </div>
                                <h2 className="text-lg font-bold text-white mb-1">Nenhum aluno cadastrado</h2>
                                <p className="text-sm text-k-text-quaternary mb-6 max-w-sm mx-auto">
                                    Cadastre seu primeiro aluno para começar a prescrever programas de treino.
                                </p>
                                <Button
                                    onClick={() => setIsModalOpen(true)}
                                    className="bg-violet-600 hover:bg-violet-500 rounded-xl px-5 py-2 text-xs font-bold uppercase tracking-wider"
                                >
                                    Cadastrar primeiro aluno
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-k-border-subtle">
                                    <SortHeader label="Aluno" sortKeyValue="name" />
                                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                        Modalidade
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                        Programa
                                    </th>
                                    <SortHeader label="Semana" sortKeyValue="weekProgress" />
                                    <SortHeader label="Último Treino" sortKeyValue="lastWorkout" />
                                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-k-border-subtle">
                                {filteredStudents.map((student) => {
                                    const borderColor = student.attention === 'urgent'
                                        ? 'border-l-red-500'
                                        : student.attention === 'warning'
                                            ? 'border-l-yellow-500'
                                            : 'border-l-transparent'

                                    return (
                                        <tr
                                            key={student.id}
                                            className={`group cursor-pointer transition-colors hover:bg-glass-bg border-l-2 ${borderColor}`}
                                            onClick={() => router.push(`/students/${student.id}`)}
                                            {...(student.is_trainer_profile ? { 'data-onboarding': 'students-self-profile' } : {})}
                                        >
                                            {/* ALUNO */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden flex-shrink-0">
                                                        {student.avatar_url ? (
                                                            <Image
                                                                src={student.avatar_url}
                                                                alt={student.name}
                                                                width={36}
                                                                height={36}
                                                                className="h-9 w-9 rounded-full object-cover"
                                                                unoptimized
                                                            />
                                                        ) : (
                                                            <span className="text-sm font-bold text-k-text-secondary">
                                                                {student.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-semibold text-k-text-primary">{student.name}</span>
                                                        {student.is_trainer_profile && (
                                                            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                                                Eu
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* MODALIDADE */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                                                    student.modality === 'presential'
                                                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                                        : 'bg-glass-bg text-k-text-quaternary border-k-border-subtle'
                                                }`}>
                                                    {student.modality === 'presential' ? 'Presencial' : 'Online'}
                                                </span>
                                            </td>

                                            {/* PROGRAMA */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {student.programName ? (
                                                    <span className="text-sm text-k-text-secondary font-medium truncate max-w-[160px] block">
                                                        {student.programName}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-k-text-quaternary">—</span>
                                                )}
                                            </td>

                                            {/* ESTA SEMANA */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {student.expectedPerWeek > 0 ? (
                                                    <span className={`text-sm font-bold ${
                                                        student.sessionsThisWeek >= student.expectedPerWeek
                                                            ? 'text-emerald-400'
                                                            : student.sessionsThisWeek > 0
                                                                ? 'text-k-text-secondary'
                                                                : 'text-yellow-400'
                                                    }`}>
                                                        {student.sessionsThisWeek}/{student.expectedPerWeek}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-k-text-quaternary">—</span>
                                                )}
                                            </td>

                                            {/* ÚLTIMO TREINO */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {student.lastSessionDate ? (
                                                    <span className={`text-sm font-medium ${
                                                        (() => {
                                                            const now = new Date()
                                                            const last = new Date(student.lastSessionDate)
                                                            const todayKey = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
                                                            const dateKey = last.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
                                                            const days = Math.floor((new Date(todayKey).getTime() - new Date(dateKey).getTime()) / (1000 * 60 * 60 * 24))
                                                            return days >= 7 ? 'text-red-400' : days >= 3 ? 'text-yellow-400' : 'text-k-text-secondary'
                                                        })()
                                                    }`}>
                                                        {timeAgo(student.lastSessionDate)}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-k-text-quaternary">Nunca</span>
                                                )}
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(student.status)}
                                            </td>

                                            {/* CHEVRON */}
                                            <td className="px-4 py-4 whitespace-nowrap text-right">
                                                <ChevronRight className="w-4 h-4 text-k-border-subtle group-hover:text-k-text-tertiary transition-colors inline-block" strokeWidth={1.5} />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <StudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStudentCreated={handleStudentCreated}
                trainerId={trainer.id}
            />

            {/* Tour: Students (auto-start on first visit) */}
            <TourRunner tourId="students" steps={TOUR_STEPS.students} autoStart />
        </AppLayout>
    )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/client'
import {
    Plus, Search, MoreVertical, Pencil, Copy, UserPlus,
    Trash2, FolderPlus, Loader2, X, Check
} from 'lucide-react'
import { assignProgram } from '@/app/students/[id]/actions/assign-program'
import { duplicateProgram } from './actions/duplicate-program'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

// --- Helpers ---
const TIMEZONE = 'America/Sao_Paulo'
const DAY_LABELS: Record<string, string> = {
    mon: 'Seg', tue: 'Ter', wed: 'Qua',
    thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
}

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const dateStr2 = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const today = new Date(todayStr)
    const target = new Date(dateStr2)
    const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    const weeks = Math.floor(diffDays / 7)
    if (diffDays < 30) return `há ${weeks} sem.`
    const months = Math.floor(diffDays / 30)
    if (diffDays < 365) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
    return `há ${Math.floor(diffDays / 365)} anos`
}

function formatFrequency(freq: string[] | null): string {
    if (!freq || freq.length === 0) return ''
    return freq.map(d => DAY_LABELS[d.toLowerCase()] || d).join(', ')
}

// --- Types ---
interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
}

interface WorkoutInfo {
    id: string
    name: string
    exerciseCount: number
    frequency: string[] | null
}

interface ProgramTemplate {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    created_at: string
    workout_count: number
    exercise_count: number
    muscle_groups: string[]
    usage_count: number
    workouts: WorkoutInfo[]
}

interface StudentOption {
    id: string
    name: string
    modality: string | null
}

// --- Actions Menu ---
function ActionsMenu({
    onEdit,
    onDuplicate,
    onApply,
    onDelete,
    isDeleting,
    isDuplicating,
}: {
    onEdit: () => void
    onDuplicate: () => void
    onApply: () => void
    onDelete: () => void
    isDeleting: boolean
    isDuplicating: boolean
}) {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
                className="p-1.5 rounded-lg text-k-text-quaternary hover:text-white hover:bg-glass-bg-active transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
                <MoreVertical className="w-4 h-4" />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 top-full mt-1 w-48 bg-surface-card border border-k-border-primary rounded-xl shadow-2xl z-40 py-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => { onEdit(); setIsOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-k-text-secondary hover:bg-glass-bg-active transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                    </button>
                    <button
                        onClick={() => { onDuplicate(); setIsOpen(false) }}
                        disabled={isDuplicating}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-k-text-secondary hover:bg-glass-bg-active transition-colors disabled:opacity-40"
                    >
                        {isDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                        Duplicar
                    </button>
                    <button
                        onClick={() => { onApply(); setIsOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-k-text-secondary hover:bg-glass-bg-active transition-colors"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Aplicar a aluno
                    </button>
                    <div className="my-1 border-t border-k-border-subtle" />
                    <button
                        onClick={() => { onDelete(); setIsOpen(false) }}
                        disabled={isDeleting}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-40"
                    >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Excluir
                    </button>
                </div>
            )}
        </div>
    )
}

// --- Apply to Student Dialog ---
function ApplyToStudentDialog({
    templateId,
    templateName,
    onClose,
    onSuccess,
}: {
    templateId: string
    templateName: string
    onClose: () => void
    onSuccess: () => void
}) {
    const [students, setStudents] = useState<StudentOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [mode, setMode] = useState<'active' | 'scheduled'>('active')
    const [isAssigning, setIsAssigning] = useState(false)

    useEffect(() => {
        const loadStudents = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('students')
                .select('id, name, modality')
                .order('name')
            setStudents(data || [])
            setLoading(false)
        }
        loadStudents()
    }, [])

    const filtered = students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleApply = async () => {
        if (!selectedId) return
        setIsAssigning(true)
        const result = await assignProgram({
            studentId: selectedId,
            templateId,
            startDate: new Date().toISOString(),
            isScheduled: mode === 'scheduled',
        })
        setIsAssigning(false)
        if (result.success) {
            onSuccess()
            onClose()
        } else {
            alert('Erro ao aplicar programa.')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-surface-card border border-k-border-primary rounded-2xl w-full max-w-md shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-k-border-subtle">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-white">Aplicar programa</h2>
                        <p className="text-xs text-k-text-quaternary mt-0.5 truncate">{templateName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-k-text-quaternary hover:text-white transition-colors shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-k-border-subtle">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-k-text-quaternary" />
                        <input
                            type="text"
                            placeholder="Buscar aluno..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-glass-bg border border-k-border-primary rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Student List */}
                <div className="max-h-52 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 text-k-text-quaternary animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center py-8 text-xs text-k-text-quaternary">Nenhum aluno encontrado</p>
                    ) : (
                        filtered.map(student => (
                            <button
                                key={student.id}
                                onClick={() => setSelectedId(student.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                    selectedId === student.id
                                        ? 'bg-violet-500/10 ring-1 ring-violet-500/30'
                                        : 'hover:bg-glass-bg-active'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    selectedId === student.id ? 'border-violet-500 bg-violet-500' : 'border-k-border-primary'
                                }`}>
                                    {selectedId === student.id && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className="text-sm text-k-text-secondary flex-1 truncate">{student.name}</span>
                                {student.modality && (
                                    <span className="text-[10px] text-k-text-quaternary uppercase font-bold tracking-wider shrink-0">
                                        {student.modality === 'online' ? 'Online' : 'Presencial'}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Mode Selection */}
                <div className="p-4 border-t border-k-border-subtle space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary mb-2">Como aplicar?</p>
                    {([
                        { value: 'active' as const, label: 'Ativar como programa atual' },
                        { value: 'scheduled' as const, label: 'Agendar na fila' },
                    ]).map(opt => (
                        <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                mode === opt.value ? 'border-violet-500' : 'border-k-border-primary'
                            }`}>
                                {mode === opt.value && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                            </div>
                            <span className="text-sm text-k-text-secondary">{opt.label}</span>
                        </label>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-k-border-subtle">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-k-text-secondary hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!selectedId || isAssigning}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                    >
                        {isAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- Main Component ---
interface ProgramsClientProps {
    trainer: Trainer
    programs: ProgramTemplate[]
}

export function ProgramsClient({ trainer, programs: initialPrograms }: ProgramsClientProps) {
    const router = useRouter()
    const [programs, setPrograms] = useState(initialPrograms)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [duplicating, setDuplicating] = useState<string | null>(null)
    const [applyingTemplate, setApplyingTemplate] = useState<{ id: string; name: string } | null>(null)

    useEffect(() => {
        setPrograms(initialPrograms)
    }, [initialPrograms])

    const filteredPrograms = programs.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    const handleEdit = (id: string) => {
        router.push(`/programs/${id}`)
    }

    const handleDuplicate = async (id: string) => {
        setDuplicating(id)
        const result = await duplicateProgram(id)
        setDuplicating(null)
        if (result.success) {
            router.refresh()
        } else {
            alert('Erro ao duplicar programa.')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este programa?')) return
        setDeleting(id)
        const supabase = createClient()
        const { error } = await supabase.from('program_templates').delete().eq('id', id)
        if (!error) {
            setPrograms(prev => prev.filter(p => p.id !== id))
            if (expandedId === id) setExpandedId(null)
        }
        setDeleting(null)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Programas</h1>
                    <span className="px-2 py-0.5 rounded-md bg-glass-bg text-xs font-bold text-k-text-tertiary border border-k-border-subtle">
                        {programs.length}
                    </span>
                </div>
                <button
                    data-onboarding="programs-create-btn"
                    onClick={() => router.push('/programs/new')}
                    className="flex items-center gap-2 rounded-full border border-k-border-primary bg-glass-bg hover:bg-glass-bg-active text-k-text-secondary px-5 py-2 text-sm font-semibold transition-all"
                >
                    <Plus size={16} strokeWidth={2} />
                    Novo Programa
                </button>
            </div>

            <div className="space-y-4">
                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Buscar programas..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-glass-bg border border-k-border-primary rounded-xl py-2.5 pl-11 pr-4 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all"
                    />
                </div>

                {/* Content */}
                {filteredPrograms.length === 0 ? (
                    <div className="text-center py-20 rounded-2xl border border-dashed border-k-border-primary">
                        <FolderPlus className="w-8 h-8 text-k-text-quaternary mx-auto mb-3" strokeWidth={1} />
                        {searchQuery ? (
                            <>
                                <p className="text-sm font-semibold text-white">Nenhum programa encontrado</p>
                                <p className="text-xs text-k-text-quaternary mt-1">Tente outro termo de busca</p>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="mt-4 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    Limpar busca
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-semibold text-white mb-1">Nenhum modelo salvo</p>
                                <p className="text-xs text-k-text-quaternary max-w-sm mx-auto">
                                    Salve programas como modelo para reutilizar com diferentes alunos
                                </p>
                                <button
                                    onClick={() => router.push('/programs/new')}
                                    className="mt-5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    Criar primeiro programa
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPrograms.map(program => {
                            const isExpanded = expandedId === program.id
                            const shownGroups = program.muscle_groups.slice(0, 4)
                            const hiddenCount = program.muscle_groups.length - shownGroups.length

                            return (
                                <div
                                    key={program.id}
                                    onClick={() => handleExpand(program.id)}
                                    className="group bg-surface-card border border-k-border-primary rounded-2xl overflow-hidden transition-all duration-200 hover:border-violet-500/30 cursor-pointer"
                                >
                                    <div className="p-4">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <h3 className="text-base font-bold text-white tracking-tight leading-snug group-hover:text-violet-300 transition-colors line-clamp-2">
                                                {program.name}
                                            </h3>
                                            <ActionsMenu
                                                onEdit={() => handleEdit(program.id)}
                                                onDuplicate={() => handleDuplicate(program.id)}
                                                onApply={() => setApplyingTemplate({ id: program.id, name: program.name })}
                                                onDelete={() => handleDelete(program.id)}
                                                isDeleting={deleting === program.id}
                                                isDuplicating={duplicating === program.id}
                                            />
                                        </div>

                                        {/* Metadata */}
                                        <p className="text-xs text-k-text-quaternary mb-3">
                                            {program.duration_weeks && `${program.duration_weeks} semanas · `}
                                            {program.workout_count} treinos · {program.exercise_count} exercícios
                                        </p>

                                        {/* Muscle Groups */}
                                        {program.muscle_groups.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {shownGroups.map(group => (
                                                    <span key={group} className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary bg-glass-bg px-1.5 py-0.5 rounded border border-k-border-subtle">
                                                        {group}
                                                    </span>
                                                ))}
                                                {hiddenCount > 0 && (
                                                    <span className="text-[10px] text-k-text-quaternary font-medium self-center">+{hiddenCount}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Expanded: Workouts Preview */}
                                        {isExpanded && program.workouts.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-k-border-subtle space-y-1.5">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-k-text-quaternary mb-2">Treinos</p>
                                                {program.workouts.map(workout => {
                                                    const freq = formatFrequency(workout.frequency)
                                                    return (
                                                        <div key={workout.id} className="flex items-center justify-between">
                                                            <span className="text-sm text-k-text-secondary font-medium truncate">{workout.name}</span>
                                                            <div className="flex items-center gap-3 text-[11px] text-k-text-quaternary shrink-0 ml-3">
                                                                <span>{workout.exerciseCount} ex.</span>
                                                                {freq && <span>{freq}</span>}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-k-border-subtle bg-surface-inset text-[11px] text-k-text-quaternary">
                                        <span>
                                            {program.usage_count > 0
                                                ? `Usado ${program.usage_count}x`
                                                : 'Ainda não utilizado'}
                                        </span>
                                        <span>{timeAgo(program.created_at)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Apply to Student Dialog */}
            {applyingTemplate && (
                <ApplyToStudentDialog
                    templateId={applyingTemplate.id}
                    templateName={applyingTemplate.name}
                    onClose={() => setApplyingTemplate(null)}
                    onSuccess={() => router.refresh()}
                />
            )}

            {/* Tour */}
            <TourRunner tourId="programs" steps={TOUR_STEPS.programs} autoStart />
        </AppLayout>
    )
}

'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import { Plus, Activity } from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { SessionListItem } from '@/components/assessments/session-list-item'
import { CreateSessionModal } from '@/components/assessments/create-session-modal'
import type { AssessmentSessionListItem } from '@kinevo/shared/types/assessments'
import type { AssessmentListFilter } from '@/actions/assessments/get-session-list'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface Student {
    id: string
    name: string
    avatar_url?: string | null
}

interface AssessmentTemplateOption {
    id: string
    title: string
}

interface TemplateInfo {
    id: string
    title: string
    sectionCount: number
    sessionCount: number
    trainer_id: string | null
}

interface AvaliacoesClientProps {
    trainer: Trainer
    students: Student[]
    templates: TemplateInfo[]
    assessmentTemplates: AssessmentTemplateOption[]
    assessmentSessions: AssessmentSessionListItem[]
    onboardingState: OnboardingState | null
}

export function AvaliacoesClient({
    trainer,
    students,
    templates,
    assessmentTemplates,
    assessmentSessions,
    onboardingState,
}: AvaliacoesClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [assessmentFilter, setAssessmentFilter] = useState<AssessmentListFilter>('all')
    const [createSessionOpen, setCreateSessionOpen] = useState(false)
    const [presetStudentIdForCreate, setPresetStudentIdForCreate] = useState<string | undefined>(undefined)

    // Deep-link from /students/[id] → /avaliacoes?createAssessment=1&studentId=<uuid>.
    // Validates against trainer's students; falls back to empty modal if id is unknown.
    useEffect(() => {
        if (searchParams.get('createAssessment') !== '1') return
        const rawStudentId = searchParams.get('studentId') ?? undefined
        const valid = rawStudentId && students.some(s => s.id === rawStudentId)
        if (rawStudentId && !valid) {
            console.warn('[avaliacoes] createAssessment deep-link: unknown studentId', rawStudentId)
        }
        setPresetStudentIdForCreate(valid ? rawStudentId : undefined)
        setCreateSessionOpen(true)
    }, [searchParams, students])

    const filteredAssessments = useMemo(() => {
        const now = Date.now()
        return assessmentSessions.filter(s => {
            if (s.status === 'cancelled') return false
            if (assessmentFilter === 'all') return true
            if (assessmentFilter === 'completed') return s.status === 'completed'
            if (assessmentFilter === 'overdue') {
                return s.status === 'scheduled'
                    && s.scheduled_at != null
                    && new Date(s.scheduled_at).getTime() < now
            }
            if (assessmentFilter === 'upcoming') {
                if (s.status === 'in_progress') return true
                return s.status === 'scheduled'
                    && s.scheduled_at != null
                    && new Date(s.scheduled_at).getTime() >= now
            }
            return true
        })
    }, [assessmentSessions, assessmentFilter])

    const assessmentCounts = useMemo(() => {
        const now = Date.now()
        let overdue = 0
        let upcoming = 0
        let done = 0
        for (const s of assessmentSessions) {
            if (s.status === 'cancelled') continue
            if (s.status === 'completed') done += 1
            else if (s.status === 'in_progress') upcoming += 1
            else if (s.status === 'scheduled' && s.scheduled_at) {
                if (new Date(s.scheduled_at).getTime() < now) overdue += 1
                else upcoming += 1
            }
        }
        return { overdue, upcoming, completed: done }
    }, [assessmentSessions])

    const headerCount = assessmentSessions.filter(s => s.status !== 'cancelled').length

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={onboardingState}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">
                        Avaliações
                    </h1>
                    {headerCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F5F5F7] text-sm text-[#6E6E73] dark:bg-glass-bg dark:text-k-text-tertiary dark:border dark:border-k-border-subtle">
                            {headerCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {assessmentTemplates.length > 0 && (
                        <button
                            data-onboarding="assessments-new-session"
                            onClick={() => {
                                setPresetStudentIdForCreate(undefined)
                                setCreateSessionOpen(true)
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-full transition-all dark:rounded-xl"
                        >
                            <Plus size={14} />
                            Nova avaliação
                        </button>
                    )}
                    <button
                        data-onboarding="assessments-new-template"
                        onClick={() => router.push('/forms/templates/new?category=assessment')}
                        className="flex items-center gap-2 rounded-full bg-white border border-[#D2D2D7] text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] px-4 py-2 text-sm transition-all dark:rounded-xl dark:bg-transparent dark:border-k-border-primary dark:text-k-text-tertiary dark:hover:text-k-text-primary dark:hover:bg-transparent"
                    >
                        <Plus size={14} />
                        Novo template de avaliação
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Filter chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <FilterChip
                        active={assessmentFilter === 'all'}
                        onClick={() => setAssessmentFilter('all')}
                        label="Todas"
                    />
                    <FilterChip
                        active={assessmentFilter === 'overdue'}
                        onClick={() => setAssessmentFilter('overdue')}
                        label="Em atraso"
                        count={assessmentCounts.overdue}
                        tone="red"
                    />
                    <FilterChip
                        active={assessmentFilter === 'upcoming'}
                        onClick={() => setAssessmentFilter('upcoming')}
                        label="Próximas"
                        count={assessmentCounts.upcoming}
                    />
                    <FilterChip
                        active={assessmentFilter === 'completed'}
                        onClick={() => setAssessmentFilter('completed')}
                        label="Concluídas"
                        count={assessmentCounts.completed}
                    />
                </div>

                {/* Sessions list */}
                {filteredAssessments.length === 0 ? (
                    assessmentTemplates.length === 0 ? (
                        // Caso 1: 0 templates — flow começa com template
                        <div className="rounded-2xl border-2 border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
                                <Plus className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                            </div>
                            <p className="text-sm font-semibold text-k-text-primary">Comece criando um template</p>
                            <p className="mx-auto mt-1 max-w-sm text-xs text-k-text-tertiary">
                                Use um template de sistema do Kinevo ou crie o seu para agendar avaliações.
                            </p>
                            <button
                                onClick={() => router.push('/forms/templates/new?category=assessment')}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Criar template de avaliação
                            </button>
                        </div>
                    ) : assessmentSessions.length === 0 ? (
                        // Caso 2: tem templates mas 0 sessões
                        <div className="rounded-2xl border-2 border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
                                <Activity className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                            </div>
                            <p className="text-sm font-semibold text-k-text-primary">Nenhuma avaliação ainda</p>
                            <p className="mx-auto mt-1 max-w-sm text-xs text-k-text-tertiary">
                                Use &ldquo;Nova avaliação&rdquo; acima para agendar a primeira sessão.
                            </p>
                        </div>
                    ) : (
                        // Caso 3: tem sessões mas filtro vazio
                        <div className="rounded-2xl border-2 border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                            <p className="text-sm font-semibold text-k-text-primary">Nenhuma avaliação neste filtro</p>
                            <p className="mx-auto mt-1 max-w-sm text-xs text-k-text-tertiary">
                                Troque o filtro ou crie uma nova avaliação.
                            </p>
                        </div>
                    )
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card">
                        <ul className="divide-y divide-k-border-subtle">
                            {filteredAssessments.map(session => (
                                <li key={session.id}>
                                    <SessionListItem
                                        session={session}
                                        onClick={() => {
                                            if (session.status === 'completed') {
                                                router.push(`/students/${session.student_id}/avaliacoes/${session.id}/result`)
                                            } else {
                                                router.push(`/students/${session.student_id}/avaliacoes/${session.id}`)
                                            }
                                        }}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Templates count footer (lightweight — full listing fica em /avaliacoes/templates no B2) */}
                {templates.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-k-border-subtle bg-surface-card px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                            <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">
                                Templates de avaliação
                            </span>
                            <span className="text-xs text-[#86868B] dark:text-k-text-quaternary">
                                {templates.length}
                            </span>
                        </div>
                        <button
                            onClick={() => router.push('/forms/templates')}
                            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                        >
                            Gerenciar →
                        </button>
                    </div>
                )}
            </div>

            <CreateSessionModal
                open={createSessionOpen}
                onClose={() => {
                    setCreateSessionOpen(false)
                    setPresetStudentIdForCreate(undefined)
                    if (searchParams.get('createAssessment') === '1' || searchParams.get('studentId')) {
                        router.replace('/avaliacoes')
                    }
                }}
                students={students}
                templates={assessmentTemplates}
                presetStudentId={presetStudentIdForCreate}
                onCreated={(sessionId) => {
                    const session = assessmentSessions.find(s => s.id === sessionId)
                    if (session) {
                        router.push(`/students/${session.student_id}/avaliacoes/${sessionId}`)
                    } else {
                        router.refresh()
                    }
                }}
            />

            {/* Tour: Avaliações Presenciais — auto-completa-se via store ao final/skip. */}
            <TourRunner
                tourId="assessments_first_time"
                steps={TOUR_STEPS.assessments_first_time}
                autoStart
            />
        </AppLayout>
    )
}

function FilterChip({
    active,
    onClick,
    label,
    count,
    tone = 'violet',
}: {
    active: boolean
    onClick: () => void
    label: string
    count?: number
    tone?: 'violet' | 'red'
}) {
    const cls = active
        ? tone === 'red'
            ? 'border-red-500/40 bg-red-500/10 text-red-500'
            : 'border-violet-500/40 bg-violet-500/10 text-violet-500 dark:text-violet-400'
        : 'border-k-border-subtle bg-surface-card text-k-text-secondary hover:text-k-text-primary'
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${cls}`}
        >
            {label}
            {count != null && count > 0 && (
                <span
                    className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                        active
                            ? 'bg-white/20'
                            : tone === 'red'
                                ? 'bg-red-500/15 text-red-500'
                                : 'bg-violet-500/15 text-violet-500 dark:text-violet-400'
                    }`}
                >
                    {count}
                </span>
            )}
        </button>
    )
}

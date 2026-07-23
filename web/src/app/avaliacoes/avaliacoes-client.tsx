'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import { Plus, Activity, Send, ChevronRight } from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { TourHelpButton } from '@/components/onboarding/widgets/tour-help-button'
import { FormsAvaliacoesSegmented } from '@/components/forms/forms-avaliacoes-segmented'
import { KpiRuler } from '@/components/shared/kpi-ruler'
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

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

    const visibleSessions = useMemo(
        () => assessmentSessions.filter(s => s.status !== 'cancelled'),
        [assessmentSessions]
    )

    const overdueSessions = useMemo(() => {
        const now = Date.now()
        return visibleSessions.filter(s =>
            s.status === 'scheduled'
            && s.scheduled_at != null
            && new Date(s.scheduled_at).getTime() < now
        )
    }, [visibleSessions])

    // Callout urgente: scheduled em [now, now+7d].
    const upcomingNext7d = useMemo(() => {
        const now = Date.now()
        const cap = now + SEVEN_DAYS_MS
        return visibleSessions.filter(s =>
            s.status === 'scheduled'
            && s.scheduled_at != null
            && (() => {
                const t = new Date(s.scheduled_at!).getTime()
                return t >= now && t <= cap
            })()
        )
    }, [visibleSessions])

    const filteredAssessments = useMemo(() => {
        const now = Date.now()
        return visibleSessions.filter(s => {
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
    }, [visibleSessions, assessmentFilter])

    const assessmentCounts = useMemo(() => {
        const now = Date.now()
        let overdue = 0
        let upcoming = 0
        let done = 0
        for (const s of visibleSessions) {
            if (s.status === 'completed') done += 1
            else if (s.status === 'in_progress') upcoming += 1
            else if (s.status === 'scheduled' && s.scheduled_at) {
                if (new Date(s.scheduled_at).getTime() < now) overdue += 1
                else upcoming += 1
            }
        }
        return { overdue, upcoming, completed: done }
    }, [visibleSessions])

    const goToSession = (session: AssessmentSessionListItem) => {
        if (session.status === 'completed') {
            router.push(`/students/${session.student_id}/avaliacoes/${session.id}/result`)
        } else {
            router.push(`/students/${session.student_id}/avaliacoes/${session.id}`)
        }
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={onboardingState}
        >
            {/* Header — paralelo a /forms */}
            <div data-onboarding="avaliacoes-header" className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">
                            Avaliações
                        </h1>
                        <TourHelpButton tourId="tour_assessments_first_time" />
                    </div>
                    <p className="mt-1 text-sm text-k-text-tertiary">
                        Sessões presenciais com captura de medições
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {assessmentTemplates.length > 0 && (
                        <button
                            data-onboarding="assessments-new-session"
                            onClick={() => {
                                setPresetStudentIdForCreate(undefined)
                                setCreateSessionOpen(true)
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity"
                        >
                            <Plus size={14} />
                            Nova avaliação
                        </button>
                    )}
                    <button
                        data-onboarding="assessments-new-template"
                        onClick={() => router.push('/avaliacoes/templates/new')}
                        className="flex items-center gap-2 px-4 py-2 rounded-control border border-k-border-primary bg-surface-card text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset text-sm font-medium transition-colors"
                    >
                        <Plus size={14} />
                        Novo template
                    </button>
                </div>
            </div>

            <FormsAvaliacoesSegmented active="avaliacoes" />

            {/* Régua de métricas */}
            <div className="mb-6">
                <KpiRuler
                    ariaLabel="Indicadores de avaliações"
                    cells={[
                        { key: 'total', label: 'Avaliações', value: visibleSessions.length, sub: 'no total' },
                        {
                            key: 'overdue',
                            label: 'Em atraso',
                            value: assessmentCounts.overdue,
                            tone: assessmentCounts.overdue > 0 ? 'red' : 'neutral',
                            sub: assessmentCounts.overdue > 0 ? 'a reagendar' : 'nenhuma',
                        },
                        { key: 'upcoming', label: 'Próximas', value: assessmentCounts.upcoming, sub: 'agendadas' },
                        {
                            key: 'completed',
                            label: 'Concluídas',
                            value: assessmentCounts.completed,
                            sub: 'com resultado',
                        },
                    ]}
                />
            </div>

            {/* Proactive CTA — só aparece quando há em atraso */}
            {assessmentCounts.overdue > 0 && (
                <button
                    onClick={() => setAssessmentFilter('overdue')}
                    className="mb-6 w-full rounded-panel border border-k-border-subtle bg-surface-card px-5 py-3 flex items-center justify-between hover:bg-surface-inset transition-colors"
                >
                    <span className="flex items-center gap-2.5 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="font-medium text-k-text-primary">
                            {assessmentCounts.overdue} {assessmentCounts.overdue === 1 ? 'avaliação em atraso' : 'avaliações em atraso'}
                        </span>
                        <span className="text-k-text-tertiary">— reagende ou cancele</span>
                    </span>
                    <ChevronRight size={16} className="text-k-text-tertiary" />
                </button>
            )}

            <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
                <div className="space-y-6">
                    {/* "Em atraso" callout */}
                    {overdueSessions.length > 0 && (
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-k-border-subtle">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Em atraso</h2>
                                <span className="font-mono text-[11px] tabular-nums text-k-text-tertiary">{overdueSessions.length}</span>
                            </div>
                            <ul className="divide-y divide-k-border-subtle">
                                {overdueSessions.map(session => (
                                    <li key={session.id}>
                                        <SessionListItem session={session} onClick={() => goToSession(session)} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* "Próximas" (≤ 7 dias) callout */}
                    {upcomingNext7d.length > 0 && (
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-k-border-subtle">
                                <Send size={13} className="text-k-text-tertiary" />
                                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Próximas</h2>
                                <span className="font-mono text-[11px] tabular-nums text-k-text-tertiary">{upcomingNext7d.length}</span>
                            </div>
                            <ul className="divide-y divide-k-border-subtle">
                                {upcomingNext7d.map(session => (
                                    <li key={session.id}>
                                        <SessionListItem session={session} onClick={() => goToSession(session)} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Templates de avaliação */}
                    {templates.length > 0 && (
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-k-border-subtle">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Templates de avaliação</h2>
                                    <span className="font-mono text-[11px] tabular-nums text-k-text-tertiary">{templates.length}</span>
                                </div>
                                <button
                                    onClick={() => router.push('/avaliacoes/templates')}
                                    className="flex items-center gap-1 text-xs font-medium text-k-text-secondary hover:text-k-text-primary transition-colors"
                                >
                                    Gerenciar
                                    <ChevronRight size={13} />
                                </button>
                            </div>

                            <div className="divide-y divide-k-border-subtle">
                                {templates.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => router.push(`/avaliacoes/templates/new?edit=${t.id}`)}
                                        className="w-full flex items-center justify-between py-3 px-5 hover:bg-surface-inset transition-colors text-left group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Activity size={14} className="text-k-text-tertiary shrink-0" />
                                            <span className="text-sm text-k-text-primary truncate">
                                                {t.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-k-text-tertiary shrink-0">
                                            {t.sectionCount > 0 && (
                                                <span className="font-mono tabular-nums">{t.sectionCount} {t.sectionCount === 1 ? 'seção' : 'seções'}</span>
                                            )}
                                            <span className="text-k-text-quaternary">·</span>
                                            <span className="font-mono tabular-nums">{t.sessionCount} {t.sessionCount === 1 ? 'sessão' : 'sessões'}</span>
                                            <ChevronRight size={14} className="text-k-text-quaternary group-hover:text-k-text-tertiary transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6 lg:flex lg:flex-col lg:min-h-0">
                    {/* Todas as avaliações */}
                    {visibleSessions.length > 0 ? (
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden lg:flex lg:flex-col lg:max-h-[calc(100vh-220px)]">
                            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-k-border-subtle lg:flex-shrink-0">
                                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Todas as avaliações</h2>
                                <div className="inline-flex rounded-control border border-k-border-primary bg-surface-card overflow-hidden">
                                    {([
                                        { key: 'all' as const, label: 'Todas', count: visibleSessions.length },
                                        { key: 'overdue' as const, label: 'Em atraso', count: assessmentCounts.overdue },
                                        { key: 'upcoming' as const, label: 'Próximas', count: assessmentCounts.upcoming },
                                        { key: 'completed' as const, label: 'Concluídas', count: assessmentCounts.completed },
                                    ]).map(f => (
                                        <button
                                            key={f.key}
                                            onClick={() => setAssessmentFilter(f.key)}
                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                assessmentFilter === f.key
                                                    ? 'bg-surface-inset text-k-text-primary font-semibold'
                                                    : 'text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset/60'
                                            }`}
                                        >
                                            {f.label} <span className="font-mono tabular-nums text-k-text-tertiary">{f.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredAssessments.length === 0 ? (
                                <div className="px-5 py-8 text-center lg:flex-1">
                                    <p className="text-xs text-k-text-tertiary">
                                        Nenhuma avaliação neste filtro.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-k-border-subtle lg:flex-1 lg:overflow-y-auto">
                                    {filteredAssessments.map(session => (
                                        <li key={session.id}>
                                            <SessionListItem session={session} onClick={() => goToSession(session)} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : assessmentTemplates.length === 0 ? (
                        // Empty: 0 templates — começa pelo template
                        <div className="rounded-panel border border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset border border-k-border-subtle">
                                <Activity className="h-5 w-5 text-k-text-tertiary" />
                            </div>
                            <p className="text-sm font-semibold text-k-text-primary">Comece criando um template</p>
                            <p className="mx-auto mt-1 max-w-sm text-xs text-k-text-tertiary">
                                Use um template de sistema do Kinevo ou crie o seu para agendar avaliações.
                            </p>
                            <button
                                onClick={() => router.push('/avaliacoes/templates/new')}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Criar template de avaliação
                            </button>
                        </div>
                    ) : (
                        // Empty: tem templates mas 0 sessões
                        <div className="rounded-panel border border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-inset border border-k-border-subtle">
                                <Activity className="h-5 w-5 text-k-text-tertiary" />
                            </div>
                            <p className="text-sm font-semibold text-k-text-primary">Nenhuma avaliação ainda</p>
                            <p className="mx-auto mt-1 max-w-sm text-xs text-k-text-tertiary">
                                Use &ldquo;Nova avaliação&rdquo; acima para agendar a primeira sessão.
                            </p>
                        </div>
                    )}

                </div>
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

            <TourRunner
                tourId="tour_assessments_first_time"
                steps={TOUR_STEPS.tour_assessments_first_time}
            />
        </AppLayout>
    )
}

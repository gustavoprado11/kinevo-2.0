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

    const headerCount = visibleSessions.length

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
            <div data-onboarding="avaliacoes-header" className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-k-text-primary">
                            Avaliações
                        </h1>
                        {headerCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#F5F5F7] text-sm text-[#6E6E73] dark:bg-glass-bg dark:text-k-text-tertiary dark:border dark:border-k-border-subtle">
                                {headerCount}
                            </span>
                        )}
                        <TourHelpButton tourId="tour_assessments_first_time" />
                    </div>
                    <p className="mt-1 text-sm text-[#86868B] dark:text-k-text-tertiary">
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
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium rounded-control transition-all dark:bg-violet-600 dark:hover:bg-violet-500"
                        >
                            <Plus size={14} />
                            Nova avaliação
                        </button>
                    )}
                    <button
                        data-onboarding="assessments-new-template"
                        onClick={() => router.push('/avaliacoes/templates/new')}
                        className="flex items-center gap-2 rounded-full bg-white border border-[#D2D2D7] text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] px-4 py-2 text-sm transition-all dark:rounded-xl dark:bg-transparent dark:border-k-border-primary dark:text-k-text-tertiary dark:hover:text-k-text-primary dark:hover:bg-transparent"
                    >
                        <Plus size={14} />
                        Novo template de avaliação
                    </button>
                </div>
            </div>

            <FormsAvaliacoesSegmented active="avaliacoes" />

            {/* Proactive CTA — só aparece quando há em atraso */}
            {assessmentCounts.overdue > 0 && (
                <button
                    onClick={() => setAssessmentFilter('overdue')}
                    className="mb-6 w-full bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-3 flex items-center justify-between hover:bg-red-500/10 transition-all"
                >
                    <span className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-medium text-[#1D1D1F] dark:text-k-text-primary">
                            {assessmentCounts.overdue} {assessmentCounts.overdue === 1 ? 'avaliação em atraso' : 'avaliações em atraso'}
                        </span>
                        <span className="text-[#86868B] dark:text-k-text-tertiary">
                            — reagende ou cancele
                        </span>
                    </span>
                    <ChevronRight size={16} className="text-[#86868B] dark:text-k-text-tertiary" />
                </button>
            )}

            <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
                <div className="space-y-6">
                {/* "Em atraso" callout — paralelo ao "Aguardando Feedback" do /forms */}
                {overdueSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#D2D2D7] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-transparent dark:border-k-border-subtle dark:shadow-none dark:rounded-none">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Em atraso</h2>
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-[10px] font-bold text-red-500 border border-red-500/20">
                                {overdueSessions.length}
                            </span>
                        </div>
                        <ul className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                            {overdueSessions.map(session => (
                                <li key={session.id}>
                                    <SessionListItem session={session} onClick={() => goToSession(session)} />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* "Próximas" (≤ 7 dias) callout — paralelo ao "Enviados pendentes" do /forms */}
                {upcomingNext7d.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#D2D2D7] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-transparent dark:border-k-border-subtle dark:shadow-none dark:rounded-none">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                            <Send size={14} className="text-[#7C3AED] dark:text-violet-400" />
                            <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Próximas</h2>
                            <span className="px-1.5 py-0.5 rounded-full bg-[#7C3AED]/10 text-[10px] font-bold text-[#7C3AED] border border-[#7C3AED]/20 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                                {upcomingNext7d.length}
                            </span>
                        </div>
                        <ul className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                            {upcomingNext7d.map(session => (
                                <li key={session.id}>
                                    <SessionListItem session={session} onClick={() => goToSession(session)} />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Templates section — paralelo a "Templates de Formulário" do /forms */}
                {templates.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#D2D2D7] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-transparent dark:border-k-border-subtle dark:shadow-none dark:rounded-none">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Templates de avaliação</h2>
                                <span className="text-[#86868B] dark:text-k-text-quaternary">
                                    {templates.length}
                                </span>
                            </div>
                            <button
                                onClick={() => router.push('/avaliacoes/templates')}
                                className="text-xs text-[#7C3AED] hover:text-[#6D28D9] transition-colors font-medium dark:text-k-text-quaternary dark:hover:text-k-text-secondary"
                            >
                                Gerenciar →
                            </button>
                        </div>

                        <div className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                            {templates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => router.push(`/avaliacoes/templates/new?edit=${t.id}`)}
                                    className="w-full flex items-center justify-between py-3 px-5 hover:bg-[#F5F5F7] transition-all text-left group cursor-pointer dark:hover:bg-glass-bg"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Activity size={14} className="text-violet-600 dark:text-violet-400" />
                                        <span className="text-sm text-[#1D1D1F] group-hover:text-[#1D1D1F] transition-colors truncate dark:text-k-text-secondary dark:group-hover:text-k-text-primary">
                                            {t.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-[#86868B] dark:text-k-text-quaternary shrink-0">
                                        {t.sectionCount > 0 && (
                                            <span>{t.sectionCount} {t.sectionCount === 1 ? 'seção' : 'seções'}</span>
                                        )}
                                        <span className="text-[#AEAEB2] dark:text-k-text-quaternary">·</span>
                                        <span>{t.sessionCount} {t.sessionCount === 1 ? 'sessão' : 'sessões'}</span>
                                        <ChevronRight size={14} className="text-k-border-subtle group-hover:text-k-text-tertiary transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                </div>

                <div className="space-y-6 lg:flex lg:flex-col lg:min-h-0">
                {/* "Todas as avaliações" — paralelo a "Todas as Respostas" do /forms */}
                {visibleSessions.length > 0 ? (
                    <div className="bg-white rounded-xl border border-[#D2D2D7] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden dark:bg-transparent dark:border-k-border-subtle dark:shadow-none dark:rounded-none lg:flex lg:flex-col lg:max-h-[calc(100vh-220px)]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8ED] dark:border-k-border-subtle lg:flex-shrink-0">
                            <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Todas as avaliações</h2>
                            <div className="flex items-center gap-2">
                                {([
                                    { key: 'all' as const, label: 'Todas', count: visibleSessions.length },
                                    { key: 'overdue' as const, label: 'Em atraso', count: assessmentCounts.overdue },
                                    { key: 'upcoming' as const, label: 'Próximas', count: assessmentCounts.upcoming },
                                    { key: 'completed' as const, label: 'Concluídas', count: assessmentCounts.completed },
                                ]).map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setAssessmentFilter(f.key)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                                            assessmentFilter === f.key
                                                ? 'bg-[#7C3AED] text-white dark:bg-violet-500/10 dark:text-violet-400 dark:border dark:border-violet-500/30'
                                                : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#E8E8ED] dark:bg-glass-bg dark:text-k-text-quaternary dark:border-k-border-subtle dark:hover:text-k-text-secondary'
                                        }`}
                                    >
                                        {f.label} ({f.count})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredAssessments.length === 0 ? (
                            <div className="px-5 py-8 text-center lg:flex-1">
                                <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">
                                    Nenhuma avaliação neste filtro.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-[#E8E8ED] dark:divide-k-border-subtle lg:flex-1 lg:overflow-y-auto">
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
                    <div className="rounded-2xl border-2 border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
                            <Activity className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                        </div>
                        <p className="text-sm font-semibold text-k-text-primary">Comece criando um template</p>
                        <p className="mx-auto mt-1 max-w-sm text-xs text-k-text-tertiary">
                            Use um template de sistema do Kinevo ou crie o seu para agendar avaliações.
                        </p>
                        <button
                            onClick={() => router.push('/avaliacoes/templates/new')}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6D28D9] dark:bg-violet-600 dark:hover:bg-violet-500"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Criar template de avaliação
                        </button>
                    </div>
                ) : (
                    // Empty: tem templates mas 0 sessões
                    <div className="rounded-2xl border-2 border-dashed border-k-border-subtle bg-surface-card p-10 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
                            <Activity className="h-5 w-5 text-violet-500 dark:text-violet-400" />
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

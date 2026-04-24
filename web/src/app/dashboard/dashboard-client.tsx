'use client'

import { useState, useMemo, lazy, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { StudentModal } from '@/components/student-modal'
import { TrainerProfileBanner } from '@/components/dashboard/trainer-profile-banner'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatCards } from '@/components/dashboard/stat-cards'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ExpiringPrograms } from '@/components/dashboard/expiring-programs'
import { UpcomingAppointmentsWidget } from '@/components/dashboard/upcoming-appointments-widget'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { WidgetPicker } from '@/components/dashboard/widget-picker'
import { WelcomeModal } from '@/components/onboarding/widgets/welcome-modal'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

// ── Lazy-loaded heavy widgets (code-split) ──
const AssistantActionCards = lazy(() => import('@/components/dashboard/assistant-action-cards').then(m => ({ default: m.AssistantActionCards })))
const DailyActivityFeed = lazy(() => import('@/components/dashboard/daily-activity-feed').then(m => ({ default: m.DailyActivityFeed })))
const WeeklyGoalsWidget = lazy(() => import('@/components/dashboard/weekly-goals-widget').then(m => ({ default: m.WeeklyGoalsWidget })))
const StudentRankingWidget = lazy(() => import('@/components/dashboard/student-ranking-widget').then(m => ({ default: m.StudentRankingWidget })))

import { CalendarOff, FolderArchive, Loader2 } from 'lucide-react'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
import { archiveStudent } from '@/actions/financial/archive-student'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import type { DashboardData } from '@/lib/dashboard/get-dashboard-data'
import type { WidgetId } from '@/stores/dashboard-layout-store'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
    onboarding_state?: OnboardingState | null
}

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    created_at: string
}

interface FormTemplateOption {
    id: string
    title: string
    trainer_id: string | null
}

interface DashboardClientProps {
    trainer: Trainer
    data: DashboardData
    initialStudents: Student[]
    selfStudentId?: string | null
    formTemplates?: FormTemplateOption[]
}

// ── Lazy loading skeleton ──
function WidgetSkeleton() {
    return (
        <div className="rounded-xl border border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card p-6 animate-pulse">
            <div className="h-4 w-32 bg-[#F0F0F5] dark:bg-white/5 rounded mb-4" />
            <div className="space-y-3">
                <div className="h-3 w-full bg-[#F0F0F5] dark:bg-white/5 rounded" />
                <div className="h-3 w-3/4 bg-[#F0F0F5] dark:bg-white/5 rounded" />
                <div className="h-3 w-1/2 bg-[#F0F0F5] dark:bg-white/5 rounded" />
            </div>
        </div>
    )
}

export function DashboardClient({ trainer, data, initialStudents, selfStudentId, formTemplates = [] }: DashboardClientProps) {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>(initialStudents)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; name: string } | null>(null)
    const [archiveLoading, setArchiveLoading] = useState(false)
    /**
     * Ativo quando o archive detectou rotinas ativas e precisa que o trainer
     * decida o que fazer com elas (encerrar junto ou manter).
     */
    const [appointmentPrompt, setAppointmentPrompt] = useState<{
        studentId: string
        studentName: string
        count: number
    } | null>(null)

    const handleStudentCreated = useCallback((newStudent: Student) => {
        setStudents(prev => [newStudent, ...prev])
        setIsModalOpen(false)
    }, [])

    const handleMarkAsPaid = useCallback(async (contractId: string) => {
        const result = await markAsPaid({ contractId })
        if (result.success) {
            router.refresh()
        }
    }, [router])

    const handleSellPlan = useCallback((studentId: string) => {
        router.push(`/financial/subscriptions?sell=${studentId}`)
    }, [router])

    const handleArchiveStudent = useCallback((studentId: string, studentName: string) => {
        setArchiveConfirm({ id: studentId, name: studentName })
    }, [])

    const confirmArchive = async () => {
        if (!archiveConfirm) return
        setArchiveLoading(true)
        const result = await archiveStudent({ studentId: archiveConfirm.id })
        setArchiveLoading(false)
        if (result.needsAppointmentDecision) {
            // Segundo passo: perguntar sobre os agendamentos ativos.
            setAppointmentPrompt({
                studentId: archiveConfirm.id,
                studentName: archiveConfirm.name,
                count: result.activeRoutinesCount ?? 0,
            })
            setArchiveConfirm(null)
            return
        }
        if (result.success) {
            setArchiveConfirm(null)
            router.refresh()
        } else {
            alert(result.error || 'Erro ao arquivar')
        }
    }

    const continueArchiveWithDecision = async (decision: 'keep' | 'cancel') => {
        if (!appointmentPrompt) return
        setArchiveLoading(true)
        const result = await archiveStudent({
            studentId: appointmentPrompt.studentId,
            appointmentDecision: decision,
        })
        setArchiveLoading(false)
        setAppointmentPrompt(null)
        if (result.success) {
            router.refresh()
        } else {
            alert(result.error || 'Erro ao arquivar')
        }
    }

    // Ranking now comes pre-computed from the server (weekly adherence).
    const rankedStudents = data.studentRanking

    // Widget render map — each widget ID maps to its JSX
    // Heavy widgets are wrapped in Suspense for code-split lazy loading
    const widgetMap: Partial<Record<WidgetId, React.ReactNode>> = useMemo(() => ({
        'stats': <StatCards stats={data.stats} />,
        'insights': (
            <Suspense fallback={<WidgetSkeleton />}>
                <AssistantActionCards
                    initialInsights={data.assistantInsights}
                    pendingFinancial={data.pendingFinancial}
                    pendingForms={data.pendingForms}
                    expiredPlans={data.expiredPlans}
                    trainerId={trainer.id}
                    onMarkAsPaid={handleMarkAsPaid}
                    onSellPlan={handleSellPlan}
                    onArchiveStudent={handleArchiveStudent}
                />
            </Suspense>
        ),
        'expiring-programs': <ExpiringPrograms programs={data.expiringPrograms} />,
        'activity-feed': (
            <Suspense fallback={<WidgetSkeleton />}>
                <DailyActivityFeed activities={data.dailyActivity} scheduledToday={data.scheduledToday} />
            </Suspense>
        ),
        'weekly-goals': (
            <Suspense fallback={<WidgetSkeleton />}>
                <WeeklyGoalsWidget
                    sessionsThisWeek={data.stats.sessionsThisWeek}
                    activeStudentsCount={data.stats.activeStudentsCount}
                    mrr={data.stats.mrr}
                />
            </Suspense>
        ),
        'student-ranking': (
            <Suspense fallback={<WidgetSkeleton />}>
                <StudentRankingWidget students={rankedStudents} />
            </Suspense>
        ),
        'upcoming-appointments': (
            <UpcomingAppointmentsWidget
                appointments={data.upcomingAppointments}
                studentsById={data.upcomingAppointmentStudents}
            />
        ),
    }), [data, trainer.id, rankedStudents, handleMarkAsPaid, handleSellPlan, handleArchiveStudent])

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
            onboardingState={trainer.onboarding_state}
            students={students.map(s => ({ id: s.id, name: s.name, status: s.status }))}
        >
            {/* Trainer Profile Banner (conditional, dismissible) */}
            <TrainerProfileBanner selfStudentId={selfStudentId} />

            {/* 1. Saudação — always fixed */}
            <DashboardHeader
                trainerName={trainer.name}
                students={students.map(s => ({ id: s.id, name: s.name, status: s.status }))}
            />

            {/* 2. Quick Actions — always fixed */}
            <div className="mb-5">
                <QuickActions onNewStudent={() => setIsModalOpen(true)} />
            </div>

            {/* 3. Widget Picker (shown when customizing) */}
            <WidgetPicker />

            {/* 4. Customizable Widget Grid */}
            <WidgetGrid widgetMap={widgetMap} />

            {/* Modals & Overlays */}
            <StudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStudentCreated={handleStudentCreated}
                trainerId={trainer.id}
                formTemplates={formTemplates}
            />

            <WelcomeModal trainerName={trainer.name} />
            <TourRunner tourId="welcome" steps={TOUR_STEPS.welcome} />

            {/* Archive Confirmation Modal */}
            {archiveConfirm && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !archiveLoading && setArchiveConfirm(null)} />
                    <div className="relative bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <FolderArchive className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">Arquivar Aluno?</h3>
                        <p className="text-muted-foreground text-sm text-center mb-6">
                            Tem certeza que deseja arquivar <span className="text-foreground font-medium">{archiveConfirm.name}</span>?
                            O aluno será desvinculado da sua conta e contratos ativos serão cancelados. O aluno manterá acesso ao app e ao histórico de treinos.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setArchiveConfirm(null)}
                                disabled={archiveLoading}
                                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmArchive}
                                disabled={archiveLoading}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {archiveLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Arquivando...</>
                                ) : (
                                    'Sim, Arquivar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appointment Decision Modal (segunda etapa do archive quando há rotinas) */}
            {appointmentPrompt && (
                <div className="fixed inset-0 z-float flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => !archiveLoading && setAppointmentPrompt(null)}
                    />
                    <div className="relative bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <CalendarOff className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground text-center mb-2">
                            E os agendamentos?
                        </h3>
                        <p className="text-muted-foreground text-sm text-center mb-6">
                            <span className="text-foreground font-medium">{appointmentPrompt.studentName}</span>{' '}
                            tem{' '}
                            <span className="text-foreground font-medium">
                                {appointmentPrompt.count}{' '}
                                {appointmentPrompt.count === 1 ? 'rotina ativa' : 'rotinas ativas'}
                            </span>
                            . Deseja encerrá-las também?
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => void continueArchiveWithDecision('cancel')}
                                disabled={archiveLoading}
                                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {archiveLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    'Arquivar e encerrar agendamentos'
                                )}
                            </button>
                            <button
                                onClick={() => void continueArchiveWithDecision('keep')}
                                disabled={archiveLoading}
                                className="w-full px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                Só arquivar aluno
                            </button>
                            <button
                                onClick={() => setAppointmentPrompt(null)}
                                disabled={archiveLoading}
                                className="w-full px-4 py-2 text-muted-foreground hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { StudentModal } from '@/components/student-modal'
import { DailyActivityFeed } from '@/components/dashboard/daily-activity-feed'
import { TrainerProfileBanner } from '@/components/dashboard/trainer-profile-banner'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { StatCards } from '@/components/dashboard/stat-cards'
import { PendingActions } from '@/components/dashboard/pending-actions'
import { ExpiringPrograms } from '@/components/dashboard/expiring-programs'
import { CompactTools } from '@/components/dashboard/compact-tools'
import { AssistantInsights } from '@/components/dashboard/assistant-insights'
import { WelcomeModal } from '@/components/onboarding/widgets/welcome-modal'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { FolderArchive, Loader2 } from 'lucide-react'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
import { archiveStudent } from '@/actions/financial/archive-student'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import type { DashboardData } from '@/lib/dashboard/get-dashboard-data'

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

export function DashboardClient({ trainer, data, initialStudents, selfStudentId, formTemplates = [] }: DashboardClientProps) {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>(initialStudents)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; name: string } | null>(null)
    const [archiveLoading, setArchiveLoading] = useState(false)

    const handleStudentCreated = (newStudent: Student) => {
        setStudents([newStudent, ...students])
        setIsModalOpen(false)
    }

    const handleMarkAsPaid = async (contractId: string) => {
        const result = await markAsPaid({ contractId })
        if (result.success) {
            router.refresh()
        }
    }

    const handleSellPlan = (studentId: string) => {
        router.push(`/financial/subscriptions?sell=${studentId}`)
    }

    const handleArchiveStudent = (studentId: string, studentName: string) => {
        setArchiveConfirm({ id: studentId, name: studentName })
    }

    const confirmArchive = async () => {
        if (!archiveConfirm) return
        setArchiveLoading(true)
        const result = await archiveStudent({ studentId: archiveConfirm.id })
        if (result.success) {
            setArchiveConfirm(null)
            router.refresh()
        } else {
            alert(result.error || 'Erro ao arquivar')
        }
        setArchiveLoading(false)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
            onboardingState={trainer.onboarding_state}
        >
            {/* Trainer Profile Banner (conditional, dismissible) */}
            <TrainerProfileBanner selfStudentId={selfStudentId} />

            {/* 1. Header: greeting + date + Sala de Treino */}
            <DashboardHeader trainerName={trainer.name} />

            {/* 2. Pending Actions (cross-module) */}
            <PendingActions
                pendingFinancial={data.pendingFinancial}
                pendingForms={data.pendingForms}
                inactiveStudents={data.inactiveStudents}
                expiredPlans={data.expiredPlans}
                activeStudentsCount={data.stats.activeStudentsCount}
                onMarkAsPaid={handleMarkAsPaid}
                onSellPlan={handleSellPlan}
                onArchiveStudent={handleArchiveStudent}
            />

            {/* 3. Treinos de Hoje (full width) */}
            <div className="mb-6">
                <DailyActivityFeed activities={data.dailyActivity} scheduledToday={data.scheduledToday} />
            </div>

            {/* 4. Stat Cards */}
            <StatCards stats={data.stats} />

            {/* 5. Assistant Insights */}
            <AssistantInsights initialInsights={data.assistantInsights} trainerId={trainer.id} />

            {/* 6. Expiring Programs (conditional) */}
            <ExpiringPrograms programs={data.expiringPrograms} />

            {/* 7. Compact Tools */}
            <CompactTools onNewStudent={() => setIsModalOpen(true)} />

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
        </AppLayout>
    )
}

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
import { WelcomeModal } from '@/components/onboarding/widgets/welcome-modal'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { markAsPaid } from '@/actions/financial/mark-as-paid'
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

interface DashboardClientProps {
    trainer: Trainer
    data: DashboardData
    initialStudents: Student[]
    selfStudentId?: string | null
}

export function DashboardClient({ trainer, data, initialStudents, selfStudentId }: DashboardClientProps) {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>(initialStudents)
    const [isModalOpen, setIsModalOpen] = useState(false)

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
                activeStudentsCount={data.stats.activeStudentsCount}
                onMarkAsPaid={handleMarkAsPaid}
            />

            {/* 3. Treinos de Hoje (full width) */}
            <div className="mb-6">
                <DailyActivityFeed activities={data.dailyActivity} scheduledToday={data.scheduledToday} />
            </div>

            {/* 4. Stat Cards */}
            <StatCards stats={data.stats} />

            {/* 5. Expiring Programs (conditional) */}
            <ExpiringPrograms programs={data.expiringPrograms} />

            {/* 6. Compact Tools */}
            <CompactTools onNewStudent={() => setIsModalOpen(true)} />

            {/* Modals & Overlays */}
            <StudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onStudentCreated={handleStudentCreated}
                trainerId={trainer.id}
            />

            <WelcomeModal trainerName={trainer.name} />
            <TourRunner tourId="welcome" steps={TOUR_STEPS.welcome} />
        </AppLayout>
    )
}

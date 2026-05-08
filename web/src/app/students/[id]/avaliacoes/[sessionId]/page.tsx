import { notFound, redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getAssessmentSessionDetail } from '@/actions/assessments/get-session'
import { AppLayout } from '@/components/layout'
import { SessionDetailClient } from './session-detail-client'

interface PageProps {
    params: Promise<{ id: string; sessionId: string }>
}

export default async function AssessmentSessionDetailPage({ params }: PageProps) {
    const { trainer } = await getTrainerWithSubscription()
    const { id: studentId, sessionId } = await params

    const result = await getAssessmentSessionDetail(sessionId)
    if (!result.success || !result.data) {
        notFound()
    }
    const detail = result.data

    if (detail.session.student_id !== studentId) {
        notFound()
    }

    // Completed sessions land directly on the result view to avoid a useless
    // round-trip through the detail page.
    if (detail.session.status === 'completed') {
        redirect(`/students/${studentId}/avaliacoes/${sessionId}/result`)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <SessionDetailClient detail={detail} studentId={studentId} />
        </AppLayout>
    )
}

import { notFound } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getAssessmentSessionDetail } from '@/actions/assessments/get-session'
import { getAssessmentSessionList } from '@/actions/assessments/get-session-list'
import { AppLayout } from '@/components/layout'
import { ResultClient } from './result-client'

interface PageProps {
    params: Promise<{ id: string; sessionId: string }>
}

export default async function AssessmentResultPage({ params }: PageProps) {
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

    // History for sparkline + comparison: all completed sessions for this
    // student, most recent first.
    const histRes = await getAssessmentSessionList({
        studentId,
        filter: 'completed',
        limit: 20,
    })
    const history = histRes.success ? (histRes.data ?? []) : []

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <ResultClient detail={detail} studentId={studentId} history={history} />
        </AppLayout>
    )
}

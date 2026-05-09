import { redirect } from 'next/navigation'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { AppLayout } from '@/components/layout'
import { getAssessmentSessionDetail } from '@/actions/assessments/get-session'
import type { AssessmentTemplateSchema, MeasurementInput } from '@kinevo/shared/types/assessments'
import { CaptureClient } from './capture-client'

interface PageProps {
    params: Promise<{ id: string; sessionId: string }>
}

// M10B — rota nova /students/[id]/avaliacoes/[sessionId]/capture.
// Server component faz fetch da sessão + valida status (completed redireciona
// pra result; cancelled redireciona pro detail) e passa pro client orchestrator.
export default async function CaptureSessionPage({ params }: PageProps) {
    const { id: studentId, sessionId } = await params
    const { trainer } = await getTrainerWithSubscription()

    const result = await getAssessmentSessionDetail(sessionId)
    if (!result.success || !result.data) {
        redirect(`/students/${studentId}/avaliacoes/${sessionId}`)
    }

    const detail = result.data
    const status = detail.session.status

    // Edge case: sessão completed → vai pro result direto.
    if (status === 'completed') {
        redirect(`/students/${studentId}/avaliacoes/${sessionId}/result`)
    }
    // Edge case: cancelled → bounce de volta pro detalhe.
    if (status === 'cancelled') {
        redirect(`/students/${studentId}/avaliacoes/${sessionId}`)
    }

    // Schema vem do snapshot da sessão (frozen no create) ou do template ativo.
    const schema =
        (detail.session.template_snapshot as AssessmentTemplateSchema | null)
        ?? ((detail.template?.schema_json as AssessmentTemplateSchema | null) ?? null)

    if (!schema) {
        redirect(`/students/${studentId}/avaliacoes/${sessionId}`)
    }

    const studentName = (detail.student as { name?: string } | null)?.name ?? 'Aluno'
    const studentAvatar = (detail.student as { avatar_url?: string | null } | null)?.avatar_url ?? null
    const templateTitle = detail.template?.title ?? 'Avaliação'
    const measurements = ((detail.measurements ?? []) as unknown) as MeasurementInput[]

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={trainer.onboarding_state ?? null}
        >
            <CaptureClient
                studentId={studentId}
                sessionId={sessionId}
                studentName={studentName}
                studentAvatar={studentAvatar}
                templateTitle={templateTitle}
                schema={schema}
                initialMeasurements={measurements}
                notes={detail.session.notes ?? null}
            />
        </AppLayout>
    )
}

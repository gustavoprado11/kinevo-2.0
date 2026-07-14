// Consultoria IA — fila de validação (o PORTÃO humano do loop).
// Server Component: auth → reconcile (detecta anamneses respondidas) → fila.
// docs/rede-consultoria-ia/PLANO.md §5

import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout'
import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { reconcileConsultoriaRequests } from '@/actions/consultoria/reconcile-consultoria'
import { ConsultoriaClient, type ConsultoriaListItem } from './consultoria-client'

// A geração (server action disparada desta página) roda o pipeline LLM — pode
// passar dos 60s em cold start. Mesmo teto do ai-canvas.
export const maxDuration = 120

export default async function ConsultoriaPage() {
    const { trainer } = await getTrainerWithSubscription()

    // Beta fechado (migration 251): quem não tem o flag não tem a rota. A sidebar
    // já esconde o item, mas o URL é adivinhável — o corte de verdade é aqui.
    if (trainer.consultoria_enabled !== true) redirect('/dashboard')

    const supabase = await createClient()

    // Avança pedidos awaiting_anamnese cuja anamnese já foi respondida.
    await reconcileConsultoriaRequests(supabase, trainer.id)

    const [{ data: requests }, { data: trainerRow }] = await Promise.all([
        supabase
            .from('consultoria_requests')
            .select('id, student_id, status, triage_level, error_message, created_at, updated_at, students ( name )')
            .eq('trainer_id', trainer.id)
            .order('updated_at', { ascending: false })
            .limit(200),
        supabase
            .from('trainers')
            .select('landing_cref, ai_prescriptions_enabled')
            .eq('id', trainer.id)
            .single(),
    ])

    const items: ConsultoriaListItem[] = (requests ?? []).map(r => {
        const student = r.students as { name: string | null } | null
        return {
            id: r.id,
            studentId: r.student_id,
            studentName: student?.name ?? 'Aluno',
            status: r.status,
            triageLevel: r.triage_level,
            errorMessage: r.error_message,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }
    })

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
            onboardingState={trainer.onboarding_state ?? undefined}
            trainerModalityFocus={trainer.modality_focus ?? undefined}
        >
            <ConsultoriaClient
                items={items}
                hasCref={!!trainerRow?.landing_cref?.trim()}
                aiEnabled={trainerRow?.ai_prescriptions_enabled === true}
            />
        </AppLayout>
    )
}

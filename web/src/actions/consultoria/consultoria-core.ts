/**
 * Consultoria IA — núcleo compartilhado (server-only, SEM 'use server').
 *
 * Segue o padrão de assign-form-core.ts: helpers puros que as actions ('use
 * server') e os Server Components importam. O loop completo está descrito em
 * docs/rede-consultoria-ia/PLANO.md §5 e na migration 226.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@kinevo/shared/types/database'
import type { PrescriptionOutputSnapshot } from '@kinevo/shared/types/prescription'
import { extractAnswers } from '@/lib/consultoria/answers'
import { runTriage, type TriageResult } from '@/lib/consultoria/triage'

type DBClient = SupabaseClient<Database>

export type ConsultoriaRequestRow = Database['public']['Tables']['consultoria_requests']['Row']

/** Template de anamnese usado pela consultoria (inclui os 7 itens PAR-Q). */
export const INITIAL_ASSESSMENT_KEY = 'initial_assessment'

/** Anamnese respondida há menos disso é reaproveitada sem reenviar o form. */
export const RECENT_ANAMNESE_DAYS = 60

export const OPEN_STATUSES = [
    'awaiting_anamnese',
    'ready_to_generate',
    'generating',
    'blocked',
    'pending_validation',
] as const

export interface AuthedTrainer {
    id: string
    name: string | null
    cref: string | null
    aiPrescriptionsEnabled: boolean
}

/** Auth inline padrão do repo (CLAUDE.md §Server Actions) + campos da consultoria. */
export async function resolveTrainer(supabase: DBClient): Promise<AuthedTrainer | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, landing_cref, ai_prescriptions_enabled')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return null
    return {
        id: trainer.id,
        name: trainer.name,
        cref: trainer.landing_cref,
        aiPrescriptionsEnabled: trainer.ai_prescriptions_enabled === true,
    }
}

/** ID do template de sistema da Avaliação Inicial (mesma query do questionnaire-actions). */
export async function getInitialAssessmentTemplateId(supabase: DBClient): Promise<string | null> {
    const { data: template } = await supabase
        .from('form_templates')
        .select('id')
        .eq('system_key', INITIAL_ASSESSMENT_KEY)
        .eq('is_active', true)
        .maybeSingle()
    return template?.id ?? null
}

export interface AnamneseSubmission {
    id: string
    answers_json: Json | null
    submitted_at: string | null
}

/**
 * Última Avaliação Inicial RESPONDIDA do aluno, opcionalmente a partir de uma
 * data (reconcile usa created_at do pedido; start usa a janela de 60 dias).
 */
export async function findLatestSubmittedAnamnese(
    supabase: DBClient,
    templateId: string,
    studentId: string,
    sinceIso?: string,
): Promise<AnamneseSubmission | null> {
    let query = supabase
        .from('form_submissions')
        .select('id, answers_json, submitted_at')
        .eq('form_template_id', templateId)
        .eq('student_id', studentId)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(1)

    if (sinceIso) query = query.gte('submitted_at', sinceIso)

    const { data } = await query.maybeSingle()
    return data ?? null
}

/** Roda a triagem determinística sobre o answers_json cru da submission. */
export function triageSubmission(answersJson: Json | null): TriageResult {
    return runTriage(extractAnswers(answersJson))
}

// ============================================================================
// Conversor: PrescriptionOutputSnapshot → payload da RPC create_assigned_program_tree
// ============================================================================
// O pipeline de prescrição grava a generation com assigned_program_id NULL (o
// fluxo do builder cria o programa só no save manual). Na consultoria o rascunho
// precisa EXISTIR antes do portão de validação, então materializamos a árvore
// aqui — pela MESMA RPC transacional que o Assistente MCP usa (migration 214),
// garantindo árvore idêntica à do builder.

export interface TreePayload {
    program: { name: string; description: string | null; duration_weeks: number | null }
    workouts: Array<Record<string, unknown>>
}

export function snapshotToTreePayload(snapshot: PrescriptionOutputSnapshot): TreePayload {
    const workouts = snapshot.workouts.map((w, wi) => ({
        name: w.name,
        order_index: w.order_index ?? wi,
        scheduled_days: Array.isArray(w.scheduled_days) ? w.scheduled_days : [],
        items: w.items
            // 'superset' no snapshot é pai virtual sem children materializados —
            // o motor determinístico não emite; descarta defensivamente.
            .filter(item => (item.item_type ?? 'exercise') !== 'superset')
            .map((item, ii) => ({
                item_type: item.item_type ?? 'exercise',
                order_index: item.order_index ?? ii,
                exercise_id: item.exercise_id ?? null,
                substitute_exercise_ids: item.substitute_exercise_ids ?? [],
                sets: item.sets ?? null,
                reps: item.reps ?? null,
                rest_seconds: item.rest_seconds ?? null,
                notes: item.notes ?? null,
                item_config: item.item_config ?? {},
                method_key: null,
                rounds: 1,
                exercise_name: item.exercise_name ?? null,
                exercise_muscle_group: item.exercise_muscle_group ?? null,
                exercise_equipment: item.exercise_equipment ?? null,
            })),
    }))

    return {
        program: {
            name: snapshot.program.name,
            description: snapshot.program.description ?? null,
            duration_weeks: snapshot.program.duration_weeks ?? null,
        },
        workouts,
    }
}

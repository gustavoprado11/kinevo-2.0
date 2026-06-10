'use server'

import { revalidatePath } from 'next/cache'
import type { Json } from '@kinevo/shared/types/database'
import { createClient } from '@/lib/supabase/server'

import type {
    TrainingLevel,
    PrescriptionGoal,
    AiMode,
    MedicalRestriction,
    StudentPrescriptionProfile,
} from '@kinevo/shared/types/prescription'

// ============================================================================
// Input
// ============================================================================

interface SavePrescriptionProfileInput {
    student_id: string
    training_level: TrainingLevel
    goal: PrescriptionGoal
    available_days: number[]
    session_duration_minutes: number
    available_equipment: string[]
    favorite_exercise_ids: string[]
    disliked_exercise_ids: string[]
    medical_restrictions: MedicalRestriction[]
    ai_mode: AiMode
    cycle_observation?: string
    /**
     * Phase 3 — trainer-set weekly volume bounds per muscle group.
     *   { min, max }    — range or exact target (when min === max)
     *   { min: 0, max: 0 } — skip direct isolation work for this group
     * Persisted to JSONB column student_prescription_profiles.volume_overrides
     * (migration 114). Empty/missing = no overrides.
     *
     * Legacy plain-number form is also accepted (treated as min === max ===
     * the number) so older clients / persisted data don't break.
     */
    volume_overrides?: Record<string, number | { min: number; max: number }>
    /**
     * Trainer's most recent answers to the agent clarifying questions,
     * keyed by stable question_id. Pre-fills the Refinar panel on next
     * generation. Persisted to JSONB column agent_answers (migration 115).
     */
    agent_answers?: Record<string, { selectedOptions: string[]; textInput: string }>
}

// ============================================================================
// Response
// ============================================================================

interface SavePrescriptionProfileResult {
    success: boolean
    error?: string
    profile?: StudentPrescriptionProfile
}

// ============================================================================
// Action
// ============================================================================

export async function savePrescriptionProfile(
    input: SavePrescriptionProfileInput,
): Promise<SavePrescriptionProfileResult> {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // 2. Trainer lookup
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, ai_prescriptions_enabled')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // 3. Feature flag check
    // @ts-ignore — ai_prescriptions_enabled added in migration 036, types not yet regenerated
    if (!trainer.ai_prescriptions_enabled) {
        return { success: false, error: 'Módulo de prescrição IA não está habilitado para sua conta.' }
    }

    // 4. Validate student exists (RLS ensures it belongs to this trainer)
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('id', input.student_id)
        .single()

    if (studentError || !student) {
        return { success: false, error: 'Aluno não encontrado' }
    }

    // 5. Input validation
    if (!input.student_id) {
        return { success: false, error: 'student_id é obrigatório.' }
    }
    if (input.available_days.length === 0) {
        return { success: false, error: 'Selecione pelo menos 1 dia disponível.' }
    }
    if (input.available_days.length > 6) {
        return { success: false, error: 'O máximo é 6 dias por semana.' }
    }
    const invalidDays = input.available_days.filter(d => d < 0 || d > 6)
    if (invalidDays.length > 0) {
        return { success: false, error: `Dias inválidos: ${invalidDays.join(', ')}. Use 0 (Dom) a 6 (Sáb).` }
    }
    if (input.session_duration_minutes < 20 || input.session_duration_minutes > 180) {
        return { success: false, error: 'Duração da sessão deve estar entre 20 e 180 minutos.' }
    }
    // Volume overrides validation: keys are muscle group names (free-form
    // strings — we trust the UI to send only known groups). Values can be
    // either a plain number (legacy single-target shape) or a {min, max}
    // pair. Both bounds must be integers in [0, 40]; min must not exceed
    // max. Zero is allowed because it carries explicit semantics ("skip
    // isolation for this group"); the prompt builder + validator handle
    // that downstream.
    if (input.volume_overrides) {
        for (const [group, raw] of Object.entries(input.volume_overrides)) {
            const min = typeof raw === 'number' ? raw : raw?.min
            const max = typeof raw === 'number' ? raw : raw?.max
            if (!Number.isFinite(min) || !Number.isFinite(max)) {
                return {
                    success: false,
                    error: `Volume inválido para "${group}": valor não numérico.`,
                }
            }
            if (min! < 0 || min! > 40 || max! < 0 || max! > 40) {
                return {
                    success: false,
                    error: `Volume inválido para "${group}": ${min}-${max}. Use inteiros entre 0 e 40.`,
                }
            }
            if (min! > max!) {
                return {
                    success: false,
                    error: `Volume inválido para "${group}": mínimo (${min}) maior que máximo (${max}).`,
                }
            }
        }
    }

    // 6. Upsert (student_id is UNIQUE in the table)
    // jsonb na fronteira: shapes locais são estruturalmente compatíveis com Json
    const { data: profile, error: upsertError } = await supabase
        .from('student_prescription_profiles')
        .upsert(
            {
                student_id: input.student_id,
                trainer_id: trainer.id,
                training_level: input.training_level,
                goal: input.goal,
                available_days: input.available_days,
                session_duration_minutes: input.session_duration_minutes,
                available_equipment: input.available_equipment,
                favorite_exercise_ids: input.favorite_exercise_ids,
                disliked_exercise_ids: input.disliked_exercise_ids,
                medical_restrictions: input.medical_restrictions as unknown as Json,
                ai_mode: input.ai_mode,
                cycle_observation: input.cycle_observation || null,
                volume_overrides: (input.volume_overrides ?? {}) as unknown as Json,
                ...(input.agent_answers !== undefined
                    ? { agent_answers: input.agent_answers as unknown as Json }
                    : {}),
            },
            { onConflict: 'student_id' },
        )
        .select('*')
        .single()

    if (upsertError) {
        console.error('[savePrescriptionProfile] upsert error:', upsertError)
        return { success: false, error: 'Erro ao salvar perfil de prescrição.' }
    }

    // 7. Revalidate student page
    revalidatePath(`/students/${input.student_id}`)

    // jsonb na leitura: Row genérico (Json) → tipo rico do domínio
    return { success: true, profile: profile as unknown as StudentPrescriptionProfile }
}

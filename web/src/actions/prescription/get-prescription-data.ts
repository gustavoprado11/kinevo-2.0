'use server'

import { createClient } from '@/lib/supabase/server'
import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
} from '@kinevo/shared/types/prescription'

// ============================================================================
// Response types (exported so prescribe/page.tsx can reuse)
// ============================================================================

export interface ActiveProgram {
    id: string
    name: string
    description: string | null
    duration_weeks: number | null
    status: string
    started_at: string | null
    created_at: string
}

export interface RecentSession {
    id: string
    status: string
    completed_at: string | null
    duration_seconds: number | null
    rpe: number | null
    assigned_program_id: string
}

export interface PrescriptionData {
    profile: StudentPrescriptionProfile | null
    exercises: PrescriptionExerciseRef[]
    recentSessions: RecentSession[]
    activeProgram: ActiveProgram | null
    aiEnabled: boolean
}

interface GetPrescriptionDataResult {
    success: boolean
    error?: string
    data?: PrescriptionData
}

// ============================================================================
// Supabase client type (used by exported helpers)
// ============================================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// ============================================================================
// Server Action (used when called from client components)
// ============================================================================

export async function getPrescriptionData(
    studentId: string,
): Promise<GetPrescriptionDataResult> {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // 2. Trainer lookup + feature flag
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, ai_prescriptions_enabled')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // 3. Validate student exists (RLS ensures it belongs to this trainer)
    const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .single()

    if (!student) {
        return { success: false, error: 'Aluno não encontrado' }
    }

    // @ts-ignore — ai_prescriptions_enabled from migration 036
    const aiEnabled = !!trainer.ai_prescriptions_enabled

    // 4. Fetch all data in parallel
    const [profileResult, exercisesResult, sessionsResult, programResult] = await Promise.all([
        fetchPrescriptionProfile(supabase, studentId),
        fetchExercises(supabase),
        fetchRecentSessions(supabase, studentId),
        fetchActiveProgram(supabase, studentId),
    ])

    return {
        success: true,
        data: {
            profile: profileResult,
            exercises: exercisesResult,
            recentSessions: sessionsResult,
            activeProgram: programResult,
            aiEnabled,
        },
    }
}

// ============================================================================
// Exported helpers (used by prescribe/page.tsx server component directly)
// ============================================================================

/**
 * Fetches all prescription data using an already-authenticated supabase client.
 * Used by server components that already validated auth via getTrainerWithSubscription().
 * RLS handles ownership — no manual trainer_id check needed.
 */
export async function fetchPrescriptionDataDirect(
    supabase: SupabaseClient,
    studentId: string,
    trainerId: string,
): Promise<PrescriptionData> {
    // Check feature flag
    const { data: trainerRow } = await supabase
        .from('trainers')
        .select('ai_prescriptions_enabled')
        .eq('id', trainerId)
        .single()

    // @ts-ignore — ai_prescriptions_enabled from migration 036
    const aiEnabled = !!trainerRow?.ai_prescriptions_enabled

    const [profileResult, exercisesResult, sessionsResult, programResult] = await Promise.all([
        fetchPrescriptionProfile(supabase, studentId),
        fetchExercises(supabase),
        fetchRecentSessions(supabase, studentId),
        fetchActiveProgram(supabase, studentId),
    ])

    return {
        profile: profileResult,
        exercises: exercisesResult,
        recentSessions: sessionsResult,
        activeProgram: programResult,
        aiEnabled,
    }
}

// ============================================================================
// Data fetchers
// ============================================================================

/**
 * Fetch the student's prescription profile (if it exists).
 */
async function fetchPrescriptionProfile(
    supabase: SupabaseClient,
    studentId: string,
): Promise<StudentPrescriptionProfile | null> {
    // @ts-ignore — table not in generated types yet
    const { data, error } = await supabase
        .from('student_prescription_profiles')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle()

    if (error) {
        console.error('[getPrescriptionData] profile error:', error)
        return null
    }

    return data as StudentPrescriptionProfile | null
}

/**
 * Fetch all available exercises (system + trainer-owned, non-archived)
 * with their muscle groups, mapped to PrescriptionExerciseRef.
 */
async function fetchExercises(
    supabase: SupabaseClient,
): Promise<PrescriptionExerciseRef[]> {
    const { data: exercises, error } = await supabase
        .from('exercises')
        .select(`
            id,
            name,
            equipment,
            is_archived,
            difficulty_level,
            is_primary_movement,
            session_position,
            exercise_muscle_groups (
                muscle_groups (
                    id,
                    name
                )
            )
        `)
        .eq('is_archived', false)
        .order('name', { ascending: true })

    if (error) {
        console.error('[getPrescriptionData] exercises error:', error)
        return []
    }

    return (exercises || []).map((e: any) => {
        const muscleGroupNames: string[] = (e.exercise_muscle_groups || [])
            .map((emg: any) => emg.muscle_groups?.name)
            .filter(Boolean)

        return {
            id: e.id,
            name: e.name,
            muscle_group_names: muscleGroupNames,
            equipment: e.equipment || null,
            // Compound heuristic: exercises linked to 2+ muscle groups are compound.
            // Single-group exercises may still be compound (e.g., Agachamento is only "Pernas"),
            // so we also check common compound exercise name patterns.
            is_compound: muscleGroupNames.length >= 2 || isCompoundByName(e.name),
            difficulty_level: e.difficulty_level || 'intermediate',
            is_primary_movement: e.is_primary_movement || false,
            session_position: e.session_position || 'middle',
        } satisfies PrescriptionExerciseRef
    })
}

/**
 * Checks if an exercise name matches known compound exercise patterns.
 * Fallback for exercises with only 1 muscle group that are still compound
 * (e.g., "Agachamento Livre" is tagged only under "Pernas").
 */
const COMPOUND_NAME_PATTERNS = [
    'supino', 'press', 'remada', 'puxada', 'barra fixa', 'pulldown',
    'agachamento', 'leg press', 'terra', 'passada', 'lunge', 'avanço',
    'stiff', 'desenvolvimento', 'press militar', 'hip thrust', 'búlgaro',
    'levantamento', 'flexão',
]

function isCompoundByName(name: string): boolean {
    const lower = name.toLowerCase()
    return COMPOUND_NAME_PATTERNS.some(p => lower.includes(p))
}

/**
 * Fetch last 4 weeks of workout sessions for adherence calculation.
 */
async function fetchRecentSessions(
    supabase: SupabaseClient,
    studentId: string,
): Promise<RecentSession[]> {
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data, error } = await supabase
        .from('workout_sessions')
        .select('id, status, completed_at, duration_seconds, rpe, assigned_program_id')
        .eq('student_id', studentId)
        .gte('started_at', fourWeeksAgo.toISOString())
        .order('started_at', { ascending: false })

    if (error) {
        console.error('[getPrescriptionData] sessions error:', error)
        return []
    }

    return (data || []) as RecentSession[]
}

/**
 * Fetch the student's currently active program (if any).
 */
async function fetchActiveProgram(
    supabase: SupabaseClient,
    studentId: string,
): Promise<ActiveProgram | null> {
    const { data, error } = await supabase
        .from('assigned_programs')
        .select('id, name, description, duration_weeks, status, started_at, created_at')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle()

    if (error) {
        console.error('[getPrescriptionData] active program error:', error)
        return null
    }

    return data as ActiveProgram | null
}

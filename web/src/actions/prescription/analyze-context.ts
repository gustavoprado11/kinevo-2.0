'use server'

import { createClient } from '@/lib/supabase/server'
import { enrichStudentContext } from '@/lib/prescription/context-enricher'
import { analyzeContextAndAsk } from '@/lib/prescription/claude-agent'
import { selectConditionalQuestions } from '@/lib/prescription/question-engine'
import { detectVolumeTradeoff } from '@/lib/prescription/constraints-engine'
import { fetchPrescriptionQuestionnaire } from './questionnaire-actions'
import { mapQuestionnaireToProfile } from '@/lib/prescription/questionnaire-mapper'

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionAgentQuestion,
    PrescriptionAgentState,
    PrescriptionContextAnalysis,
} from '@kinevo/shared/types/prescription'

// ============================================================================
// Types
// ============================================================================

export interface AnalyzeContextResult {
    success: boolean
    error?: string
    analysis?: PrescriptionContextAnalysis
    questions?: PrescriptionAgentQuestion[]
    agentState?: PrescriptionAgentState
    studentName?: string
}

// ============================================================================
// Main Server Action
// ============================================================================

export async function analyzeStudentContext(
    studentId: string,
): Promise<AnalyzeContextResult> {
    const supabase = await createClient()

    // ── 1. Auth check ──
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    // ── 2. Trainer lookup + feature flag ──
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, ai_prescriptions_enabled')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    // @ts-ignore — ai_prescriptions_enabled from migration 036
    if (!trainer.ai_prescriptions_enabled) {
        return { success: false, error: 'Módulo de prescrição IA não está habilitado.' }
    }

    // ── 3. Validate student exists (RLS ensures it belongs to this trainer) ──
    const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .single()

    if (!student) return { success: false, error: 'Aluno não encontrado' }

    // ── 4. Fetch prescription profile ──
    // @ts-ignore — table from migration 034
    const { data: profile, error: profileError } = await supabase
        .from('student_prescription_profiles')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle()

    if (profileError || !profile) {
        return { success: false, error: 'Perfil de prescrição não encontrado. Preencha a anamnese primeiro.' }
    }

    const typedProfile = profile as unknown as StudentPrescriptionProfile

    // ── 5. Fetch exercises (filtered by equipment) + enriched context + questionnaire in parallel ──
    const [exercises, enrichedContext, questionnaireResult] = await Promise.all([
        fetchExercisesForAgent(supabase, typedProfile),
        enrichStudentContext(supabase, studentId),
        fetchPrescriptionQuestionnaire(studentId),
    ])

    // ── 5.1. Map questionnaire data and inject into profile ──
    const questionnaireData = questionnaireResult?.submission
        ? mapQuestionnaireToProfile(
            questionnaireResult.submission.answers_json?.answers || {},
            typedProfile,
            exercises,
        )
        : null

    if (questionnaireData) {
        console.log(`[analyzeStudentContext] Questionnaire data: ${questionnaireData.divergences.length} divergences, ${questionnaireData.emphasized_groups.length} emphasis groups, ${questionnaireData.derived_restrictions.length} derived restrictions`)

        // Inject derived restrictions into profile (dedup already applied in mapper)
        if (questionnaireData.derived_restrictions.length > 0) {
            typedProfile.medical_restrictions = [
                ...typedProfile.medical_restrictions,
                ...questionnaireData.derived_restrictions,
            ]
        }

        // Inject exercise preferences (merge with existing, don't overwrite)
        if (questionnaireData.favorite_exercise_ids.length > 0) {
            typedProfile.favorite_exercise_ids = [
                ...new Set([...typedProfile.favorite_exercise_ids, ...questionnaireData.favorite_exercise_ids]),
            ]
        }
        if (questionnaireData.disliked_exercise_ids.length > 0) {
            typedProfile.disliked_exercise_ids = [
                ...new Set([...typedProfile.disliked_exercise_ids, ...questionnaireData.disliked_exercise_ids]),
            ]
        }
    }

    // ── 5.5. Detect volume trade-off before question selection ──
    const tradeoff = detectVolumeTradeoff(typedProfile, enrichedContext)
    if (tradeoff.needsTradeoff) {
        console.log(`[analyzeStudentContext] Volume trade-off detected: scaleFactor=${tradeoff.scaleFactor.toFixed(2)}, budget=${tradeoff.totalBudgetMin} vs capacity=${tradeoff.totalWeeklySets}`)
    }

    // ── 5.6. Server-side conditional questions (guaranteed) ──
    const serverQuestions = selectConditionalQuestions(typedProfile, enrichedContext, tradeoff, questionnaireData)
    console.log(`[analyzeStudentContext] Server-side questions: ${serverQuestions.length} (${serverQuestions.map(q => q.id).join(', ')})`)

    // ── 6. Call Claude agent for analysis ──
    try {
        const result = await analyzeContextAndAsk(typedProfile, exercises, enrichedContext, serverQuestions)

        if (result.status === 'missing_api_key') {
            console.error('[analyzeStudentContext] ANTHROPIC_API_KEY not configured')
            return {
                success: false,
                error: 'Agente de IA não configurado. Contate o suporte.',
            }
        }

        if (result.status !== 'agent_used') {
            console.warn('[analyzeStudentContext] Agent analysis failed, skipping questions:', result.status)
            // Fallback: proceed without questions
            return {
                success: true,
                analysis: undefined,
                questions: [],
                agentState: undefined,
                studentName: enrichedContext.student_name,
            }
        }

        // Merge: server questions are GUARANTEED, AI can complement
        const mergedQuestions = mergeQuestions(serverQuestions, result.questions)

        // Build agent state
        let agentState: PrescriptionAgentState = {
            conversation_messages: result.conversationMessages,
            context_analysis: result.analysis,
            questions: mergedQuestions,
            answers: [],
            phase: mergedQuestions.length > 0 ? 'questions' : 'generating',
        }

        // Enforce size limit (50KB)
        agentState = enforceStateSizeLimit(agentState)

        return {
            success: true,
            analysis: result.analysis,
            questions: mergedQuestions,
            agentState,
            studentName: enrichedContext.student_name,
        }
    } catch (err: any) {
        console.error('[analyzeStudentContext] Unexpected error:', err)
        // Graceful fallback — skip questions, proceed to generation
        return {
            success: true,
            analysis: undefined,
            questions: [],
            agentState: undefined,
            studentName: enrichedContext.student_name,
        }
    }
}

// ============================================================================
// Question Merge
// ============================================================================

/**
 * Merges server-side guaranteed questions with AI-generated questions.
 * Server questions always take priority. AI questions are added if not duplicate
 * and total <= 3.
 */
function mergeQuestions(
    serverQuestions: PrescriptionAgentQuestion[],
    aiQuestions: PrescriptionAgentQuestion[],
): PrescriptionAgentQuestion[] {
    const merged = [...serverQuestions]
    const serverIds = new Set(serverQuestions.map(q => q.id))

    for (const aiQ of aiQuestions) {
        if (merged.length >= 3) break
        if (serverIds.has(aiQ.id)) continue
        merged.push(aiQ)
    }

    return merged.slice(0, 3)
}

// ============================================================================
// Helpers
// ============================================================================

const MAX_STATE_BYTES = 50_000

function enforceStateSizeLimit(state: PrescriptionAgentState): PrescriptionAgentState {
    const serialized = JSON.stringify(state)
    const byteLength = new TextEncoder().encode(serialized).length

    if (byteLength <= MAX_STATE_BYTES) return state

    console.warn(`[analyzeStudentContext] agentState too large (${byteLength} bytes), truncating`)

    // Keep only the last 2 messages (last user + last assistant)
    const messages = state.conversation_messages
    const truncatedMessages = messages.length > 2
        ? [messages[messages.length - 2], messages[messages.length - 1]]
        : messages

    return {
        ...state,
        conversation_messages: truncatedMessages,
    }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

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

// Maps high-level profile equipment options to specific exercise equipment values
const EQUIPMENT_MAP: Record<string, string[]> = {
    'academia_completa': [
        'barbell', 'dumbbell', 'machine', 'cable', 'smith',
        'trx', 'leg_press', 'step', 'bench', 'plate',
        'hack', 'kettlebell', 'miniband', 'bodyweight',
    ],
    'home_gym_completo': [
        'barbell', 'dumbbell', 'cable', 'kettlebell',
        'bodyweight', 'bench', 'miniband', 'step',
    ],
    'home_gym_basico': [
        'dumbbell', 'bodyweight', 'bench', 'miniband', 'step',
    ],
    'ao_ar_livre': ['bodyweight', 'miniband', 'step', 'trx'],
    'apenas_peso_corporal': ['bodyweight'],
}

const EXERCISE_SELECT_COLUMNS = `
    id,
    name,
    equipment,
    difficulty_level,
    is_primary_movement,
    session_position,
    movement_pattern,
    prescription_notes,
    exercise_muscle_groups (
        muscle_groups (
            id,
            name
        )
    )
`

function mapExerciseRow(e: any): PrescriptionExerciseRef {
    const muscleGroupNames: string[] = (e.exercise_muscle_groups || [])
        .map((emg: any) => emg.muscle_groups?.name)
        .filter(Boolean)

    return {
        id: e.id,
        name: e.name,
        muscle_group_names: muscleGroupNames,
        equipment: e.equipment || null,
        is_compound: muscleGroupNames.length >= 2 || isCompoundByName(e.name),
        difficulty_level: e.difficulty_level || 'intermediate',
        is_primary_movement: e.is_primary_movement || false,
        session_position: e.session_position || 'middle',
        movement_pattern: e.movement_pattern || null,
        prescription_notes: e.prescription_notes || null,
    }
}

/** Minimum curated pool size before falling back to full exercise library */
const MIN_CURATED_POOL_SIZE = 15

async function fetchExercisesForAgent(
    supabase: SupabaseClient,
    profile: StudentPrescriptionProfile,
): Promise<PrescriptionExerciseRef[]> {
    // Resolve which equipment types to include based on profile setting
    const profileEquip = profile.available_equipment?.[0] || 'academia_completa'
    const allowedTypes = EQUIPMENT_MAP[profileEquip] || EQUIPMENT_MAP['academia_completa']

    // Query 1: Curated exercises filtered by equipment
    const { data: curatedExercises, error } = await supabase
        .from('exercises')
        .select(EXERCISE_SELECT_COLUMNS)
        .eq('is_archived', false)
        .eq('is_ai_curated', true)
        .in('equipment', allowedTypes)
        .order('name', { ascending: true })

    if (error) {
        console.error('[analyzeStudentContext] failed to fetch curated exercises:', error)
        return []
    }

    const curated = (curatedExercises || []).map(mapExerciseRow)

    // Query 2: Favorite exercises NOT in curated set
    let favorites: PrescriptionExerciseRef[] = []
    const favoriteIds = profile.favorite_exercise_ids || []
    if (favoriteIds.length > 0) {
        const curatedIds = new Set(curated.map(e => e.id))
        const nonCuratedFavoriteIds = favoriteIds.filter(id => !curatedIds.has(id))

        if (nonCuratedFavoriteIds.length > 0) {
            const { data: favExercises } = await supabase
                .from('exercises')
                .select(EXERCISE_SELECT_COLUMNS)
                .eq('is_archived', false)
                .in('id', nonCuratedFavoriteIds)

            favorites = (favExercises || []).map(mapExerciseRow)
        }
    }

    const pool = [...curated, ...favorites]

    // Safety net: if curated pool is too small, fall back to full exercise library
    if (pool.length < MIN_CURATED_POOL_SIZE) {
        console.warn(`[analyzeStudentContext] Curated pool too small (${pool.length}), falling back to full pool`)

        const { data: allExercises, error: fullError } = await supabase
            .from('exercises')
            .select(EXERCISE_SELECT_COLUMNS)
            .eq('is_archived', false)
            .in('equipment', allowedTypes)
            .order('name', { ascending: true })
            .limit(150)

        if (fullError || !allExercises) {
            console.error('[analyzeStudentContext] failed to fetch full exercises:', fullError)
            return pool
        }

        return allExercises.map(mapExerciseRow)
    }

    return pool
}

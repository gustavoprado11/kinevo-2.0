'use server'

import { createClient } from '@/lib/supabase/server'

import type {
    AiMode,
    AiSource,
    PrescriptionExerciseRef,
    PrescriptionInputSnapshot,
    PrescriptionOutputSnapshot,
    PrescriptionPerformanceContext,
    StudentPrescriptionProfile,
    RulesViolation,
} from '@kinevo/shared/types/prescription'

import { validateInput, validateOutput, fixViolations, resolveAiMode } from '@/lib/prescription/rules-engine'
import { buildHeuristicProgram } from '@/lib/prescription/program-builder'
import { buildPromptPair, parseAiResponse } from '@/lib/prescription/prompt-builder'
import { ENGINE_VERSION } from '@/lib/prescription/constants'

// ============================================================================
// Types
// ============================================================================

type LLMStatus =
    | 'llm_used'
    | 'llm_disabled'
    | 'missing_api_key'
    | 'http_error'
    | 'invalid_response'
    | 'network_error'
    | 'timeout'
    | 'validation_failed'

interface GenerateProgramResult {
    success: boolean
    error?: string
    generationId?: string
    aiMode?: AiMode
    source?: AiSource
    llmStatus?: LLMStatus
    violations?: RulesViolation[]
}

// ============================================================================
// Config
// ============================================================================

function resolveOpenAIModel(): string {
    return process.env.OPENAI_PRESCRIPTION_MODEL?.trim() || 'gpt-4o-mini'
}

function resolveLLMEnabled(): boolean {
    const raw = process.env.PRESCRIPTION_AI_LLM_ENABLED
    if (!raw) return true
    return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

function resolveTimeoutMs(): number {
    const raw = Number(process.env.OPENAI_PRESCRIPTION_TIMEOUT_MS || 25000)
    if (!Number.isFinite(raw)) return 25000
    return Math.max(5000, Math.min(Math.round(raw), 60000))
}

// ============================================================================
// Main Action
// ============================================================================

export async function generateProgram(
    studentId: string,
): Promise<GenerateProgramResult> {
    const startTime = Date.now()
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

    // ── 5. Fetch exercises ──
    const exercises = await fetchExercisesForPrescription(supabase)

    // ── 6. Build performance context from recent sessions ──
    const performanceContext = await buildPerformanceContext(supabase, studentId)

    // ── 7. Resolve AI mode ──
    const aiMode = resolveAiMode(typedProfile, performanceContext)

    // ── 8. Validate input ──
    const inputValidation = validateInput(typedProfile, exercises)
    if (!inputValidation.valid) {
        return {
            success: false,
            error: `Dados insuficientes para gerar programa: ${inputValidation.errors.join('; ')}`,
        }
    }

    // ── 9. Build input snapshot (for audit trail) ──
    const inputSnapshot: PrescriptionInputSnapshot = {
        profile: {
            student_id: typedProfile.student_id,
            training_level: typedProfile.training_level,
            goal: typedProfile.goal,
            available_days: typedProfile.available_days,
            session_duration_minutes: typedProfile.session_duration_minutes,
            available_equipment: typedProfile.available_equipment,
            favorite_exercise_ids: typedProfile.favorite_exercise_ids,
            disliked_exercise_ids: typedProfile.disliked_exercise_ids,
            medical_restrictions: typedProfile.medical_restrictions,
            ai_mode: typedProfile.ai_mode,
            adherence_rate: typedProfile.adherence_rate,
        },
        available_exercises: exercises,
        performance_context: performanceContext,
        engine_version: ENGINE_VERSION,
    }

    // ── 10. Try AI generation with fallback to heuristic ──
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))
    let outputSnapshot: PrescriptionOutputSnapshot
    let source: AiSource
    let llmStatus: LLMStatus
    let model = resolveOpenAIModel()
    let allViolations: RulesViolation[] = []

    const aiResult = await tryOpenAIGeneration(typedProfile, exercises, performanceContext)
    llmStatus = aiResult.status

    if (aiResult.output) {
        // AI returned something — validate it
        const validation = validateOutput(aiResult.output, typedProfile, exerciseMap)

        if (validation.hasErrors) {
            // Try to auto-fix
            const fixResult = fixViolations(aiResult.output, validation.violations, exerciseMap)

            if (fixResult.remainingViolations.some(v => v.severity === 'error')) {
                // Still has errors after fix — fallback to heuristic
                console.warn('[generateProgram] AI output has unfixable errors, falling back to heuristic')
                llmStatus = 'validation_failed'
                outputSnapshot = buildHeuristicProgram(typedProfile, exercises)
                source = 'heuristic'
                allViolations = validation.violations
            } else {
                // Fixed successfully
                outputSnapshot = fixResult.fixed
                source = 'llm'
                model = aiResult.model
                allViolations = [...fixResult.appliedFixes, ...fixResult.remainingViolations]
            }
        } else {
            // No errors
            outputSnapshot = aiResult.output
            source = 'llm'
            model = aiResult.model
            allViolations = validation.violations // warnings only
        }
    } else {
        // AI failed or disabled — use heuristic
        if (llmStatus !== 'llm_disabled' && llmStatus !== 'missing_api_key') {
            console.warn('[generateProgram] AI generation failed, falling back to heuristic', {
                status: llmStatus,
            })
        }
        outputSnapshot = buildHeuristicProgram(typedProfile, exercises)
        source = 'heuristic'

        // Validate heuristic output too (should always pass)
        const heuristicValidation = validateOutput(outputSnapshot, typedProfile, exerciseMap)
        allViolations = heuristicValidation.violations
    }

    const generationTimeMs = Date.now() - startTime

    // ── 11. Create prescription_generation (audit trail) ──
    // The output_snapshot is stored here. No assigned_program is created yet —
    // that happens when the trainer publishes from the builder.
    // @ts-ignore — table from migration 035
    const { data: generation, error: genError } = await supabase
        .from('prescription_generations')
        .insert({
            trainer_id: trainer.id,
            student_id: studentId,
            assigned_program_id: null,
            ai_mode_used: aiMode,
            ai_model: source === 'llm' ? model : 'heuristic',
            ai_source: source,
            input_snapshot: inputSnapshot,
            output_snapshot: outputSnapshot,
            rules_violations: allViolations,
            status: 'pending_review',
            generation_time_ms: generationTimeMs,
            confidence_score: outputSnapshot.reasoning.confidence_score,
        })
        .select('id')
        .single()

    if (genError || !generation) {
        console.error('[generateProgram] failed to create prescription_generation:', genError)
        return { success: false, error: 'Erro ao salvar geração.' }
    }

    const generationId = (generation as any).id as string

    return {
        success: true,
        generationId,
        aiMode,
        source,
        llmStatus,
        violations: allViolations.length > 0 ? allViolations : undefined,
    }
}

// ============================================================================
// OpenAI Generation
// ============================================================================

interface OpenAIResult {
    output: PrescriptionOutputSnapshot | null
    status: LLMStatus
    model: string
}

async function tryOpenAIGeneration(
    profile: StudentPrescriptionProfile,
    exercises: PrescriptionExerciseRef[],
    performanceContext: PrescriptionPerformanceContext | null,
): Promise<OpenAIResult> {
    const model = resolveOpenAIModel()
    const llmEnabled = resolveLLMEnabled()

    if (!llmEnabled) {
        return { output: null, status: 'llm_disabled', model }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        return { output: null, status: 'missing_api_key', model }
    }

    const { system, user } = buildPromptPair(profile, exercises, performanceContext)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), resolveTimeoutMs())

    let response: Response
    try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model,
                temperature: 0.3,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }),
        })
    } catch (err: any) {
        clearTimeout(timeout)
        if (err?.name === 'AbortError') {
            return { output: null, status: 'timeout', model }
        }
        return { output: null, status: 'network_error', model }
    }
    clearTimeout(timeout)

    if (!response.ok) {
        console.error('[generateProgram] OpenAI HTTP error:', response.status)
        return { output: null, status: 'http_error', model }
    }

    let payload: any
    try {
        payload = await response.json()
    } catch {
        return { output: null, status: 'invalid_response', model }
    }

    const content = payload?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
        return { output: null, status: 'invalid_response', model }
    }

    const parsed = parseAiResponse(content)
    if (!parsed) {
        console.warn('[generateProgram] Failed to parse AI response')
        return { output: null, status: 'invalid_response', model }
    }

    return { output: parsed, status: 'llm_used', model }
}

// ============================================================================
// Exercise Fetcher (reuses pattern from get-prescription-data)
// ============================================================================

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

async function fetchExercisesForPrescription(
    supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PrescriptionExerciseRef[]> {
    const { data: exercises, error } = await supabase
        .from('exercises')
        .select(`
            id,
            name,
            equipment,
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

    if (error || !exercises) {
        console.error('[generateProgram] failed to fetch exercises:', error)
        return []
    }

    return exercises.map((e: any) => {
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
        }
    })
}

// ============================================================================
// Performance Context Builder
// ============================================================================

async function buildPerformanceContext(
    supabase: Awaited<ReturnType<typeof createClient>>,
    studentId: string,
): Promise<PrescriptionPerformanceContext | null> {
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, status, completed_at, duration_seconds, rpe, assigned_program_id')
        .eq('student_id', studentId)
        .gte('started_at', fourWeeksAgo.toISOString())
        .order('started_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
        return null
    }

    const completedSessions = sessions.filter((s: any) => s.status === 'completed')

    // Calculate weeks of history
    const oldestSession = sessions[sessions.length - 1] as any
    const oldestDate = new Date(oldestSession.completed_at || oldestSession.started_at || fourWeeksAgo)
    const weeksOfHistory = Math.max(1, Math.ceil((Date.now() - oldestDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))

    // Adherence: completed / total sessions
    const adherenceRate = sessions.length > 0
        ? Math.round((completedSessions.length / sessions.length) * 100)
        : null

    // Average RPE from last 2 weeks
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const recentWithRpe = completedSessions
        .filter((s: any) => s.rpe != null && new Date(s.completed_at) >= twoWeeksAgo)
    const avgRpe = recentWithRpe.length > 0
        ? Math.round(recentWithRpe.reduce((sum: number, s: any) => sum + s.rpe, 0) / recentWithRpe.length * 10) / 10
        : null

    // Active program summary
    let previousProgram: PrescriptionPerformanceContext['previous_program'] = null
    const activeProgramId = completedSessions[0]?.assigned_program_id
    if (activeProgramId) {
        const { data: prog } = await supabase
            .from('assigned_programs')
            .select('name, duration_weeks')
            .eq('id', activeProgramId)
            .maybeSingle()

        if (prog) {
            const { data: workouts } = await supabase
                .from('assigned_workouts')
                .select('id')
                .eq('assigned_program_id', activeProgramId)

            previousProgram = {
                name: (prog as any).name,
                duration_weeks: (prog as any).duration_weeks,
                workout_count: workouts?.length || 0,
                total_weekly_sets_per_muscle: {}, // Would require deeper query; left empty for now
            }
        }
    }

    return {
        weeks_of_history: weeksOfHistory,
        recent_adherence_rate: adherenceRate,
        recent_avg_rpe: avgRpe,
        stalled_exercise_ids: [], // TODO: implement stall detection from set_logs
        previous_program: previousProgram,
    }
}

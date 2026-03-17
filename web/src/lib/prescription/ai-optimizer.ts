// ============================================================================
// AI Optimizer — Lightweight LLM review of builder output
// ============================================================================
// Receives a complete valid program from the slot builder and applies
// 0-2 small improvements: exercise swaps, set adjustments, notes, flags.
//
// The optimizer is OPTIONAL. If it fails, the builder output is returned as-is.
// Feature flag: ENABLE_AI_OPTIMIZER (default: true, set false to skip)
// ============================================================================

import type {
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    PrescriptionAgentAnswer,
    GeneratedWorkout,
    GeneratedWorkoutItem,
    StudentPrescriptionProfile,
    TrainerPatterns,
} from '@kinevo/shared/types/prescription'

import type { PrescriptionConstraints } from './constraints-engine'
import type { EnrichedStudentContext } from './context-enricher'
import type { GraphExerciseEdge } from './exercise-graph'
import { getSubstitutesForBatch } from './exercise-graph'
import { validateOutput } from './rules-engine'

// ============================================================================
// Types
// ============================================================================

export interface OptimizerResult {
    output: PrescriptionOutputSnapshot
    optimizerApplied: boolean
    swapsApplied: number
    setAdjustments: number
    model: string
    tokensUsed: { input: number; output: number }
    status: 'optimized' | 'no_changes' | 'optimizer_failed' | 'optimizer_skipped'
}

interface OptimizerSwap {
    workout_index: number
    item_index: number
    new_exercise_id: string
    reason: string
}

interface OptimizerSetAdjustment {
    workout_index: number
    item_index: number
    new_sets: number
    reason: string
}

interface OptimizerResponse {
    swaps: OptimizerSwap[]
    set_adjustments: OptimizerSetAdjustment[]
    workout_notes: string[]
    attention_flags: string[]
    confidence_score: number
}

interface ContextSummary {
    student_name: string
    level: string
    goal: string
    frequency: number
    session_duration: number
    stalled_exercises: string[]
    adherence: number
    emphasized_groups: string[]
    trainer_answers: Array<{ question: string; answer: string }>
    previous_program_count: number
    previous_exercise_names: string[]
    performance_insights?: {
        adherence_percentage: number
        dropout_workouts: string[]
        stalled_count: number
        regressing_count: number
    }
}

interface SwapCandidate {
    exercise_id: string
    exercise_name: string
    substitutes: Array<{ id: string; name: string }>
}

// ============================================================================
// Constants
// ============================================================================

const OPTIMIZER_MODEL = 'gpt-4.1-mini'
const OPTIMIZER_MAX_TOKENS = 1024
const OPTIMIZER_TIMEOUT_MS = 10_000
const MAX_SWAPS = 8
const MAX_SET_ADJUSTMENTS = 5

// ============================================================================
// shouldOptimize — Determines if optimizer should run
// ============================================================================

export function shouldOptimize(
    profile: StudentPrescriptionProfile,
    enrichedContext: EnrichedStudentContext,
    studentNarrative?: string | null,
): boolean {
    // ALWAYS optimize if student narrative is present (form responses)
    if (studentNarrative && studentNarrative.trim().length > 0) {
        console.log('[Optimizer] Running: student narrative present')
        return true
    }

    // ALWAYS optimize if trainer observation is present
    if (profile.cycle_observation && profile.cycle_observation.trim().length > 0) {
        console.log('[Optimizer] Running: trainer observation present')
        return true
    }

    // For students without extra context: relaxed threshold (4 sessions instead of 8)
    const completedSessions = enrichedContext.session_patterns.completed_sessions_4w ?? 0
    const totalFromPrograms = enrichedContext.previous_programs.reduce(
        (sum, p) => sum + (p.workouts?.length ?? 0), 0,
    )
    if (completedSessions + totalFromPrograms < 4) return false

    return true
}

// ============================================================================
// buildContextSummary — Deterministic context extraction (replaces LLM analysis)
// ============================================================================

export function buildContextSummary(
    profile: StudentPrescriptionProfile,
    enrichedContext: EnrichedStudentContext,
    constraints: PrescriptionConstraints,
    trainerAnswers?: PrescriptionAgentAnswer[],
): ContextSummary {
    const stalledExercises = enrichedContext.load_progression
        .filter(lp => lp.trend === 'stalled')
        .map(lp => lp.exercise_name)

    const adherence = constraints.adherence_percentage

    // Collect exercise names from previous programs for variety context
    const previousExerciseNames: string[] = []
    for (const prog of enrichedContext.previous_programs) {
        if (prog.workouts) {
            for (const w of prog.workouts) {
                if (w.exercise_names) {
                    for (const name of w.exercise_names) {
                        if (name && !previousExerciseNames.includes(name)) {
                            previousExerciseNames.push(name)
                        }
                    }
                }
            }
        }
    }

    // Collect performance insights
    const dropoutWorkouts: string[] = []
    if (enrichedContext.session_patterns.dropout_rate_by_workout) {
        for (const [name, rate] of Object.entries(enrichedContext.session_patterns.dropout_rate_by_workout)) {
            if (rate > 0.4) dropoutWorkouts.push(name)
        }
    }

    const stalledCount = enrichedContext.load_progression.filter(lp => lp.trend === 'stalled').length
    const regressingCount = enrichedContext.load_progression.filter(lp => lp.trend === 'regressing').length

    return {
        student_name: enrichedContext.student_name,
        level: profile.training_level,
        goal: profile.goal,
        frequency: profile.available_days.length,
        session_duration: profile.session_duration_minutes,
        stalled_exercises: stalledExercises,
        adherence,
        emphasized_groups: constraints.emphasized_groups || [],
        trainer_answers: (trainerAnswers || []).map(a => ({
            question: a.question_id,
            answer: a.answer,
        })),
        previous_program_count: enrichedContext.previous_programs.length,
        previous_exercise_names: previousExerciseNames.slice(0, 30),
        performance_insights: {
            adherence_percentage: constraints.adherence_percentage,
            dropout_workouts: dropoutWorkouts,
            stalled_count: stalledCount,
            regressing_count: regressingCount,
        },
    }
}

// ============================================================================
// buildSwapCandidates — Top 3 graph substitutes per exercise (reduces tokens)
// ============================================================================

async function buildSwapCandidates(
    workouts: GeneratedWorkout[],
): Promise<SwapCandidate[]> {
    const allExerciseIds = workouts.flatMap(w =>
        w.items.map(i => i.exercise_id).filter((id): id is string => !!id),
    )
    const uniqueIds = [...new Set(allExerciseIds)]

    let subsMap: Map<string, GraphExerciseEdge[]>
    try {
        subsMap = await getSubstitutesForBatch(uniqueIds)
    } catch {
        return []
    }

    const candidates: SwapCandidate[] = []
    for (const workout of workouts) {
        for (const item of workout.items) {
            if (!item.exercise_id || !item.exercise_name) continue
            const subs = subsMap.get(item.exercise_id) || []
            if (subs.length === 0) continue
            candidates.push({
                exercise_id: item.exercise_id,
                exercise_name: item.exercise_name,
                substitutes: subs.slice(0, 3).map(s => ({
                    id: s.exercise_id,
                    name: s.exercise_name,
                })),
            })
        }
    }

    return candidates
}

// ============================================================================
// buildOptimizerPrompt — Compact prompt for Haiku
// ============================================================================

function buildOptimizerSystemPrompt(): string {
    return `You are a training program reviewer for Kinevo.
You receive a COMPLETE program generated by the Kinevo builder.
Your job: make 0-${MAX_SWAPS} small improvements based on the student context.

RULES:
- Swap up to ${MAX_SWAPS} exercises. ONLY use IDs from swap_candidates.
- Adjust sets ±1 for up to ${MAX_SET_ADJUSTMENTS} exercises. Must stay within volume_budget.
- Write workout_notes: 1 per workout, max 10 words, in Portuguese.
- Write attention_flags: 0-3 items, max 1 sentence each, in Portuguese.
- Set confidence_score: 0.0-1.0.
- Do NOT add/remove workouts or exercises.
- Do NOT change reps, rest, or scheduled days.
- If no improvements needed, return empty swaps/adjustments arrays.
- If trainer_preferences are provided, incorporate them when possible (prefer swaps and set adjustments that align with the trainer's historical patterns). NEVER violate absolute constraints or volume limits to satisfy a preference.
- If student_context is provided, consider the student's preferences, motivation, and training style when choosing swaps. For example, if the student prefers heavy compound movements, prefer swaps toward barbell/free-weight exercises. If the student emphasizes specific muscle groups, favor swaps that maintain or improve coverage of those groups.
- EMPHASIS: If emphasized_groups is present and non-empty, PRIORITIZE swapping generic exercises for ones that specifically isolate the emphasized group. Example: if "Glúteos" is emphasized, prefer hip thrust, glute bridge, bulgarian split squat over generic squats. If "Costas" is emphasized, prefer pull-ups, rows, face pulls over generic lat pulldowns.

PERFORMANCE: If performance_insights is present in context:
- stalled_count > 3: prioritize swapping stalled exercises for variations
- dropout_workouts has entries: those workouts may be too long or hard — consider simplifying
- adherence_percentage < 70: prefer simpler, familiar exercises to maintain motivation
- regressing_count > 0: flag regressing exercises in attention_flags and consider swapping

VARIETY PRIORITY:
- If previous_exercise_names is provided in context, PRIORITIZE swapping exercises that appear in that list.
- The goal is to introduce novelty: the student should feel a fresh stimulus each new program.
- When choosing between swap candidates, prefer the one that is NOT in previous_exercise_names.
- Exercises that are staples for the student's goal (e.g., Agachamento for hypertrophy) may be kept even if repeated.

OUTPUT: Return ONLY valid JSON matching this schema:
{
  "swaps": [{ "workout_index": 0, "item_index": 2, "new_exercise_id": "UUID", "reason": "..." }],
  "set_adjustments": [{ "workout_index": 0, "item_index": 1, "new_sets": 4, "reason": "..." }],
  "workout_notes": ["Treino A — nota curta"],
  "attention_flags": ["Flag em português"],
  "confidence_score": 0.88
}`
}

function buildTrainerPreferenceText(trainerPatterns?: TrainerPatterns | null): string {
    if (!trainerPatterns || trainerPatterns.patterns.length === 0) return ''

    const lines = trainerPatterns.patterns
        .slice(0, 5)
        .map(p => `• ${p.description}`)
        .join('\n')

    return `PREFERÊNCIAS DO TREINADOR (aprendidas de ${trainerPatterns.analyzed_prescriptions} prescrições):\n${lines}`
}

function buildOptimizerUserPrompt(
    builderOutput: PrescriptionOutputSnapshot,
    contextSummary: ContextSummary,
    constraints: PrescriptionConstraints,
    swapCandidates: SwapCandidate[],
    trainerPatterns?: TrainerPatterns | null,
    studentNarrative?: string | null,
): string {
    // Compact program representation
    const compactWorkouts = builderOutput.workouts.map(w => ({
        name: w.name,
        items: w.items
            .filter(i => (i.item_type || 'exercise') === 'exercise')
            .map(i => ({
                id: i.exercise_id ?? '',
                name: i.exercise_name ?? '',
                group: i.exercise_muscle_group ?? '',
                sets: i.sets ?? 0,
                fn: i.exercise_function || 'accessory',
            })),
    }))

    // Compact volume budget (only groups with budget)
    const budget: Record<string, string> = {}
    for (const [group, range] of Object.entries(constraints.volume_budget)) {
        budget[group] = `${range.min}-${range.max}`
    }

    const trainerPreferenceText = buildTrainerPreferenceText(trainerPatterns)

    const payload: Record<string, unknown> = {
        program: compactWorkouts,
        context: contextSummary,
        volume_budget: budget,
        swap_candidates: swapCandidates,
    }

    if (trainerPreferenceText) {
        payload.trainer_preferences = trainerPreferenceText
    }

    if (studentNarrative) {
        payload.student_context = studentNarrative
    }

    return JSON.stringify(payload)
}

// ============================================================================
// parseOptimizerResponse — Extract and validate optimizer diffs
// ============================================================================

function parseOptimizerResponse(text: string): OptimizerResponse | null {
    try {
        // Extract JSON from potential markdown wrapping
        let jsonStr = text.trim()
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim()
        }

        const parsed = JSON.parse(jsonStr)

        // Validate structure
        const swaps: OptimizerSwap[] = Array.isArray(parsed.swaps)
            ? parsed.swaps.slice(0, MAX_SWAPS).filter((s: any) =>
                typeof s.workout_index === 'number' &&
                typeof s.item_index === 'number' &&
                typeof s.new_exercise_id === 'string' &&
                typeof s.reason === 'string',
            )
            : []

        const setAdj: OptimizerSetAdjustment[] = Array.isArray(parsed.set_adjustments)
            ? parsed.set_adjustments.slice(0, MAX_SET_ADJUSTMENTS).filter((a: any) =>
                typeof a.workout_index === 'number' &&
                typeof a.item_index === 'number' &&
                typeof a.new_sets === 'number' &&
                a.new_sets >= 1 && a.new_sets <= 6,
            )
            : []

        const workoutNotes: string[] = Array.isArray(parsed.workout_notes)
            ? parsed.workout_notes.filter((n: any) => typeof n === 'string').map((n: string) => n.slice(0, 80))
            : []

        const attentionFlags: string[] = Array.isArray(parsed.attention_flags)
            ? parsed.attention_flags.filter((f: any) => typeof f === 'string').slice(0, 3).map((f: string) => f.slice(0, 150))
            : []

        const confidenceScore = typeof parsed.confidence_score === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence_score))
            : 0.85

        return {
            swaps,
            set_adjustments: setAdj,
            workout_notes: workoutNotes,
            attention_flags: attentionFlags,
            confidence_score: confidenceScore,
        }
    } catch {
        return null
    }
}

// ============================================================================
// applyOptimizerDiffs — Merge diffs into builder output
// ============================================================================

function applyOptimizerDiffs(
    builderOutput: PrescriptionOutputSnapshot,
    diffs: OptimizerResponse,
    swapCandidates: SwapCandidate[],
): PrescriptionOutputSnapshot {
    // Deep clone to avoid mutating original
    const output: PrescriptionOutputSnapshot = JSON.parse(JSON.stringify(builderOutput))

    // Build set of valid swap target IDs (from candidates only)
    const validSwapIds = new Set<string>()
    for (const c of swapCandidates) {
        for (const s of c.substitutes) {
            validSwapIds.add(s.id)
        }
    }

    // Build name lookup from candidates
    const nameMap = new Map<string, string>()
    for (const c of swapCandidates) {
        nameMap.set(c.exercise_id, c.exercise_name)
        for (const s of c.substitutes) {
            nameMap.set(s.id, s.name)
        }
    }

    // Apply swaps
    let swapsApplied = 0
    for (const swap of diffs.swaps) {
        const workout = output.workouts[swap.workout_index]
        if (!workout) continue
        const item = workout.items[swap.item_index]
        if (!item) continue

        // Validate: new exercise must be in swap candidates for the current exercise
        if (!validSwapIds.has(swap.new_exercise_id)) continue

        // Verify the swap is for the right exercise (candidate must exist)
        const candidate = swapCandidates.find(c => c.exercise_id === item.exercise_id)
        if (!candidate) continue
        const isValidTarget = candidate.substitutes.some(s => s.id === swap.new_exercise_id)
        if (!isValidTarget) continue

        item.exercise_id = swap.new_exercise_id
        item.exercise_name = nameMap.get(swap.new_exercise_id) || item.exercise_name
        item.notes = swap.reason.slice(0, 80)
        swapsApplied++
    }

    // Apply set adjustments
    let setAdjustmentsApplied = 0
    for (const adj of diffs.set_adjustments) {
        const workout = output.workouts[adj.workout_index]
        if (!workout) continue
        const item = workout.items[adj.item_index]
        if (!item) continue

        // Only allow ±1
        if (item.sets == null || Math.abs(adj.new_sets - item.sets) > 1) continue
        item.sets = adj.new_sets
        setAdjustmentsApplied++
    }

    // Apply reasoning fields
    if (diffs.workout_notes.length > 0) {
        output.reasoning.workout_notes = diffs.workout_notes
    }
    if (diffs.attention_flags.length > 0) {
        output.reasoning.attention_flags = diffs.attention_flags
    }
    output.reasoning.confidence_score = diffs.confidence_score

    return output
}

// ============================================================================
// optimizeWithAI — Main entry point
// ============================================================================

export async function optimizeWithAI(
    builderOutput: PrescriptionOutputSnapshot,
    profile: StudentPrescriptionProfile,
    constraints: PrescriptionConstraints,
    enrichedContext: EnrichedStudentContext,
    exercises: PrescriptionExerciseRef[],
    trainerAnswers?: PrescriptionAgentAnswer[],
    trainerPatterns?: TrainerPatterns | null,
    studentNarrative?: string | null,
): Promise<OptimizerResult> {
    const skipResult: OptimizerResult = {
        output: builderOutput,
        optimizerApplied: false,
        swapsApplied: 0,
        setAdjustments: 0,
        model: 'none',
        tokensUsed: { input: 0, output: 0 },
        status: 'optimizer_skipped',
    }

    // Check feature flag
    if (process.env.ENABLE_AI_OPTIMIZER === 'false') {
        console.log('[BuilderFirst] Optimizer disabled by feature flag')
        return skipResult
    }

    // Check if optimization is warranted
    if (!shouldOptimize(profile, enrichedContext, studentNarrative)) {
        console.log('[BuilderFirst] Optimizer skipped (beginner, low history, or low adherence)')
        return skipResult
    }

    // Check API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        console.warn('[BuilderFirst] Optimizer skipped — missing OPENAI_API_KEY')
        return skipResult
    }

    try {
        const startMs = Date.now()

        // Build context summary (deterministic, no LLM)
        const contextSummary = buildContextSummary(profile, enrichedContext, constraints, trainerAnswers)

        // Build swap candidates from graph (top 3 per exercise)
        const swapCandidates = await buildSwapCandidates(builderOutput.workouts)

        // Build prompt
        const systemPrompt = buildOptimizerSystemPrompt()
        const userPrompt = buildOptimizerUserPrompt(builderOutput, contextSummary, constraints, swapCandidates, trainerPatterns, studentNarrative)

        const estimatedTokens = Math.round((systemPrompt.length + userPrompt.length) / 4)
        console.log(`[BuilderFirst] Optimizer prompt: ~${estimatedTokens} tokens`)

        // Call GPT-4.1-mini via OpenAI API
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), OPTIMIZER_TIMEOUT_MS)

        let fetchResponse: Response
        try {
            fetchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model: OPTIMIZER_MODEL,
                    max_tokens: OPTIMIZER_MAX_TOKENS,
                    temperature: 0.3,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                }),
            })
        } catch (err: any) {
            clearTimeout(timeout)
            if (err?.name === 'AbortError') {
                console.warn('[BuilderFirst] Optimizer timeout')
                return { ...skipResult, status: 'optimizer_failed' }
            }
            throw err
        }
        clearTimeout(timeout)

        if (!fetchResponse.ok) {
            console.error('[BuilderFirst] OpenAI API error:', fetchResponse.status)
            return { ...skipResult, status: 'optimizer_failed' }
        }

        const payload = await fetchResponse.json()
        const elapsedMs = Date.now() - startMs
        const inputTokens = payload?.usage?.prompt_tokens ?? 0
        const outputTokens = payload?.usage?.completion_tokens ?? 0

        const costUsd = (inputTokens / 1_000_000) * 0.40 + (outputTokens / 1_000_000) * 1.60
        console.log(`[BuilderFirst] Optimizer completed in ${elapsedMs}ms — input: ${inputTokens}, output: ${outputTokens}, cost: $${costUsd.toFixed(4)}`)

        // Extract text
        const textContent = payload?.choices?.[0]?.message?.content
        if (!textContent || typeof textContent !== 'string') {
            console.warn('[BuilderFirst] Optimizer returned no text content')
            return { ...skipResult, status: 'optimizer_failed' }
        }

        // Parse response
        const diffs = parseOptimizerResponse(textContent)
        if (!diffs) {
            console.warn('[BuilderFirst] Failed to parse optimizer response')
            return {
                ...skipResult,
                model: OPTIMIZER_MODEL,
                tokensUsed: { input: inputTokens, output: outputTokens },
                status: 'optimizer_failed',
            }
        }

        // Check if optimizer made any changes
        const hasChanges = diffs.swaps.length > 0 || diffs.set_adjustments.length > 0

        if (!hasChanges) {
            // Apply only reasoning fields (notes, flags, confidence)
            const output = applyOptimizerDiffs(builderOutput, diffs, swapCandidates)
            console.log(`[BuilderFirst] Optimizer: no structural changes, notes/flags applied — ${elapsedMs}ms, ${inputTokens}+${outputTokens} tokens`)
            return {
                output,
                optimizerApplied: true,
                swapsApplied: 0,
                setAdjustments: 0,
                model: OPTIMIZER_MODEL,
                tokensUsed: { input: inputTokens, output: outputTokens },
                status: 'no_changes',
            }
        }

        // Apply diffs
        const optimized = applyOptimizerDiffs(builderOutput, diffs, swapCandidates)

        // Re-validate after optimizer changes
        const exerciseMap = new Map(exercises.map(e => [e.id, e]))
        const validation = validateOutput(optimized, profile, exerciseMap, constraints)

        if (validation.hasErrors) {
            console.warn(`[BuilderFirst] Optimizer introduced ${validation.violations.filter(v => v.severity === 'error').length} errors — discarding changes`)
            // Keep builder output but apply reasoning fields only
            const safeOutput = applyOptimizerDiffs(builderOutput, {
                ...diffs,
                swaps: [],
                set_adjustments: [],
            }, swapCandidates)
            return {
                output: safeOutput,
                optimizerApplied: false,
                swapsApplied: 0,
                setAdjustments: 0,
                model: OPTIMIZER_MODEL,
                tokensUsed: { input: inputTokens, output: outputTokens },
                status: 'optimizer_failed',
            }
        }

        // Enrich reasoning.adaptations with optimizer justifications
        const optimizerNotes = [
            ...diffs.swaps.map(s => s.reason),
            ...diffs.set_adjustments.map(s => s.reason),
        ].filter(Boolean)

        if (optimizerNotes.length > 0) {
            optimized.reasoning.adaptations = (optimized.reasoning.adaptations || '') +
                (optimized.reasoning.adaptations ? '\n' : '') +
                'Ajustes do optimizer: ' + optimizerNotes.join('. ')
        }

        // Also surface swap reasons as attention_flags for trainer visibility
        const swapFlags = diffs.swaps
            .map(s => s.reason)
            .filter(Boolean)
            .map(r => `[Optimizer] ${r}`)

        if (swapFlags.length > 0) {
            optimized.reasoning.attention_flags = [
                ...(optimized.reasoning.attention_flags || []),
                ...swapFlags,
            ]
        }

        const swapsApplied = diffs.swaps.length
        const setAdj = diffs.set_adjustments.length
        console.log(`[BuilderFirst] Optimizer: ${swapsApplied} swaps, ${setAdj} set adjustments — ${elapsedMs}ms, ${inputTokens}+${outputTokens} tokens`)

        return {
            output: optimized,
            optimizerApplied: true,
            swapsApplied,
            setAdjustments: setAdj,
            model: OPTIMIZER_MODEL,
            tokensUsed: { input: inputTokens, output: outputTokens },
            status: 'optimized',
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.warn(`[BuilderFirst] Optimizer failed: ${msg} — returning builder output`)
        return { ...skipResult, status: 'optimizer_failed' }
    }
}

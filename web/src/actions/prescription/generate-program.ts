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
    PrescriptionAgentState,
    TrainerPatterns,
} from '@kinevo/shared/types/prescription'

import { validateInput, validateOutput, fixViolations, resolveAiMode } from '@/lib/prescription/rules-engine'
import { buildHeuristicProgram, buildSlotBasedProgram } from '@/lib/prescription/program-builder'
import { buildPromptPair, parseAiResponse } from '@/lib/prescription/prompt-builder'
import { ENGINE_VERSION } from '@/lib/prescription/constants'
import { generateWithAgent } from '@/lib/prescription/claude-agent'
import { enrichStudentContext } from '@/lib/prescription/context-enricher'
import { buildConstraints } from '@/lib/prescription/constraints-engine'
import { selectSmartExercises } from '@/lib/prescription/exercise-selector'
import { getSubstitutes } from '@/lib/prescription/exercise-graph'
import { optimizeWithAI } from '@/lib/prescription/ai-optimizer'

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

// Maps high-level profile equipment options to specific exercise equipment values
// Keep in sync with analyze-context.ts EQUIPMENT_MAP
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

/**
 * Maps the trainer's natural-language equipment answer to an EQUIPMENT_MAP key.
 */
function mapEquipmentAnswerToKey(answer: string | undefined): string | null {
    if (!answer) return null
    const lower = answer.toLowerCase()
    if (lower.includes('academia completa')) return 'academia_completa'
    if (lower.includes('home gym completo')) return 'home_gym_completo'
    if (lower.includes('home gym básico') || lower.includes('home gym basico')) return 'home_gym_basico'
    if (lower.includes('ao ar livre')) return 'ao_ar_livre'
    if (lower.includes('peso corporal')) return 'apenas_peso_corporal'
    return null
}

// ============================================================================
// Main Action
// ============================================================================

export async function generateProgram(
    studentId: string,
    agentState?: PrescriptionAgentState | null,
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

    // Fetch trainer patterns separately (column from migration 064, may not exist yet)
    let trainerPatterns: TrainerPatterns | null = null
    try {
        const { data: patternData } = await supabase
            .from('trainers')
            .select('prescription_patterns')
            .eq('id', (trainer as any).id)
            .single()
        trainerPatterns = (patternData as any)?.prescription_patterns ?? null
    } catch {
        // Column doesn't exist yet — safe to ignore
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

    // ── 5. Fetch exercises (filtered by equipment if profile has it) ──
    const profileEquipKey = typedProfile.available_equipment?.[0] || null
    const exercises = await fetchExercisesForPrescription(supabase, profileEquipKey, typedProfile.favorite_exercise_ids)

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

    // ── 10a. Try Claude Agent if agentState is provided ──
    const builderFirstMode = process.env.ENABLE_BUILDER_FIRST === 'true'
    console.log(`[generateProgram] Mode: ${builderFirstMode ? 'builder-first' : 'agent'}`)

    if (agentState) {
        // Enforce agent state size limit
        const stateSize = new TextEncoder().encode(JSON.stringify(agentState)).length
        if (stateSize > 50_000) {
            console.warn('[generateProgram] agentState exceeds 50KB limit, truncating')
            const msgs = agentState.conversation_messages
            agentState = {
                ...agentState,
                conversation_messages: msgs.length > 2
                    ? [msgs[msgs.length - 2], msgs[msgs.length - 1]]
                    : msgs,
            }
        }

        // Extract equipment answer from trainer's responses (if agent asked)
        const equipmentAnswer = agentState.answers?.find(a => a.question_id === 'equipment')?.answer
        const resolvedEquipKey = mapEquipmentAnswerToKey(equipmentAnswer) || profileEquipKey

        // Re-fetch exercises with resolved equipment (may differ from initial fetch if trainer answered equipment question)
        const agentExercises = resolvedEquipKey !== profileEquipKey
            ? await fetchExercisesForPrescription(supabase, resolvedEquipKey, typedProfile.favorite_exercise_ids)
            : exercises

        // ── Diagnostic: muscle group distribution in agent exercise list ──
        const countByGroup: Record<string, number> = {}
        for (const e of agentExercises) {
            for (const mg of e.muscle_group_names) {
                countByGroup[mg] = (countByGroup[mg] || 0) + 1
            }
        }
        console.log(`[AgentePrescitor] agentExercises: ${agentExercises.length} (equipKey: ${resolvedEquipKey})`)
        console.log('[AgentePrescitor] Exercises by muscle group:', JSON.stringify(countByGroup, null, 2))

        const enrichedContext = await enrichStudentContext(supabase, studentId)

        // ── Apply volume trade-off answer if present ──
        const tradeoffAnswer = agentState.answers.find(a => a.question_id === 'volume_tradeoff')
        if (tradeoffAnswer) {
            const answer = tradeoffAnswer.answer
            if (answer.startsWith('Aumentar para')) {
                // Option 1: more exercises per session → increase session duration estimate
                typedProfile.session_duration_minutes = Math.round(typedProfile.session_duration_minutes * 1.15)
                console.log(`[AgentePrescitor] Trade-off: +1 exercise/session, duration adjusted to ${typedProfile.session_duration_minutes}min`)
            } else if (answer.startsWith('Adicionar 1 dia')) {
                // Option 3: add 1 training day
                const nextDay = (typedProfile.available_days[typedProfile.available_days.length - 1] ?? 5) + 1
                typedProfile.available_days = [...typedProfile.available_days, Math.min(nextDay, 7)]
                console.log(`[AgentePrescitor] Trade-off: +1 day, now ${typedProfile.available_days.length} days`)
            } else {
                // Option 2: accept reduced volume — cap will handle it, add prompt instruction
                console.log('[AgentePrescitor] Trade-off: accepted reduced volume, prioritize compounds')
            }
        }

        const constraints = buildConstraints(typedProfile, enrichedContext, agentState.answers)
        console.log(`[AgentePrescitor] Constraints: split=${constraints.split_type}, exercises/session=${constraints.exercises_per_session}, adherence=${constraints.adherence_adjustment} (${constraints.adherence_percentage}%)`)

        // Smart exercise selection: score-based with movement pattern diversity
        const previousIds = new Set(enrichedContext.previous_exercise_ids || [])
        const smartExercises = selectSmartExercises(agentExercises, constraints, previousIds)

        // Tier 1: Attach top 2 graph substitutes to each exercise (if compact pool enabled)
        const useCompactPool = process.env.ENABLE_COMPACT_EXERCISE_POOL !== 'false'
        if (useCompactPool) {
            const poolIds = new Set(smartExercises.map(e => e.id))
            await Promise.all(smartExercises.map(async (ex) => {
                try {
                    const subs = await getSubstitutes(ex.id)
                    // Filter to substitutes that exist in the pool and take top 2
                    const validSubs = subs
                        .filter(s => poolIds.has(s.exercise_id) && s.exercise_id !== ex.id)
                        .slice(0, 2)
                        .map(s => s.exercise_id)
                    ;(ex as any).substitute_ids = validSubs
                } catch {
                    ;(ex as any).substitute_ids = []
                }
            }))
            const withSubs = smartExercises.filter((e: any) => e.substitute_ids?.length > 0).length
            console.log(`[LLM_OPT] graph_substitutes: ${withSubs}/${smartExercises.length} exercises have pre-attached subs`)
        }

        // ── Builder-First Pipeline (feature-flagged) ──
        const useBuilderFirst = process.env.ENABLE_BUILDER_FIRST === 'true'

        if (useBuilderFirst) {
            console.log('[BuilderFirst] Pipeline active — skipping agent, using slot builder + optional optimizer')

            // Step 1: Build program deterministically
            outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext)
            source = 'heuristic'
            model = 'slot-builder'
            llmStatus = 'llm_disabled' as LLMStatus

            // Step 2: Optionally optimize with AI (Haiku)
            const optimizerResult = await optimizeWithAI(
                outputSnapshot,
                typedProfile,
                constraints,
                enrichedContext,
                agentExercises,
                agentState.answers,
            )

            outputSnapshot = optimizerResult.output

            if (optimizerResult.optimizerApplied) {
                source = 'agent' // Indicate AI was involved
                model = optimizerResult.model
                llmStatus = 'llm_used'
            }

            console.log(`[BuilderFirst] Optimizer status: ${optimizerResult.status}, swaps: ${optimizerResult.swapsApplied}, set_adj: ${optimizerResult.setAdjustments}`)

            // Step 3: Validate final output
            const agentExerciseMap = new Map(agentExercises.map(e => [e.id, e]))
            const validation = validateOutput(outputSnapshot, typedProfile, agentExerciseMap, constraints)
            allViolations = validation.violations

            if (validation.hasErrors) {
                const fixResult = fixViolations(outputSnapshot, validation.violations, agentExerciseMap)
                if (fixResult.remainingViolations.some(v => v.severity === 'error')) {
                    console.warn('[BuilderFirst] Unfixable errors after optimization — rebuilding')
                    outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext)
                    source = 'heuristic'
                    model = 'slot-builder'
                    llmStatus = 'validation_failed' as LLMStatus
                } else {
                    outputSnapshot = fixResult.fixed
                    allViolations = [...fixResult.appliedFixes, ...fixResult.remainingViolations]
                }
            }

            // Step 4: Save
            const generationTimeMs = Date.now() - startTime

            const agentInputSnapshot = {
                ...inputSnapshot,
                agent_conversation: agentState.conversation_messages,
                context_analysis: agentState.context_analysis,
                web_search_queries: agentState.context_analysis?.web_search_queries || [],
                builder_first: true,
                optimizer_status: optimizerResult.status,
                optimizer_tokens: optimizerResult.tokensUsed,
            }

            // @ts-ignore — table from migration 035
            const insertPayload: Record<string, unknown> = {
                trainer_id: trainer.id,
                student_id: studentId,
                assigned_program_id: null,
                ai_mode_used: aiMode,
                ai_model: model,
                ai_source: source,
                input_snapshot: agentInputSnapshot,
                output_snapshot: outputSnapshot,
                rules_violations: allViolations,
                status: 'pending_review',
                generation_time_ms: generationTimeMs,
                confidence_score: outputSnapshot.reasoning.confidence_score,
            }

            // @ts-ignore — table from migration 035
            const { data: generation, error: genError } = await supabase
                .from('prescription_generations')
                .insert(insertPayload)
                .select('id')
                .single()

            if (genError || !generation) {
                console.error('[BuilderFirst] Failed to save generation:', genError)
                return { success: false, error: 'Erro ao salvar geração.' }
            }

            // Save equipment answer if changed
            const equipmentAnswer = agentState.answers?.find(a => a.question_id === 'equipment')?.answer
            if (equipmentAnswer && resolvedEquipKey && resolvedEquipKey !== profileEquipKey) {
                // @ts-ignore — table from migration 034
                await supabase
                    .from('student_prescription_profiles')
                    .update({ available_equipment: [resolvedEquipKey] })
                    .eq('student_id', studentId)
                    .then(({ error: updateErr }) => {
                        if (updateErr) console.warn('[BuilderFirst] Failed to save equipment to profile:', updateErr.message)
                    })
            }

            return {
                success: true,
                generationId: (generation as any).id as string,
                aiMode,
                source,
                llmStatus,
                violations: allViolations.length > 0 ? allViolations : undefined,
            }
        }

        // ── Agent Pipeline (existing path when ENABLE_BUILDER_FIRST is not 'true') ──
        const agentResult = await generateWithAgent(agentState, typedProfile, smartExercises, enrichedContext, constraints, trainerPatterns)

        if (agentResult.output && !agentResult.fallback) {
            // Build exercise map from the exercises the agent actually received
            const agentExerciseMap = new Map(smartExercises.map(e => [e.id, e]))

            // ── Diagnostic logging (temporary) ──
            console.log('[AgentePrescitor] Raw agent output:', JSON.stringify(agentResult.output, null, 2))
            console.log(`[AgentePrescitor] smartExercises: ${smartExercises.length} exercises (from ${agentExercises.length} raw, equipKey: ${resolvedEquipKey})`)

            // Check how many exercise_ids from the output exist in our exercise map
            const allItemIds = agentResult.output.workouts.flatMap(w => w.items.map(i => i.exercise_id))
            const missingIds = allItemIds.filter(id => !agentExerciseMap.has(id))
            if (missingIds.length > 0) {
                console.warn(`[AgentePrescitor] ${missingIds.length}/${allItemIds.length} exercise_ids NOT in exerciseMap:`, missingIds)
            }

            // Agent succeeded — validate output (pass constraints so volume checks use post-cap budget)
            const validation = validateOutput(agentResult.output, typedProfile, agentExerciseMap, constraints)

            // Log all validation violations for diagnosis
            if (validation.violations.length > 0) {
                console.log('[AgentePrescitor] Validation violations:', JSON.stringify(validation.violations, null, 2))
            }

            if (validation.hasErrors) {
                const fixResult = fixViolations(agentResult.output, validation.violations, agentExerciseMap)

                if (fixResult.remainingViolations.some(v => v.severity === 'error')) {
                    console.warn('[generateProgram] Agent output has unfixable errors, falling back to heuristic')
                    console.warn('[AgentePrescitor] Unfixable errors:', JSON.stringify(
                        fixResult.remainingViolations.filter(v => v.severity === 'error'), null, 2
                    ))
                    const useSlotBuilder = process.env.ENABLE_SLOT_BASED_BUILDER !== 'false'
                    if (useSlotBuilder) {
                        outputSnapshot = await buildSlotBasedProgram(typedProfile, agentExercises, constraints, enrichedContext)
                    } else {
                        outputSnapshot = buildHeuristicProgram(typedProfile, agentExercises)
                    }
                    source = 'heuristic'
                    llmStatus = 'validation_failed' as LLMStatus
                    allViolations = validation.violations
                } else {
                    outputSnapshot = fixResult.fixed
                    source = 'agent'
                    model = agentResult.model
                    llmStatus = 'llm_used'
                    allViolations = [...fixResult.appliedFixes, ...fixResult.remainingViolations]
                }
            } else {
                outputSnapshot = agentResult.output
                source = 'agent'
                model = agentResult.model
                llmStatus = 'llm_used'
                allViolations = validation.violations
            }

            const generationTimeMs = Date.now() - startTime

            // Store agent data inside input_snapshot (existing JSONB column)
            // so it works before migration 058 adds dedicated columns.
            const agentInputSnapshot = {
                ...inputSnapshot,
                agent_conversation: agentState.conversation_messages,
                context_analysis: agentState.context_analysis,
                web_search_queries: agentState.context_analysis?.web_search_queries || [],
            }

            // @ts-ignore — table from migration 035
            const insertPayload: Record<string, unknown> = {
                trainer_id: trainer.id,
                student_id: studentId,
                assigned_program_id: null,
                ai_mode_used: aiMode,
                ai_model: model,
                ai_source: source,
                input_snapshot: agentInputSnapshot,
                output_snapshot: outputSnapshot,
                rules_violations: allViolations,
                status: 'pending_review',
                generation_time_ms: generationTimeMs,
                confidence_score: outputSnapshot.reasoning.confidence_score,
            }

            // Try to use dedicated columns if migration 058 has been applied.
            // If it hasn't, the data is still safe in input_snapshot above.
            try {
                insertPayload.agent_conversation = agentState.conversation_messages
                insertPayload.context_analysis = agentState.context_analysis
                insertPayload.web_search_queries = agentState.context_analysis?.web_search_queries || []
            } catch { /* ignore if columns don't exist */ }

            // @ts-ignore — table from migration 035
            let { data: generation, error: genError } = await supabase
                .from('prescription_generations')
                .insert(insertPayload)
                .select('id')
                .single()

            // If insert fails (likely missing columns from migration 058),
            // retry without the agent-specific columns
            if (genError) {
                console.warn('[generateProgram] Insert with agent columns failed, retrying without:', genError.message)
                delete insertPayload.agent_conversation
                delete insertPayload.context_analysis
                delete insertPayload.web_search_queries

                // @ts-ignore
                const retryResult = await supabase
                    .from('prescription_generations')
                    .insert(insertPayload)
                    .select('id')
                    .single()

                generation = retryResult.data
                genError = retryResult.error
            }

            if (genError || !generation) {
                console.error('[generateProgram] failed to create prescription_generation:', genError)
                return { success: false, error: 'Erro ao salvar geração.' }
            }

            // Save equipment answer to profile so next prescription won't ask again
            if (equipmentAnswer && resolvedEquipKey && resolvedEquipKey !== profileEquipKey) {
                // @ts-ignore — table from migration 034
                await supabase
                    .from('student_prescription_profiles')
                    .update({ available_equipment: [resolvedEquipKey] })
                    .eq('student_id', studentId)
                    .then(({ error: updateErr }) => {
                        if (updateErr) console.warn('[generateProgram] Failed to save equipment to profile:', updateErr.message)
                        else console.log(`[generateProgram] Saved equipment '${resolvedEquipKey}' to profile`)
                    })
            }

            return {
                success: true,
                generationId: (generation as any).id as string,
                aiMode,
                source,
                llmStatus,
                violations: allViolations.length > 0 ? allViolations : undefined,
            }
        }

        // Agent failed — fall through to OpenAI/heuristic
        console.warn('[generateProgram] Agent generation failed, falling back:', agentResult.status)
    }

    // ── 10b. Try OpenAI generation (legacy path or agent fallback) ──
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

const EXERCISE_SELECT_COLUMNS = `
    id,
    name,
    equipment,
    difficulty_level,
    is_primary_movement,
    session_position,
    movement_pattern,
    movement_pattern_family,
    fatigue_class,
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
        movement_pattern_family: e.movement_pattern_family || null,
        fatigue_class: e.fatigue_class || 'moderate',
        prescription_notes: e.prescription_notes || null,
    }
}

/** Minimum curated pool size before falling back to full exercise library */
const MIN_CURATED_POOL_SIZE = 15

async function fetchExercisesForPrescription(
    supabase: Awaited<ReturnType<typeof createClient>>,
    equipmentKey?: string | null,
    favoriteExerciseIds?: string[],
): Promise<PrescriptionExerciseRef[]> {
    const allowedTypes = equipmentKey
        ? EQUIPMENT_MAP[equipmentKey] || EQUIPMENT_MAP['academia_completa']
        : null

    // Query 1: Curated exercises filtered by equipment
    let curatedQuery = supabase
        .from('exercises')
        .select(EXERCISE_SELECT_COLUMNS)
        .eq('is_archived', false)
        .eq('is_ai_curated', true)

    if (allowedTypes) {
        curatedQuery = curatedQuery.in('equipment', allowedTypes)
    }

    const { data: curatedExercises, error } = await curatedQuery.order('name', { ascending: true })

    if (error) {
        console.error('[generateProgram] failed to fetch curated exercises:', error)
        return []
    }

    const curated = (curatedExercises || []).map(mapExerciseRow)

    // Query 2: Favorite exercises NOT in curated set
    let favorites: PrescriptionExerciseRef[] = []
    if (favoriteExerciseIds && favoriteExerciseIds.length > 0) {
        const curatedIds = new Set(curated.map(e => e.id))
        const nonCuratedFavoriteIds = favoriteExerciseIds.filter(id => !curatedIds.has(id))

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
        console.warn(`[Prescription] Curated pool too small (${pool.length}), falling back to full pool`)

        let fullQuery = supabase
            .from('exercises')
            .select(EXERCISE_SELECT_COLUMNS)
            .eq('is_archived', false)

        if (allowedTypes) {
            fullQuery = fullQuery.in('equipment', allowedTypes)
        }

        const { data: allExercises, error: fullError } = await fullQuery.order('name', { ascending: true })

        if (fullError || !allExercises) {
            console.error('[generateProgram] failed to fetch full exercises:', fullError)
            return pool // return whatever we have
        }

        return allExercises.map(mapExerciseRow)
    }

    return pool
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

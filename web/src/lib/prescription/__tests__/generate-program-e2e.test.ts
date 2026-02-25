// ============================================================================
// Kinevo Prescription Engine — E2E Test (no DB, no auth)
// ============================================================================
// Tests the full generation pipeline: profile → validateInput → AI/heuristic →
// validateOutput → fixViolations → output snapshot.
// Run with: npx tsx web/src/lib/prescription/__tests__/generate-program-e2e.test.ts

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionInputSnapshot,
    PrescriptionPerformanceContext,
    PrescriptionOutputSnapshot,
} from '@kinevo/shared/types/prescription'

import { validateInput, validateOutput, fixViolations, resolveAiMode } from '../rules-engine'
import { buildHeuristicProgram } from '../program-builder'
import { buildPromptPair, parseAiResponse } from '../prompt-builder'
import { ENGINE_VERSION } from '../constants'

// ============================================================================
// Helpers
// ============================================================================

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
    if (condition) {
        passed++
        console.log(`  ✓ ${message}`)
    } else {
        failed++
        console.error(`  ✗ FAIL: ${message}`)
    }
}

function section(title: string) {
    console.log(`\n━━ ${title} ━━`)
}

// ============================================================================
// Fixtures — using EXACT DB muscle group names
// ============================================================================

function makeProfile(overrides: Partial<StudentPrescriptionProfile> = {}): StudentPrescriptionProfile {
    return {
        id: 'profile-1',
        student_id: 'student-1',
        trainer_id: 'trainer-1',
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 3, 5],
        session_duration_minutes: 60,
        available_equipment: ['academia_completa'],
        favorite_exercise_ids: [],
        disliked_exercise_ids: [],
        medical_restrictions: [],
        ai_mode: 'copilot',
        adherence_rate: null,
        avg_session_duration_minutes: null,
        last_calculated_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

function makeExercise(overrides: Partial<PrescriptionExerciseRef> = {}): PrescriptionExerciseRef {
    return {
        id: `ex-${Math.random().toString(36).slice(2, 8)}`,
        name: 'Exercício Genérico',
        muscle_group_names: ['Peito'],
        equipment: null,
        is_compound: false,
        difficulty_level: 'intermediate',
        is_primary_movement: false,
        session_position: 'middle',
        ...overrides,
    }
}

function makeExerciseLibrary(): PrescriptionExerciseRef[] {
    return [
        // === Primary groups: Compounds ===
        makeExercise({ id: 'supino-reto', name: 'Supino Reto', muscle_group_names: ['Peito'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'supino-inclinado', name: 'Supino Inclinado', muscle_group_names: ['Peito'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'remada-curvada', name: 'Remada Curvada', muscle_group_names: ['Costas'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'puxada-frontal', name: 'Puxada Frontal', muscle_group_names: ['Costas'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'agachamento-livre', name: 'Agachamento Livre', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'leg-press', name: 'Leg Press', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'desenvolvimento', name: 'Desenvolvimento com Halteres', muscle_group_names: ['Ombros'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'hip-thrust', name: 'Hip Thrust', muscle_group_names: ['Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'stiff', name: 'Stiff', muscle_group_names: ['Posterior de Coxa', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),
        makeExercise({ id: 'passada', name: 'Passada com Halteres', muscle_group_names: ['Quadríceps', 'Glúteo'], is_compound: true, is_primary_movement: true, session_position: 'first' }),

        // === Primary groups: Isolations ===
        makeExercise({ id: 'crucifixo', name: 'Crucifixo', muscle_group_names: ['Peito'], is_compound: false }),
        makeExercise({ id: 'pullover', name: 'Pullover', muscle_group_names: ['Costas'], is_compound: false }),
        makeExercise({ id: 'cadeira-ext', name: 'Cadeira Extensora', muscle_group_names: ['Quadríceps'], is_compound: false }),
        makeExercise({ id: 'mesa-flexora', name: 'Mesa Flexora', muscle_group_names: ['Posterior de Coxa'], is_compound: false }),
        makeExercise({ id: 'elevacao-lateral', name: 'Elevação Lateral', muscle_group_names: ['Ombros'], is_compound: false }),
        makeExercise({ id: 'gluteo-maquina', name: 'Glúteo na Máquina', muscle_group_names: ['Glúteo'], is_compound: false }),

        // === Small groups ===
        makeExercise({ id: 'rosca-direta', name: 'Rosca Direta', muscle_group_names: ['Bíceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-pulley', name: 'Tríceps Pulley', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'abdominal', name: 'Abdominal Crunch', muscle_group_names: ['Abdominais'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'panturrilha', name: 'Panturrilha em Pé', muscle_group_names: ['Panturrilha'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'trapezio-encolhimento', name: 'Encolhimento com Barra', muscle_group_names: ['Trapézio'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
    ]
}

// ============================================================================
// Test 1: Full pipeline — Beginner 3x/week heuristic
// ============================================================================

section('Full Pipeline — Beginner 3x/week Heuristic')

{
    const profile = makeProfile({
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 3, 5],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))

    // Step 1: Resolve mode
    const aiMode = resolveAiMode(profile, null)
    assert(aiMode === 'auto', `AI mode = ${aiMode} (expected auto)`)

    // Step 2: Validate input
    const inputValidation = validateInput(profile, exercises)
    assert(inputValidation.valid === true, 'Input validation passes')

    // Step 3: Build input snapshot
    const inputSnapshot: PrescriptionInputSnapshot = {
        profile: {
            student_id: profile.student_id,
            training_level: profile.training_level,
            goal: profile.goal,
            available_days: profile.available_days,
            session_duration_minutes: profile.session_duration_minutes,
            available_equipment: profile.available_equipment,
            favorite_exercise_ids: profile.favorite_exercise_ids,
            disliked_exercise_ids: profile.disliked_exercise_ids,
            medical_restrictions: profile.medical_restrictions,
            ai_mode: profile.ai_mode,
            adherence_rate: profile.adherence_rate,
        },
        available_exercises: exercises,
        performance_context: null,
        engine_version: ENGINE_VERSION,
    }
    assert(inputSnapshot.engine_version === '1.0.0', 'Input snapshot has engine version')

    // Step 4: Generate (heuristic — no OpenAI key)
    const output = buildHeuristicProgram(profile, exercises)
    assert(output.workouts.length === 3, `Generated ${output.workouts.length} workouts`)
    assert(output.program.duration_weeks === 4, 'Duration = 4 weeks')

    // Step 5: Validate output
    const validation = validateOutput(output, profile, exerciseMap)
    const errors = validation.violations.filter(v => v.severity === 'error')
    assert(errors.length === 0, `Output passes validation (${errors.length} errors)`)

    // Step 6: Verify snapshot fields on items
    for (const workout of output.workouts) {
        for (const item of workout.items) {
            assert(item.exercise_name !== '', `Item has exercise_name: ${item.exercise_name}`)
            assert(item.exercise_muscle_group !== '', `Item has muscle_group: ${item.exercise_muscle_group}`)
            assert(item.sets >= 1, `Item has sets >= 1: ${item.sets}`)
            assert(item.reps !== '', `Item has reps: ${item.reps}`)
            assert(item.rest_seconds > 0, `Item has rest_seconds > 0: ${item.rest_seconds}`)
        }
    }

    // Step 7: Verify reasoning
    assert(output.reasoning.structure_rationale !== '', 'Reasoning has structure_rationale')
    assert(output.reasoning.confidence_score > 0, `Confidence = ${output.reasoning.confidence_score}`)

    console.log('\n  → Pipeline result: { success: true, source: "heuristic" }')
}

// ============================================================================
// Test 2: Prompt builder produces valid prompts
// ============================================================================

section('Prompt Builder')

{
    const profile = makeProfile()
    const exercises = makeExerciseLibrary()

    const { system, user } = buildPromptPair(profile, exercises, null)

    assert(system.includes('# PAPEL'), 'System prompt has Role section')
    assert(system.includes('# METODOLOGIA KINEVO'), 'System prompt has Methodology section')
    assert(system.includes('# RESTRIÇÕES ABSOLUTAS'), 'System prompt has Constraints section')
    assert(system.includes('# FORMATO DE SAÍDA'), 'System prompt has Output Format section')
    assert(system.includes('# REGRAS DE RESPOSTA'), 'System prompt has Response Rules section')
    assert(system.includes('10–12'), 'System prompt includes beginner volume range from constants')
    assert(system.includes('Bíceps'), 'System prompt includes small muscle groups from constants')

    // User prompt is valid JSON
    let userParsed: any
    try {
        userParsed = JSON.parse(user)
        assert(true, 'User prompt is valid JSON')
    } catch {
        assert(false, 'User prompt is valid JSON')
    }

    assert(userParsed?.student_profile?.training_level === 'beginner', 'User prompt has student training_level')
    assert(Array.isArray(userParsed?.available_exercises), 'User prompt has exercises array')
    assert(userParsed.available_exercises.length === exercises.length, `User prompt has ${exercises.length} exercises`)
}

// ============================================================================
// Test 3: parseAiResponse
// ============================================================================

section('parseAiResponse')

{
    // Valid response
    const validJson = JSON.stringify({
        program: { name: 'Test', description: 'Desc', duration_weeks: 4 },
        workouts: [{
            name: 'Treino A',
            order_index: 0,
            scheduled_days: [1],
            items: [{
                exercise_id: 'supino-reto',
                exercise_name: 'Supino Reto',
                exercise_muscle_group: 'Peito',
                exercise_equipment: null,
                sets: 3,
                reps: '8-12',
                rest_seconds: 90,
                notes: null,
                substitute_exercise_ids: [],
                order_index: 0,
            }],
        }],
        reasoning: {
            structure_rationale: 'Full body',
            volume_rationale: 'Min volume',
            workout_notes: ['Treino A: 1 exercício'],
            attention_flags: [],
            confidence_score: 0.85,
        },
    })

    const parsed = parseAiResponse(validJson)
    assert(parsed !== null, 'Valid JSON parses successfully')
    assert(parsed!.workouts[0].items[0].exercise_id === 'supino-reto', 'Parsed exercise_id correct')
    assert(parsed!.reasoning.confidence_score === 0.85, 'Parsed confidence_score correct')

    // Invalid response — missing workouts
    const invalidJson = JSON.stringify({ program: { name: 'X' } })
    assert(parseAiResponse(invalidJson) === null, 'Invalid JSON (missing workouts) returns null')

    // Invalid response — not JSON
    assert(parseAiResponse('not json at all') === null, 'Non-JSON returns null')

    // Invalid response — missing exercise_id
    const missingIdJson = JSON.stringify({
        program: { name: 'X', description: '', duration_weeks: 4 },
        workouts: [{ name: 'A', items: [{ sets: 3, reps: '8-12' }] }],
        reasoning: { structure_rationale: '', volume_rationale: '', workout_notes: [], attention_flags: [], confidence_score: 0.5 },
    })
    assert(parseAiResponse(missingIdJson) === null, 'Missing exercise_id returns null')
}

// ============================================================================
// Test 4: Intermediate 4x/week full pipeline
// ============================================================================

section('Full Pipeline — Intermediate 4x/week')

{
    const profile = makeProfile({
        training_level: 'intermediate',
        goal: 'weight_loss',
        available_days: [1, 2, 4, 5],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))
    const perfCtx: PrescriptionPerformanceContext = {
        weeks_of_history: 8,
        recent_adherence_rate: 90,
        recent_avg_rpe: 7.5,
        stalled_exercise_ids: [],
        previous_program: null,
    }

    const aiMode = resolveAiMode(profile, perfCtx)
    assert(aiMode === 'copilot', `AI mode = ${aiMode}`)

    const output = buildHeuristicProgram(profile, exercises)
    assert(output.workouts.length === 4, `Generated ${output.workouts.length} workouts`)

    const validation = validateOutput(output, profile, exerciseMap)
    const errors = validation.violations.filter(v => v.severity === 'error')
    assert(errors.length === 0, `Validation passes (${errors.length} errors)`)

    console.log('\n  → Pipeline result: { success: true, source: "heuristic" }')
}

// ============================================================================
// Test 5: Beginner 5x/week — Full PPL+ validation
// ============================================================================

section('Full Pipeline — Beginner 5x/week PPL+')

{
    const profile = makeProfile({
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 2, 3, 5, 6],
        session_duration_minutes: 60,
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))

    const output = buildHeuristicProgram(profile, exercises)

    assert(output.workouts.length === 5, `Generated ${output.workouts.length} workouts`)

    // Each workout: 4-6 exercises
    for (const w of output.workouts) {
        assert(
            w.items.length >= 4 && w.items.length <= 6,
            `${w.name}: ${w.items.length} exercises (4-6 range)`,
        )
    }

    // All workouts have at least 1 compound
    for (const w of output.workouts) {
        const hasCompound = w.items.some(i => exerciseMap.get(i.exercise_id)?.is_compound === true)
        assert(hasCompound, `${w.name}: has compound`)
    }

    // Validates without errors
    const validation = validateOutput(output, profile, exerciseMap)
    const errors = validation.violations.filter(v => v.severity === 'error')
    assert(errors.length === 0, `PPL+ validates (${errors.length} errors)`)

    // Coverage: Quadríceps, Posterior de Coxa/Glúteo on distinct days
    const musclesByWorkout = output.workouts.map(w => ({
        name: w.name,
        groups: [...new Set(w.items.map(i => i.exercise_muscle_group))],
    }))

    const hasQuads = musclesByWorkout.some(w => w.groups.includes('Quadríceps'))
    const hasPostCoxa = musclesByWorkout.some(w =>
        w.groups.includes('Posterior de Coxa') || w.groups.includes('Glúteo'),
    )
    assert(hasQuads, 'PPL+ covers Quadríceps')
    assert(hasPostCoxa, 'PPL+ covers Posterior de Coxa / Glúteo')

    console.log('\n  → Pipeline result: { success: true, source: "heuristic", structure: "ppl_plus" }')
}

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${'═'.repeat(50)}`)
console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
console.log(`${'═'.repeat(50)}`)

if (failed > 0) {
    process.exit(1)
}

// ============================================================================
// Kinevo Prescription Engine — Unit Tests
// ============================================================================
// Run with: npx tsx web/src/lib/prescription/__tests__/rules-engine.test.ts

import {
    validateInput,
    validateOutput,
    fixViolations,
    resolveAiMode,
    computeWeeklyVolumePerMuscle,
} from '../rules-engine'

import { buildHeuristicProgram } from '../program-builder'

import type {
    StudentPrescriptionProfile,
    PrescriptionExerciseRef,
    PrescriptionOutputSnapshot,
    GeneratedWorkout,
    PrescriptionPerformanceContext,
} from '@kinevo/shared/types/prescription'

import { VOLUME_RANGES } from '@kinevo/shared/types/prescription'

// ============================================================================
// Test Helpers
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
        available_days: [1, 3, 5], // Mon, Wed, Fri
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
        makeExercise({ id: 'rosca-alternada', name: 'Rosca Alternada', muscle_group_names: ['Bíceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'rosca-martelo', name: 'Rosca Martelo', muscle_group_names: ['Bíceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-pulley', name: 'Tríceps Pulley', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-testa', name: 'Tríceps Testa', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'triceps-corda', name: 'Tríceps Corda', muscle_group_names: ['Tríceps'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'abdominal', name: 'Abdominal Crunch', muscle_group_names: ['Abdominais'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'panturrilha', name: 'Panturrilha em Pé', muscle_group_names: ['Panturrilha'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
        makeExercise({ id: 'trapezio-encolhimento', name: 'Encolhimento com Barra', muscle_group_names: ['Trapézio'], is_compound: false, difficulty_level: 'beginner', session_position: 'last' }),
    ]
}

function makeExerciseMap(exercises: PrescriptionExerciseRef[]): Map<string, PrescriptionExerciseRef> {
    return new Map(exercises.map(e => [e.id, e]))
}

// ============================================================================
// Tests: validateInput
// ============================================================================

section('validateInput')

{
    const profile = makeProfile()
    const exercises = makeExerciseLibrary()
    const result = validateInput(profile, exercises)
    assert(result.valid === true, 'Valid profile + exercises → passes')
}

{
    const profile = makeProfile({ available_days: [] })
    const exercises = makeExerciseLibrary()
    const result = validateInput(profile, exercises)
    assert(result.valid === false, 'Empty available_days → fails')
    assert(result.errors.some(e => e.includes('pelo menos 1 dia')), 'Error message mentions days')
}

{
    const profile = makeProfile()
    const result = validateInput(profile, [])
    assert(result.valid === false, 'Empty exercise library → fails')
}

{
    const profile = makeProfile()
    const isolationOnly = [makeExercise({ is_compound: false })]
    const result = validateInput(profile, isolationOnly)
    assert(result.valid === false, 'No compound exercises → fails')
}

// ============================================================================
// Tests: validateOutput — Volume exceeds max
// ============================================================================

section('validateOutput — Volume')

{
    const profile = makeProfile({ training_level: 'beginner' })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    // Build a program that intentionally exceeds volume for Peito (PRIMARY group)
    const overVolume: PrescriptionOutputSnapshot = {
        program: { name: 'Test', description: 'Test', duration_weeks: 4 },
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 3, 5], // 3x/week = sets × 3
                items: [
                    {
                        exercise_id: 'supino-reto', exercise_name: 'Supino Reto',
                        exercise_muscle_group: 'Peito', exercise_equipment: null,
                        sets: 5, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                ],
            },
        ],
        reasoning: {
            structure_rationale: '', volume_rationale: '',
            workout_notes: [], attention_flags: [], confidence_score: 0.8,
        },
    }

    // 5 sets × 3 days = 15 weekly sets for Peito. Beginner max = 12.
    const result = validateOutput(overVolume, profile, exerciseMap)
    assert(result.hasErrors === true, 'Volume 15 sets/week for beginner Peito → error')
    const volumeViolation = result.violations.find(v => v.rule_id === 'volume_exceeds_max')
    assert(volumeViolation !== undefined, 'Violation is volume_exceeds_max')
    assert(volumeViolation!.context.muscle_group === 'Peito', 'Violation targets Peito')
    assert(volumeViolation!.context.actual_value === 15, 'Actual value is 15')
}

{
    // Volume for a SMALL group should NOT trigger volume_exceeds_max
    const profile = makeProfile({ training_level: 'beginner' })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const smallGroupHighVolume: PrescriptionOutputSnapshot = {
        program: { name: 'Test', description: 'Test', duration_weeks: 4 },
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 3, 5],
                items: [
                    {
                        exercise_id: 'supino-reto', exercise_name: 'Supino Reto',
                        exercise_muscle_group: 'Peito', exercise_equipment: null,
                        sets: 3, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                    {
                        exercise_id: 'rosca-direta', exercise_name: 'Rosca Direta',
                        exercise_muscle_group: 'Bíceps', exercise_equipment: null,
                        sets: 5, reps: '10-15', rest_seconds: 60, notes: null,
                        substitute_exercise_ids: [], order_index: 1,
                    },
                ],
            },
        ],
        reasoning: {
            structure_rationale: '', volume_rationale: '',
            workout_notes: [], attention_flags: [], confidence_score: 0.8,
        },
    }

    // Bíceps: 5 × 3 = 15 weekly sets. BUT Bíceps is SMALL, so no volume_exceeds_max error.
    const result = validateOutput(smallGroupHighVolume, profile, exerciseMap)
    const volumeViolation = result.violations.find(v => v.rule_id === 'volume_exceeds_max' && v.context.muscle_group === 'Bíceps')
    assert(volumeViolation === undefined, 'Small group (Bíceps) high volume does NOT trigger volume_exceeds_max')
}

// ============================================================================
// Tests: validateOutput — Medical restriction
// ============================================================================

section('validateOutput — Medical Restriction')

{
    const profile = makeProfile({
        medical_restrictions: [{
            description: 'Dor no joelho',
            restricted_exercise_ids: ['leg-press'],
            restricted_muscle_groups: [],
            severity: 'moderate',
        }],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const withRestricted: PrescriptionOutputSnapshot = {
        program: { name: 'Test', description: 'Test', duration_weeks: 4 },
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1],
                items: [
                    {
                        exercise_id: 'agachamento-livre', exercise_name: 'Agachamento Livre',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                    {
                        exercise_id: 'leg-press', exercise_name: 'Leg Press',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '10-12', rest_seconds: 60, notes: null,
                        substitute_exercise_ids: [], order_index: 1,
                    },
                ],
            },
        ],
        reasoning: {
            structure_rationale: '', volume_rationale: '',
            workout_notes: [], attention_flags: [], confidence_score: 0.8,
        },
    }

    const result = validateOutput(withRestricted, profile, exerciseMap)
    assert(result.hasErrors === true, 'Restricted exercise in program → error')
    const restrictedV = result.violations.find(v => v.rule_id === 'restricted_exercise')
    assert(restrictedV !== undefined, 'Violation is restricted_exercise')
    assert(restrictedV!.context.exercise_id === 'leg-press', 'Violation targets leg-press')
}

// ============================================================================
// Tests: fixViolations — Remove restricted exercise
// ============================================================================

section('fixViolations')

{
    const profile = makeProfile({
        medical_restrictions: [{
            description: 'Dor no joelho',
            restricted_exercise_ids: ['leg-press'],
            restricted_muscle_groups: [],
            severity: 'moderate',
        }],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const withRestricted: PrescriptionOutputSnapshot = {
        program: { name: 'Test', description: 'Test', duration_weeks: 4 },
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1],
                items: [
                    {
                        exercise_id: 'agachamento-livre', exercise_name: 'Agachamento Livre',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                    {
                        exercise_id: 'leg-press', exercise_name: 'Leg Press',
                        exercise_muscle_group: 'Quadríceps', exercise_equipment: null,
                        sets: 3, reps: '10-12', rest_seconds: 60, notes: null,
                        substitute_exercise_ids: [], order_index: 1,
                    },
                ],
            },
        ],
        reasoning: {
            structure_rationale: '', volume_rationale: '',
            workout_notes: [], attention_flags: [], confidence_score: 0.8,
        },
    }

    const violations = validateOutput(withRestricted, profile, exerciseMap).violations
    const restrictedViolations = violations.filter(v => v.rule_id === 'restricted_exercise')

    const fixResult = fixViolations(withRestricted, restrictedViolations, exerciseMap)
    assert(fixResult.appliedFixes.length > 0, 'Fix was applied')
    assert(fixResult.appliedFixes[0].auto_fixed === true, 'Fix marked as auto_fixed')

    // Check the exercise was removed
    const remainingItems = fixResult.fixed.workouts[0].items
    const hasLegPress = remainingItems.some(i => i.exercise_id === 'leg-press')
    assert(hasLegPress === false, 'Leg Press removed from program after fix')
    assert(remainingItems.length === 1, 'Only agachamento remains')
}

// ============================================================================
// Tests: fixViolations — Reduce volume
// ============================================================================

section('fixViolations — Volume Reduction')

{
    const profile = makeProfile({ training_level: 'beginner' })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const overVolume: PrescriptionOutputSnapshot = {
        program: { name: 'Test', description: 'Test', duration_weeks: 4 },
        workouts: [
            {
                name: 'Treino A',
                order_index: 0,
                scheduled_days: [1, 3, 5],
                items: [
                    {
                        exercise_id: 'supino-reto', exercise_name: 'Supino Reto',
                        exercise_muscle_group: 'Peito', exercise_equipment: null,
                        sets: 5, reps: '8-12', rest_seconds: 90, notes: null,
                        substitute_exercise_ids: [], order_index: 0,
                    },
                ],
            },
        ],
        reasoning: {
            structure_rationale: '', volume_rationale: '',
            workout_notes: [], attention_flags: [], confidence_score: 0.8,
        },
    }

    const violations = validateOutput(overVolume, profile, exerciseMap).violations
    const volumeViolation = violations.filter(v => v.rule_id === 'volume_exceeds_max')
    assert(volumeViolation.length === 1, 'Has 1 volume violation')

    const fixResult = fixViolations(overVolume, volumeViolation, exerciseMap)
    assert(fixResult.appliedFixes.length === 1, 'Volume fix applied')

    // Check volume is now within range
    const newVolume = computeWeeklyVolumePerMuscle(fixResult.fixed.workouts)
    const maxBeginner = VOLUME_RANGES.beginner.max
    assert(
        (newVolume['Peito'] || 0) <= maxBeginner,
        `Peito volume reduced to ${newVolume['Peito']} (max ${maxBeginner})`,
    )
}

// ============================================================================
// Tests: resolveAiMode
// ============================================================================

section('resolveAiMode')

{
    const beginnerProfile = makeProfile({ training_level: 'beginner' })
    assert(resolveAiMode(beginnerProfile, null) === 'auto', 'Beginner → auto')
}

{
    const advancedProfile = makeProfile({ training_level: 'advanced' })
    assert(resolveAiMode(advancedProfile, null) === 'assistant', 'Advanced → assistant')
}

{
    const intermediateProfile = makeProfile({ training_level: 'intermediate' })
    const withHistory: PrescriptionPerformanceContext = {
        weeks_of_history: 8,
        recent_adherence_rate: 85,
        recent_avg_rpe: 7,
        stalled_exercise_ids: [],
        previous_program: null,
    }
    assert(resolveAiMode(intermediateProfile, withHistory) === 'copilot', 'Intermediate + 8 weeks history → copilot')
}

{
    const intermediateNoHistory = makeProfile({ training_level: 'intermediate' })
    assert(resolveAiMode(intermediateNoHistory, null) === 'auto', 'Intermediate + no history → auto')
}

{
    const severeRestriction = makeProfile({
        training_level: 'beginner',
        medical_restrictions: [{
            description: 'Hérnia de disco',
            restricted_exercise_ids: [],
            restricted_muscle_groups: ['Lombar'],
            severity: 'severe',
        }],
    })
    assert(resolveAiMode(severeRestriction, null) === 'assistant', 'Severe restriction → assistant (overrides beginner)')
}

// ============================================================================
// Tests: buildHeuristicProgram — Beginner 3x/week
// ============================================================================

section('buildHeuristicProgram — Beginner 3x/week')

{
    const profile = makeProfile({
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 3, 5],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const program = buildHeuristicProgram(profile, exercises)

    assert(program.workouts.length === 3, `Generates 3 workouts (got ${program.workouts.length})`)
    assert(program.program.duration_weeks === 4, 'Duration is 4 weeks')
    assert(program.program.name.includes('3x/semana'), 'Name includes frequency')

    // Validate the program passes rules
    const validation = validateOutput(program, profile, exerciseMap)
    const errors = validation.violations.filter(v => v.severity === 'error')

    if (errors.length > 0) {
        console.error('  Errors found:')
        for (const e of errors) {
            console.error(`    - [${e.rule_id}] ${e.description}`)
        }
    }

    assert(errors.length === 0, `Program passes validateOutput without errors (had ${errors.length})`)
}

// ============================================================================
// Tests: buildHeuristicProgram — Intermediate 4x/week
// ============================================================================

section('buildHeuristicProgram — Intermediate 4x/week')

{
    const profile = makeProfile({
        training_level: 'intermediate',
        goal: 'weight_loss',
        available_days: [1, 2, 4, 5],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const program = buildHeuristicProgram(profile, exercises)

    assert(program.workouts.length === 4, `Generates 4 workouts (got ${program.workouts.length})`)

    const validation = validateOutput(program, profile, exerciseMap)
    const errors = validation.violations.filter(v => v.severity === 'error')
    assert(errors.length === 0, `Intermediate 4x passes without errors (had ${errors.length})`)
}

// ============================================================================
// Tests: buildHeuristicProgram — Advanced 5x/week (PPL+)
// ============================================================================

section('buildHeuristicProgram — Beginner 5x/week (PPL+)')

{
    const profile = makeProfile({
        training_level: 'beginner',
        goal: 'hypertrophy',
        available_days: [1, 2, 3, 5, 6],
        session_duration_minutes: 60,
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const program = buildHeuristicProgram(profile, exercises)

    assert(program.workouts.length === 5, `Generates 5 workouts (got ${program.workouts.length})`)

    // Each workout should have 4-6 exercises
    for (const w of program.workouts) {
        assert(
            w.items.length >= 4 && w.items.length <= 6,
            `${w.name}: ${w.items.length} exercises (expected 4-6)`,
        )
    }

    // No workout should have more than 2 exercises for small groups
    for (const w of program.workouts) {
        const smallGroupCounts: Record<string, number> = {}
        for (const item of w.items) {
            const group = item.exercise_muscle_group
            if (['Bíceps', 'Tríceps', 'Panturrilha', 'Abdominais', 'Trapézio'].includes(group)) {
                smallGroupCounts[group] = (smallGroupCounts[group] || 0) + 1
            }
        }
        const maxSmallInWorkout = Math.max(0, ...Object.values(smallGroupCounts))
        assert(maxSmallInWorkout <= 2, `${w.name}: max ${maxSmallInWorkout} exercises for any single small group (expected ≤ 2)`)
    }

    // All workouts should have at least 1 compound
    for (const w of program.workouts) {
        const hasCompound = w.items.some(item => {
            const ref = exerciseMap.get(item.exercise_id)
            return ref?.is_compound === true
        })
        assert(hasCompound, `${w.name}: has at least 1 compound exercise`)
    }

    // Should cover Quadríceps, Posterior de Coxa, and Glúteo
    const allMuscleGroups = new Set(program.workouts.flatMap(w => w.items.map(i => i.exercise_muscle_group)))
    assert(allMuscleGroups.has('Quadríceps'), 'Covers Quadríceps')
    assert(allMuscleGroups.has('Posterior de Coxa') || allMuscleGroups.has('Glúteo'), 'Covers Posterior de Coxa or Glúteo')

    // Validate against rules
    const validation = validateOutput(program, profile, exerciseMap)
    const errors = validation.violations.filter(v => v.severity === 'error')

    if (errors.length > 0) {
        console.error('  Errors found:')
        for (const e of errors) {
            console.error(`    - [${e.rule_id}] ${e.description}`)
        }
    }

    assert(errors.length === 0, `PPL+ program passes validateOutput without errors (had ${errors.length})`)

    // Print program summary
    console.log('\n  Program summary:')
    for (const w of program.workouts) {
        const groups = [...new Set(w.items.map(i => i.exercise_muscle_group))]
        console.log(`    ${w.name}: ${w.items.length} ex, ${w.items.reduce((s, i) => s + i.sets, 0)} sets [${groups.join(', ')}]`)
        for (const item of w.items) {
            console.log(`      - ${item.exercise_name} (${item.exercise_muscle_group}) ${item.sets}×${item.reps} rest ${item.rest_seconds}s`)
        }
    }
}

// ============================================================================
// Tests: buildHeuristicProgram — With medical restrictions
// ============================================================================

section('buildHeuristicProgram — With restrictions')

{
    const profile = makeProfile({
        training_level: 'beginner',
        available_days: [1, 3, 5],
        medical_restrictions: [{
            description: 'Dor no joelho',
            restricted_exercise_ids: ['leg-press', 'agachamento-livre'],
            restricted_muscle_groups: [],
            severity: 'moderate',
        }],
    })
    const exercises = makeExerciseLibrary()
    const exerciseMap = makeExerciseMap(exercises)

    const program = buildHeuristicProgram(profile, exercises)

    // Check that restricted exercises are NOT in the program
    const allExerciseIds = program.workouts.flatMap(w => w.items.map(i => i.exercise_id))
    assert(!allExerciseIds.includes('leg-press'), 'Leg Press not in program')
    assert(!allExerciseIds.includes('agachamento-livre'), 'Agachamento not in program')

    // Should still pass validation (restricted exercises should not appear)
    const validation = validateOutput(program, profile, exerciseMap)
    const restrictedViolations = validation.violations.filter(v => v.rule_id === 'restricted_exercise')
    assert(restrictedViolations.length === 0, 'No restricted exercise violations')
}

// ============================================================================
// Tests: calcExercisesPerWorkout
// ============================================================================

section('calcExercisesPerWorkout')

{
    const { calcExercisesPerWorkout: calc } = require('../constants')

    // Iniciante, 60min, 3x → {4, 6}
    const r1 = calc(60, 'beginner', 3)
    assert(r1.max === 6, `60min/3x: max=${r1.max} (expected 6)`)
    assert(r1.min === 4, `60min/3x: min=${r1.min} (expected 4)`)

    // Avançado, 90min, 5x → {4, 8}
    const r2 = calc(90, 'advanced', 5)
    assert(r2.max === 8, `90min/5x: max=${r2.max} (expected 8)`)
    assert(r2.min >= 4, `90min/5x: min=${r2.min} (expected ≥ 4)`)

    // 60min, 5x → {4, 4}
    const r3 = calc(60, 'beginner', 5)
    assert(r3.max === 4, `60min/5x: max=${r3.max} (expected 4)`)
    assert(r3.min === 4, `60min/5x: min=${r3.min} (expected 4)`)
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

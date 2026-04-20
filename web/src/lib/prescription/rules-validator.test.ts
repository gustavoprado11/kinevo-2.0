import { describe, it, expect } from 'vitest'

import type {
    PrescriptionOutputSnapshot,
    PrescriptionExerciseRef,
    StudentPrescriptionProfile,
    GeneratedWorkoutItem,
} from '@kinevo/shared/types/prescription'

import { validatePrescriptionAgainstRules } from './rules-validator'

// ── Helpers ─────────────────────────────────────────────────────────────────

function exercise(
    id: string,
    name: string,
    groups: string[],
    is_compound: boolean,
): PrescriptionExerciseRef {
    return {
        id,
        name,
        muscle_group_names: groups,
        equipment: 'barbell',
        is_compound,
        difficulty_level: 'intermediate',
        is_primary_movement: is_compound,
        session_position: 'middle',
        movement_pattern: null,
        movement_pattern_family: null,
        fatigue_class: 'moderate',
        prescription_notes: null,
    }
}

function item(partial: Partial<GeneratedWorkoutItem> & { exercise_id: string; sets: number }): GeneratedWorkoutItem {
    return {
        item_type: 'exercise',
        exercise_id: partial.exercise_id,
        exercise_name: partial.exercise_name ?? null,
        exercise_muscle_group: partial.exercise_muscle_group ?? null,
        exercise_equipment: null,
        sets: partial.sets,
        reps: partial.reps ?? '8-12',
        rest_seconds: partial.rest_seconds ?? 90,
        notes: null,
        substitute_exercise_ids: [],
        order_index: partial.order_index ?? 0,
        exercise_function: partial.exercise_function ?? 'main',
        item_config: undefined,
    }
}

function snapshot(items: GeneratedWorkoutItem[][]): PrescriptionOutputSnapshot {
    return {
        program: { name: 'p', description: '', duration_weeks: 4 },
        workouts: items.map((its, i) => ({
            name: `Treino ${String.fromCharCode(65 + i)}`,
            order_index: i,
            scheduled_days: [i + 1],
            items: its.map((it, idx) => ({ ...it, order_index: idx })),
        })),
        reasoning: {
            structure_rationale: '',
            volume_rationale: '',
            workout_notes: [],
            attention_flags: [],
            confidence_score: 0.8,
        },
    }
}

const baseProfile: StudentPrescriptionProfile = {
    id: 'p', student_id: 's', trainer_id: 't',
    training_level: 'intermediate', goal: 'hypertrophy',
    available_days: [1, 3, 5], session_duration_minutes: 60,
    available_equipment: ['academia_completa'],
    favorite_exercise_ids: [], disliked_exercise_ids: [],
    medical_restrictions: [], ai_mode: 'auto',
    cycle_observation: null, adherence_rate: null,
    avg_session_duration_minutes: null, last_calculated_at: null,
    created_at: '', updated_at: '',
}

// ── Fixture exercises ───────────────────────────────────────────────────────

const supinoReto = exercise('sr', 'Supino Reto', ['Peito'], true)
const supinoIncl = exercise('si', 'Supino Inclinado', ['Peito'], true)
const desenvOmbro = exercise('do', 'Desenvolvimento Militar', ['Ombros'], true)
const rosca = exercise('ro', 'Rosca Direta', ['Bíceps'], false)
const triceps = exercise('tr', 'Tríceps Corda', ['Tríceps'], false)
const elevacao = exercise('el', 'Elevação Lateral', ['Ombros'], false)
const cadExt = exercise('ce', 'Cadeira Extensora', ['Quadríceps'], false)
const remadaCurvada = exercise('rc', 'Remada Curvada', ['Costas'], true)
const panturrilha = exercise('pa', 'Panturrilha em Pé', ['Panturrilha'], false)

const exerciseMap = new Map<string, PrescriptionExerciseRef>([
    [supinoReto.id, supinoReto],
    [supinoIncl.id, supinoIncl],
    [desenvOmbro.id, desenvOmbro],
    [rosca.id, rosca],
    [triceps.id, triceps],
    [elevacao.id, elevacao],
    [cadExt.id, cadExt],
    [remadaCurvada.id, remadaCurvada],
    [panturrilha.id, panturrilha],
])

// ── Tests ───────────────────────────────────────────────────────────────────

describe('rules-validator — MAX_SETS_COMPOUND_4', () => {
    it('clamps 5-set compound to 4 and records error', () => {
        const input = snapshot([[item({ exercise_id: 'sr', sets: 5 })]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].sets).toBe(4)
        const v = violations.find(x => x.rule_id === 'MAX_SETS_COMPOUND_4')
        expect(v).toBeDefined()
        expect(v!.severity).toBe('error')
    })
})

describe('rules-validator — MAX_SETS_ACCESSORY_BY_LEVEL', () => {
    it('clamps accessory at intermediate level (cap 4)', () => {
        const input = snapshot([[item({ exercise_id: 'el', sets: 5, exercise_muscle_group: 'Ombros' })]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].sets).toBe(4)
        expect(violations.some(v => v.rule_id === 'MAX_SETS_ACCESSORY_BY_LEVEL')).toBe(true)
    })

    it('clamps accessory at beginner level (cap 3)', () => {
        const input = snapshot([[item({ exercise_id: 'el', sets: 4, exercise_muscle_group: 'Ombros' })]])
        const { output } = validatePrescriptionAgainstRules(
            input, exerciseMap, { ...baseProfile, training_level: 'beginner' },
        )
        expect(output.workouts[0].items[0].sets).toBe(3)
    })
})

describe('rules-validator — MAX_SETS_SMALL_GROUP_3', () => {
    it('clamps biceps principal from 4 to 3', () => {
        const input = snapshot([[item({ exercise_id: 'ro', sets: 4, exercise_muscle_group: 'Bíceps' })]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].sets).toBe(3)
        expect(violations.some(v => v.rule_id === 'MAX_SETS_SMALL_GROUP_3')).toBe(true)
    })
})

describe('rules-validator — MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP', () => {
    it('reduces second chest 4-set to 3 in the same workout', () => {
        const input = snapshot([[
            item({ exercise_id: 'sr', sets: 4, exercise_muscle_group: 'Peito' }),
            item({ exercise_id: 'si', sets: 4, exercise_muscle_group: 'Peito' }),
        ]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].sets).toBe(4)
        expect(output.workouts[0].items[1].sets).toBe(3)
        expect(violations.some(v => v.rule_id === 'MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP')).toBe(true)
    })

    it('Push example: peito + ombro + tríceps; up to 2 with 4 sets (peito + ombro), tríceps capped at 3', () => {
        // Spec §4.3 "Push": até 2 exercícios com 4 séries (peito, ombro). Tríceps fica em 3.
        const input = snapshot([[
            item({ exercise_id: 'sr', sets: 4, exercise_muscle_group: 'Peito' }),
            item({ exercise_id: 'do', sets: 4, exercise_muscle_group: 'Ombros' }),
            item({ exercise_id: 'tr', sets: 4, exercise_muscle_group: 'Tríceps' }),
        ]])
        const { output } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].sets).toBe(4)  // peito
        expect(output.workouts[0].items[1].sets).toBe(4)  // ombro
        expect(output.workouts[0].items[2].sets).toBe(3)  // tríceps small group
    })

    it('Pull example: costas + bíceps; at most 1 with 4 sets (costas)', () => {
        const input = snapshot([[
            item({ exercise_id: 'rc', sets: 4, exercise_muscle_group: 'Costas' }),
            item({ exercise_id: 'ro', sets: 4, exercise_muscle_group: 'Bíceps' }),
        ]])
        const { output } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].sets).toBe(4)  // costas keeps 4
        expect(output.workouts[0].items[1].sets).toBe(3)  // bíceps capped at 3 (small group rule)
    })

    it('Upper + small-group combo: supino 4 + supino incl 4 + rosca 4 → 4/3/3 (layered clamps)', () => {
        // Ordem aplicada documentada: (1) small-group clamp zera rosca para 3;
        // (2) one-4-per-group clamp zera supino inclinado para 3.
        // Resultado final: supino reto 4, supino inclinado 3, rosca 3.
        const input = snapshot([[
            item({ exercise_id: 'sr', sets: 4, exercise_muscle_group: 'Peito' }),
            item({ exercise_id: 'si', sets: 4, exercise_muscle_group: 'Peito' }),
            item({ exercise_id: 'ro', sets: 4, exercise_muscle_group: 'Bíceps' }),
        ]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items.map(i => i.sets)).toEqual([4, 3, 3])
        expect(violations.some(v => v.rule_id === 'MAX_SETS_SMALL_GROUP_3')).toBe(true)
        expect(violations.some(v => v.rule_id === 'MAX_ONE_EXERCISE_WITH_4_SETS_PER_GROUP')).toBe(true)
    })

    it('Legs example: quad + posterior + glúteo + panturrilha; up to 4 with 4 sets', () => {
        // All four groups are in GROUPS_TOLERATE_4, so four distinct groups can
        // each have their own 4-set exercise.
        const quad = exercise('q1', 'Agachamento Livre', ['Quadríceps'], true)
        const post = exercise('p1', 'Stiff', ['Posterior de Coxa'], true)
        const glu = exercise('g1', 'Hip Thrust', ['Glúteo'], true)
        const localMap = new Map(exerciseMap)
        localMap.set('q1', quad); localMap.set('p1', post); localMap.set('g1', glu)
        const input = snapshot([[
            item({ exercise_id: 'q1', sets: 4, exercise_muscle_group: 'Quadríceps' }),
            item({ exercise_id: 'p1', sets: 4, exercise_muscle_group: 'Posterior de Coxa' }),
            item({ exercise_id: 'g1', sets: 4, exercise_muscle_group: 'Glúteo' }),
            item({ exercise_id: 'pa', sets: 4, exercise_muscle_group: 'Panturrilha' }),
        ]])
        const { output } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items.map(i => i.sets)).toEqual([4, 4, 4, 4])
    })
})

describe('rules-validator — ordering warnings', () => {
    it('moves compound before accessory', () => {
        const input = snapshot([[
            item({ exercise_id: 'el', sets: 4, exercise_muscle_group: 'Ombros' }),   // accessory
            item({ exercise_id: 'do', sets: 4, exercise_muscle_group: 'Ombros' }),   // compound
        ]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].exercise_id).toBe('do')
        expect(violations.some(v => v.rule_id === 'COMPOUND_BEFORE_ACCESSORY')).toBe(true)
    })

    it('reorders large group before small in the compound segment', () => {
        // Desenvolvimento (Ombros, size 80) before Supino (Peito, size 95) → should swap.
        const input = snapshot([[
            item({ exercise_id: 'do', sets: 4, exercise_muscle_group: 'Ombros' }),
            item({ exercise_id: 'sr', sets: 4, exercise_muscle_group: 'Peito' }),
        ]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].exercise_id).toBe('sr')
        expect(violations.some(v => v.rule_id === 'LARGE_GROUP_BEFORE_SMALL')).toBe(true)
    })
})

describe('rules-validator — reps/rest clamps', () => {
    it('clamps hypertrophy reps outside 6-15 back to canonical range', () => {
        const input = snapshot([[
            item({ exercise_id: 'sr', sets: 4, reps: '3-5', exercise_muscle_group: 'Peito' }),
        ]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].reps).toBe('8-12')
        expect(violations.some(v => v.rule_id === 'REPS_MATCH_GOAL')).toBe(true)
    })

    it('clamps rest outside hypertrophy bounds', () => {
        const input = snapshot([[
            item({ exercise_id: 'sr', sets: 4, rest_seconds: 200, exercise_muscle_group: 'Peito' }),
        ]])
        const { output, violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(output.workouts[0].items[0].rest_seconds).toBe(90)
        expect(violations.some(v => v.rule_id === 'REST_MATCH_GOAL')).toBe(true)
    })

    it('leaves well-formed reps untouched', () => {
        const input = snapshot([[
            item({ exercise_id: 'sr', sets: 4, reps: '8-12', rest_seconds: 90, exercise_muscle_group: 'Peito' }),
        ]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(violations.some(v => v.rule_id === 'REPS_MATCH_GOAL')).toBe(false)
        expect(violations.some(v => v.rule_id === 'REST_MATCH_GOAL')).toBe(false)
    })
})

// ============================================================================
// Fase 2.5.2 — R45_SCHEDULE_MISMATCH (coverage, not parity)
// ============================================================================
// The Alysson case (walk-through 2.5) motivated the rule: PPL+1 maps 3 workouts
// to 5 days via repetition (scheduled_days). Parity (workouts.length === days)
// would falsely flag that; coverage (union of scheduled_days == available_days)
// accepts PPL+1 and still catches real mismatches.

function scheduleSnapshot(schedules: number[][]): PrescriptionOutputSnapshot {
    return {
        program: { name: 'p', description: '', duration_weeks: 4 },
        workouts: schedules.map((days, i) => ({
            name: `Treino ${String.fromCharCode(65 + i)}`,
            order_index: i,
            scheduled_days: days,
            items: [],
        })),
        reasoning: {
            structure_rationale: '',
            volume_rationale: '',
            workout_notes: [],
            attention_flags: [],
            confidence_score: 0.8,
        },
    }
}

describe('rules-validator — R45_SCHEDULE_MISMATCH', () => {
    const profile5d: StudentPrescriptionProfile = {
        ...baseProfile,
        available_days: [1, 2, 3, 4, 5],
    }

    it('accepts PPL+1 (3 workouts mapped to 5 days via repetition)', () => {
        // Push seg+qui, Pull ter+sex, Legs qua — the Alysson case from walk-through 2.5.
        const input = scheduleSnapshot([[1, 4], [2, 5], [3]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, profile5d)
        expect(violations.some(v => v.rule_id === 'R45_SCHEDULE_MISMATCH')).toBe(false)
    })

    it('accepts U/L A/B with exact parity (4 workouts, 4 days)', () => {
        const profile4d = { ...baseProfile, available_days: [1, 2, 4, 5] }
        const input = scheduleSnapshot([[1], [2], [4], [5]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, profile4d)
        expect(violations.some(v => v.rule_id === 'R45_SCHEDULE_MISMATCH')).toBe(false)
    })

    it('flags uncovered day: aluno 5d but program only covers 3 → error + retry autofix', () => {
        const input = scheduleSnapshot([[1], [2], [3]])  // covers 1,2,3; missing 4,5
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, profile5d)
        const v = violations.find(x => x.rule_id === 'R45_SCHEDULE_MISMATCH')
        expect(v).toBeDefined()
        expect(v!.severity).toBe('error')
        expect(v!.autofix).toBe('retry')
        expect(v!.message).toMatch(/Redistribua/)
    })

    it('flags extra day: workout scheduled in day not declared → error + retry autofix', () => {
        // covered = {1,2,6}, declared = {1,2} → extra=[6], missing=[] (pure extra case).
        const profile2d = { ...baseProfile, available_days: [1, 2] }
        const input = scheduleSnapshot([[1], [2], [6]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, profile2d)
        const v = violations.find(x => x.rule_id === 'R45_SCHEDULE_MISMATCH')
        expect(v).toBeDefined()
        expect(v!.severity).toBe('error')
        expect(v!.autofix).toBe('retry')
        expect(v!.message).toMatch(/Reagende/)
    })

    it('flags simultaneous extra + missing with a combined message', () => {
        const profile3d = { ...baseProfile, available_days: [1, 2, 3] }
        const input = scheduleSnapshot([[1], [2], [6]])  // covered={1,2,6}: missing=[3], extra=[6]
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, profile3d)
        const v = violations.find(x => x.rule_id === 'R45_SCHEDULE_MISMATCH')
        expect(v).toBeDefined()
        expect(v!.message).toMatch(/descoberto.*excesso/)
    })

    it('legacy local-autofix rules keep autofix="local"', () => {
        const input = snapshot([[item({ exercise_id: 'sr', sets: 5 })]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        const v = violations.find(x => x.rule_id === 'MAX_SETS_COMPOUND_4')
        expect(v!.autofix).toBe('local')
    })
})

// ============================================================================
// Fase 2.5.2 — R_POOL_UNKNOWN_EXERCISE
// ============================================================================

describe('rules-validator — R_POOL_UNKNOWN_EXERCISE', () => {
    it('flags exercise_id not present in exerciseMap as error + retry autofix', () => {
        const input = snapshot([[
            item({ exercise_id: 'hallucinated-uuid-xyz', sets: 3, exercise_muscle_group: 'Peito' }),
        ]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        const v = violations.find(x => x.rule_id === 'R_POOL_UNKNOWN_EXERCISE')
        expect(v).toBeDefined()
        expect(v!.severity).toBe('error')
        expect(v!.autofix).toBe('retry')
        expect(v!.exercise_id).toBe('hallucinated-uuid-xyz')
        expect(v!.message).toMatch(/não existe no pool/)
    })

    it('passes clean when all exercise_ids are in the pool', () => {
        const input = snapshot([[item({ exercise_id: 'sr', sets: 3 })]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        expect(violations.some(v => v.rule_id === 'R_POOL_UNKNOWN_EXERCISE')).toBe(false)
    })

    it('reports all missing ids (not just the first)', () => {
        const input = snapshot([[
            item({ exercise_id: 'unknown-1', sets: 3, exercise_muscle_group: 'Peito' }),
            item({ exercise_id: 'sr', sets: 3 }),
            item({ exercise_id: 'unknown-2', sets: 3, exercise_muscle_group: 'Costas' }),
        ]])
        const { violations } = validatePrescriptionAgainstRules(input, exerciseMap, baseProfile)
        const missing = violations.filter(v => v.rule_id === 'R_POOL_UNKNOWN_EXERCISE')
        expect(missing).toHaveLength(2)
        expect(missing.map(v => v.exercise_id).sort()).toEqual(['unknown-1', 'unknown-2'])
    })
})

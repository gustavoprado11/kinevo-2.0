import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { enrichCompactOutput, generateStructureRationaleFromOutput } from './output-enricher'
import type { CompactGenerationOutput } from './schemas'
import type {
    PrescriptionExerciseRef,
    StudentPrescriptionProfile,
    GeneratedWorkout,
} from '@kinevo/shared/types/prescription'
import type { PrescriptionConstraints } from './constraints-engine'

// ── Helpers ────────────────────────────────────────────────────────────────

function ex(id: string, name: string): PrescriptionExerciseRef {
    return {
        id, name,
        muscle_group_names: ['Peito'],
        equipment: 'barbell',
        is_compound: true,
        difficulty_level: 'intermediate',
        is_primary_movement: true,
        session_position: 'middle',
        movement_pattern: null,
        movement_pattern_family: null,
        fatigue_class: 'moderate',
        prescription_notes: null,
    }
}

const profile: StudentPrescriptionProfile = {
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

// Full-enough constraints stub to drive generateVolumeRationale + description.
const constraintsStub: PrescriptionConstraints = {
    split_type: 'full_body',
    split_detail: [{ label: 'Full Body A', groups: ['Peito'] }],
    volume_budget: {},
    exercises_per_session: 6,
    emphasized_groups: [],
    derived_restrictions: [],
    adherence_adjustment: 'none',
    adherence_percentage: 100,
} as unknown as PrescriptionConstraints

function makeCompactWithIds(ids: Array<string | null>): CompactGenerationOutput {
    return {
        program: { name: 'p', duration_weeks: 4 },
        workouts: [{
            name: 'A',
            order_index: 0,
            scheduled_days: [1],
            items: ids.map((id) => ({
                item_type: 'exercise' as const,
                exercise_id: id ?? '',  // empty string counts as "no id" for the validator
                sets: 3,
                reps: '8-12',
                rest_seconds: 90,
                exercise_function: 'main' as const,
                substitute_exercise_ids: [],
                note_key: null,
            })),
        }],
        meta: { confidence: 0.9, flags: [] },
    }
}

describe('enrichCompactOutput — [Smart-v2][missingIds] logging', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    it('does NOT log when every exercise_id is in the pool', () => {
        const compact = makeCompactWithIds(['ex-1'])
        const map = new Map([['ex-1', ex('ex-1', 'Supino Reto')]])
        enrichCompactOutput(compact, map, constraintsStub, profile)
        const msgs = (warnSpy.mock.calls.flat() as unknown[]).map((m: unknown) => String(m))
        expect(msgs.some(m => m.includes('[Smart-v2][missingIds]'))).toBe(false)
    })

    it('logs structured warning when one id is missing from the pool', () => {
        const compact = makeCompactWithIds(['hallucinated-uuid'])
        const map = new Map<string, PrescriptionExerciseRef>()  // empty pool
        enrichCompactOutput(compact, map, constraintsStub, profile)
        const msgs = (warnSpy.mock.calls.flat() as unknown[]).map((m: unknown) => String(m))
        const hit = msgs.find(m => m.includes('[Smart-v2][missingIds]'))
        expect(hit).toBeDefined()
        expect(hit).toContain('count=1')
        expect(hit).toContain('poolSize=0')
        expect(hit).toContain('hallucinated-uuid')
    })

    it('logs all missing ids, not just the first', () => {
        const compact = makeCompactWithIds(['unknown-a', 'ex-known', 'unknown-b'])
        const map = new Map([['ex-known', ex('ex-known', 'Known')]])
        enrichCompactOutput(compact, map, constraintsStub, profile)
        const msgs = (warnSpy.mock.calls.flat() as unknown[]).map((m: unknown) => String(m))
        const hit = msgs.find(m => m.includes('[Smart-v2][missingIds]'))
        expect(hit).toBeDefined()
        expect(hit).toContain('count=2')
        expect(hit).toContain('unknown-a')
        expect(hit).toContain('unknown-b')
    })
})

// ============================================================================
// Fase 2.5.2 — structure_rationale derived from real output (Option 1b)
// ============================================================================

function wk(name: string, scheduled_days: number[]): GeneratedWorkout {
    return { name, order_index: 0, scheduled_days, items: [] }
}

describe('generateStructureRationaleFromOutput', () => {
    it('labels Push/Pull/Legs × 3 distinct days as "PPL"', () => {
        const r = generateStructureRationaleFromOutput([
            wk('Push', [1]), wk('Pull', [3]), wk('Legs', [5]),
        ])
        expect(r).toMatch(/^PPL 3x\/sem \(/)
    })

    it('labels PPL mapped to 5 days via repetition as "PPL+1"', () => {
        // The Alysson case: Push seg+qui, Pull ter+sex, Legs qua.
        const r = generateStructureRationaleFromOutput([
            wk('Push', [1, 4]), wk('Pull', [2, 5]), wk('Legs', [3]),
        ])
        expect(r).toMatch(/^PPL\+1 5x\/sem/)
        expect(r).toContain('Push seg+qui')
        expect(r).toContain('Pull ter+sex')
        expect(r).toContain('Legs qua')
    })

    it('labels PPL × 6 days as "PPLPPL"', () => {
        const r = generateStructureRationaleFromOutput([
            wk('Push A', [1]), wk('Pull A', [2]), wk('Legs A', [3]),
            wk('Push B', [4]), wk('Pull B', [5]), wk('Legs B', [6]),
        ])
        expect(r).toMatch(/^PPLPPL 6x\/sem/)
    })

    it('labels Upper A/B + Lower A/B as "Upper/Lower A/B"', () => {
        const r = generateStructureRationaleFromOutput([
            wk('Upper A', [1]), wk('Lower A', [2]),
            wk('Upper B', [4]), wk('Lower B', [5]),
        ])
        expect(r).toMatch(/^Upper\/Lower A\/B 4x\/sem/)
    })

    it('labels plain Upper + Lower as "Upper/Lower"', () => {
        const r = generateStructureRationaleFromOutput([
            wk('Upper', [1]), wk('Lower', [3]),
        ])
        expect(r).toMatch(/^Upper\/Lower 2x\/sem/)
    })

    it('labels Full Body names as "Full Body"', () => {
        const r = generateStructureRationaleFromOutput([
            wk('Full Body A', [1]), wk('Full Body B', [3]), wk('Full Body C', [5]),
        ])
        expect(r).toMatch(/^Full Body 3x\/sem/)
    })

    it('returns "Split personalizado" when names are A/B/C without pattern', () => {
        // Exactly the Fernanda walk-through case: Treino A/B/C with no
        // recognizable Push/Pull/Legs/Upper/Lower/Full Body prefix.
        const r = generateStructureRationaleFromOutput([
            wk('Treino A (Segunda)', [1]),
            wk('Treino B (Quarta)', [3]),
            wk('Treino C (Sexta)', [5]),
        ])
        expect(r).toMatch(/^Split personalizado 3x\/sem/)
    })

    it('gracefully handles empty workouts', () => {
        expect(generateStructureRationaleFromOutput([])).toBe('Sem workouts gerados.')
    })
})

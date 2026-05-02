import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
    enrichCompactOutput,
    generateStructureRationaleFromOutput,
    classifyDeficit,
    classifyExcess,
    translateAttentionFlags,
} from './output-enricher'
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

// ============================================================================
// Issue 3 — magnitude classification for the volume rationale
// ============================================================================
// Replaces the old hardcoded "déficit aceitável" label that was being applied
// to every below-min case (including 56% deficits). Thresholds intentionally
// match VOLUME_DEFICIT_RETRY_THRESHOLD (0.30) in rules-validator so the text
// never says "aceitável" for cases the validator considers severe.

describe('classifyDeficit', () => {
    it('returns "déficit aceitável" for ≤15% gap', () => {
        // 8 vs. 9 = 11.1%
        expect(classifyDeficit(8, 9)).toBe('déficit aceitável')
        // 8.5 vs. 10 = 15% (boundary)
        expect(classifyDeficit(8.5, 10)).toBe('déficit aceitável')
    })

    it('returns "abaixo do alvo" for 15-30% gap', () => {
        // 7 vs. 9 = 22.2%
        expect(classifyDeficit(7, 9)).toBe('abaixo do alvo')
        // 7 vs. 10 = 30% (boundary)
        expect(classifyDeficit(7, 10)).toBe('abaixo do alvo')
    })

    it('returns "abaixo do mínimo (revisar)" for >30% gap — the regression', () => {
        // 4 vs. 9 = 56% (the exact bug)
        expect(classifyDeficit(4, 9)).toBe('abaixo do mínimo (revisar)')
        // 3 vs. 9 = 67%
        expect(classifyDeficit(3, 9)).toBe('abaixo do mínimo (revisar)')
        // 6 vs. 10 = 40%
        expect(classifyDeficit(6, 10)).toBe('abaixo do mínimo (revisar)')
    })
})

describe('classifyExcess', () => {
    it('returns "ligeiramente acima do alvo" for <15% over max', () => {
        // 13 vs. 12 = 8.3%
        expect(classifyExcess(13, 12)).toBe('ligeiramente acima do alvo')
    })

    it('returns "acima do máximo (verificar)" for ≥15% over max', () => {
        // 14 vs. 12 = 16.7%
        expect(classifyExcess(14, 12)).toBe('acima do máximo (verificar)')
        // 24 vs. 12 = 100%
        expect(classifyExcess(24, 12)).toBe('acima do máximo (verificar)')
    })
})

// ============================================================================
// Issue 1 — auto-substitution for hallucinated exercise IDs
// ============================================================================
// When the LLM emits an exercise_id not in the pool, the enricher should pick
// a compatible substitute from the same workout's intended muscle groups
// instead of falling back to "Exercício desconhecido". Tests cover:
//   - happy path: substitute found, name resolved
//   - no candidate: ID stays broken, R_POOL_UNKNOWN_EXERCISE will catch
//   - sibling deduplication: substitute can't equal an already-used ID
//   - prohibited: candidates on prohibited list are skipped

function fullEx(
    id: string,
    name: string,
    groups: string[],
    is_compound: boolean,
): PrescriptionExerciseRef {
    return {
        id, name,
        muscle_group_names: groups,
        equipment: 'barbell',
        is_compound,
        difficulty_level: 'intermediate',
        is_primary_movement: is_compound,
        session_position: is_compound ? 'first' : 'middle',
        movement_pattern: null,
        movement_pattern_family: null,
        fatigue_class: 'moderate',
        prescription_notes: null,
    }
}

function constraintsForUpperA(): PrescriptionConstraints {
    return {
        split_type: 'upper_lower_ab',
        split_detail: [
            { workout_name: 'Upper A', workout_focus: 'Upper', muscle_groups: ['Peito', 'Costas', 'Ombros'], scheduled_day: 1 },
            { workout_name: 'Lower A', workout_focus: 'Lower', muscle_groups: ['Quadríceps', 'Glúteo'], scheduled_day: 2 },
        ],
        volume_budget: {},
        exercises_per_session: 6,
        prohibited_exercise_ids: [],
    } as unknown as PrescriptionConstraints
}

function buildHallucinatedCompact(workoutName: string, items: Array<{
    exercise_id: string
    exercise_function?: 'main' | 'accessory'
    note_key?: string | null
}>): CompactGenerationOutput {
    return {
        program: { name: 'p', duration_weeks: 4 },
        workouts: [{
            name: workoutName,
            order_index: 0,
            scheduled_days: [1],
            items: items.map(it => ({
                item_type: 'exercise' as const,
                exercise_id: it.exercise_id,
                sets: 3,
                reps: '8-12',
                rest_seconds: 90,
                exercise_function: (it.exercise_function ?? 'main') as 'main' | 'accessory',
                substitute_exercise_ids: [],
                note_key: (it.note_key ?? null) as never,
            })),
        }],
        meta: { confidence: 0.9, flags: [] },
    } as CompactGenerationOutput
}

describe('enrichCompactOutput — auto-substitution (Issue 1)', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    it('substitutes a hallucinated chest main with a compound chest exercise from the pool', () => {
        // The Upper A regression: LLM emitted an unknown UUID where a chest
        // anchor was expected. Pool has Supino Reto (compound, Peito) — should
        // be picked silently.
        const compact = buildHallucinatedCompact('Upper A', [
            { exercise_id: 'hallucinated-chest', exercise_function: 'main' },
        ])
        const map = new Map([
            ['supino-reto', fullEx('supino-reto', 'Supino Reto com Barra', ['Peito'], true)],
            ['cadeira-ext', fullEx('cadeira-ext', 'Cadeira Extensora', ['Quadríceps'], false)],
        ])
        const out = enrichCompactOutput(compact, map, constraintsForUpperA(), profile)

        expect(out.workouts[0].items[0].exercise_name).toBe('Supino Reto com Barra')
        expect(out.workouts[0].items[0].exercise_id).toBe('supino-reto')
        // [Smart-v2][autoSubst] log was emitted, [missingIds] was NOT.
        const msgs = (warnSpy.mock.calls.flat() as unknown[]).map(String)
        expect(msgs.some(m => m.includes('[Smart-v2][autoSubst]'))).toBe(true)
        expect(msgs.some(m => m.includes('[Smart-v2][missingIds]'))).toBe(false)
    })

    it('does NOT pick an exercise that\'s already used in the same workout', () => {
        // Sibling already uses Supino Reto; the substitute must be different.
        const compact = buildHallucinatedCompact('Upper A', [
            { exercise_id: 'supino-reto', exercise_function: 'main' },         // resolves
            { exercise_id: 'hallucinated-2', exercise_function: 'accessory' },  // hallucinated
        ])
        const map = new Map([
            ['supino-reto', fullEx('supino-reto', 'Supino Reto', ['Peito'], true)],
            ['supino-incl', fullEx('supino-incl', 'Supino Inclinado', ['Peito'], true)],
        ])
        const out = enrichCompactOutput(compact, map, constraintsForUpperA(), profile)
        expect(out.workouts[0].items[0].exercise_id).toBe('supino-reto')
        expect(out.workouts[0].items[1].exercise_id).toBe('supino-incl')
    })

    it('falls back to "Exercício desconhecido" when no compatible candidate exists', () => {
        // Pool has only a quadriceps exercise; Upper A wants Peito/Costas/Ombros.
        const compact = buildHallucinatedCompact('Upper A', [
            { exercise_id: 'hallucinated', exercise_function: 'main' },
        ])
        const map = new Map([
            ['cadeira-ext', fullEx('cadeira-ext', 'Cadeira Extensora', ['Quadríceps'], false)],
        ])
        const out = enrichCompactOutput(compact, map, constraintsForUpperA(), profile)
        expect(out.workouts[0].items[0].exercise_name).toBe('Exercício desconhecido')
        // [missingIds] log is emitted because the substitution couldn't recover.
        const msgs = (warnSpy.mock.calls.flat() as unknown[]).map(String)
        expect(msgs.some(m => m.includes('[Smart-v2][missingIds]'))).toBe(true)
    })

    it('skips candidates on the prohibited list', () => {
        // Supino Reto is prohibited; Supino Inclinado must be picked instead.
        const compact = buildHallucinatedCompact('Upper A', [
            { exercise_id: 'hallucinated', exercise_function: 'main' },
        ])
        const map = new Map([
            ['supino-reto', fullEx('supino-reto', 'Supino Reto', ['Peito'], true)],
            ['supino-incl', fullEx('supino-incl', 'Supino Inclinado', ['Peito'], true)],
        ])
        const constraints = constraintsForUpperA()
        ;(constraints as unknown as { prohibited_exercise_ids: string[] })
            .prohibited_exercise_ids = ['supino-reto']

        const out = enrichCompactOutput(compact, map, constraints, profile)
        expect(out.workouts[0].items[0].exercise_id).toBe('supino-incl')
    })

    it('prefers compound exercises when filling a "main" slot', () => {
        // Two chest options: one isolation (Crucifixo) and one compound (Supino).
        // The compound should win when desiredFunction is "main".
        const compact = buildHallucinatedCompact('Upper A', [
            { exercise_id: 'hallucinated', exercise_function: 'main' },
        ])
        const map = new Map([
            ['crucifixo', fullEx('crucifixo', 'Crucifixo', ['Peito'], false)],
            ['supino-reto', fullEx('supino-reto', 'Supino Reto', ['Peito'], true)],
        ])
        const out = enrichCompactOutput(compact, map, constraintsForUpperA(), profile)
        expect(out.workouts[0].items[0].exercise_name).toBe('Supino Reto')
    })
})

// ============================================================================
// Issue 2 — strict note_key whitelist (only clinical_safe_pick is shown)
// ============================================================================

describe('enrichCompactOutput — note_key filter (Issue 2)', () => {
    function compactWithNote(noteKey: string | null): CompactGenerationOutput {
        return {
            program: { name: 'p', duration_weeks: 4 },
            workouts: [{
                name: 'Upper A',
                order_index: 0,
                scheduled_days: [1],
                items: [{
                    item_type: 'exercise' as const,
                    exercise_id: 'sr',
                    sets: 4, reps: '8-12', rest_seconds: 90,
                    exercise_function: 'main' as const,
                    substitute_exercise_ids: [],
                    note_key: noteKey as never,
                }],
            }],
            meta: { confidence: 0.9, flags: [] },
        } as CompactGenerationOutput
    }

    const map = new Map([['sr', fullEx('sr', 'Supino Reto', ['Peito'], true)]])

    it('shows the note when key is clinical_safe_pick', () => {
        const out = enrichCompactOutput(compactWithNote('clinical_safe_pick'), map, constraintsForUpperA(), profile)
        expect(out.workouts[0].items[0].notes).toBe('Escolhido por segurança considerando restrições médicas')
    })

    it.each([
        'compound_anchor',
        'replaces_stalled',
        'favorite_included',
        'movement_pattern_cover',
        'volume_filler',
        'isolation_complement',
        'unilateral_balance',
        'activation_warmup',
        'conditioning_finisher',
        'adherence_simple',
        'emphasis_priority',
    ])('hides the note when key is %s (filtered out per product decision)', (noteKey) => {
        const out = enrichCompactOutput(compactWithNote(noteKey), map, constraintsForUpperA(), profile)
        expect(out.workouts[0].items[0].notes).toBeNull()
    })

    it('hides the note when key is null', () => {
        const out = enrichCompactOutput(compactWithNote(null), map, constraintsForUpperA(), profile)
        expect(out.workouts[0].items[0].notes).toBeNull()
    })
})

// ============================================================================
// Issue 4 (UI fix) — translate attention_flags from snake_case to PT-BR
// ============================================================================
// The smart-v2 LLM emits free-form snake_case identifiers in meta.flags. The
// trainer was seeing strings like "replaced_stalled_exercises" and
// "advanced_level" rendered raw. Tests cover the three flags from the bug
// screenshot plus the echo-filter and unknown-flag-drop behaviors.

describe('translateAttentionFlags', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        warnSpy.mockRestore()
    })

    it('returns empty array for null/empty input', () => {
        expect(translateAttentionFlags(null)).toEqual([])
        expect(translateAttentionFlags(undefined)).toEqual([])
        expect(translateAttentionFlags([])).toEqual([])
    })

    it('translates the three flags from the regression screenshot', () => {
        const out = translateAttentionFlags([
            'replaced_stalled_exercises',
            'volume_adjusted_to_minimum',
            'advanced_level',  // echo — dropped
        ])
        expect(out).toHaveLength(2)
        expect(out[0]).toContain('exercícios em que o aluno estava estagnado')
        expect(out[1]).toContain('Volume de algum grupo ficou no mínimo recomendado')
    })

    it('drops level-echo flags silently (advanced_level, beginner_level, etc.)', () => {
        const out = translateAttentionFlags([
            'advanced_level',
            'intermediate_level',
            'beginner_level',
            'level_advanced',
        ])
        expect(out).toEqual([])
    })

    it('drops goal/frequency/split echo flags', () => {
        const out = translateAttentionFlags([
            'goal_hypertrophy',
            'frequency_4x',
            'four_per_week',
            'split_upper_lower',
        ])
        expect(out).toEqual([])
    })

    it('drops unknown flags and emits a [flagDropped] log for telemetry', () => {
        const out = translateAttentionFlags(['something_we_dont_know_yet'])
        expect(out).toEqual([])
        const msgs = (warnSpy.mock.calls.flat() as unknown[]).map(String)
        expect(msgs.some(m => m.includes('[Smart-v2][flagDropped]'))).toBe(true)
        expect(msgs.some(m => m.includes('something_we_dont_know_yet'))).toBe(true)
    })

    it('is case-insensitive and trims whitespace', () => {
        const out = translateAttentionFlags([
            '  REPLACED_STALLED_EXERCISES  ',
            'Volume_Adjusted_To_Minimum',
        ])
        expect(out).toHaveLength(2)
        expect(out[0]).toContain('estagnado')
        expect(out[1]).toContain('Volume de algum grupo ficou no mínimo')
    })

    it('passes already-translated text through unchanged (idempotent guard)', () => {
        // Issue 4 idempotence: snapshots persisted with raw flags get re-run
        // through the translator at the UI layer. Already-PT-BR text must
        // survive untouched — only snake_case identifiers are processed.
        const out = translateAttentionFlags([
            'A IA trocou exercícios em que o aluno estava estagnado nas últimas semanas',
            'Restrições médicas do aluno foram respeitadas — alguns exercícios foram filtrados',
        ])
        expect(out).toHaveLength(2)
        expect(out[0]).toContain('A IA trocou')
        expect(out[1]).toContain('Restrições médicas')
    })

    it('preserves order of recognized flags', () => {
        const out = translateAttentionFlags([
            'volume_above_maximum',
            'medical_restrictions_applied',
            'replaced_stalled_exercises',
        ])
        expect(out[0]).toContain('acima do volume máximo')
        expect(out[1]).toContain('Restrições médicas')
        expect(out[2]).toContain('estagnado')
    })

    it('translates volume signal flags', () => {
        const out = translateAttentionFlags([
            'volume_below_minimum',
            'volume_above_maximum',
            'volume_capped',
        ])
        expect(out).toHaveLength(3)
        expect(out[0]).toContain('abaixo do volume mínimo')
        expect(out[1]).toContain('acima do volume máximo')
        expect(out[2]).toContain('limitado pela duração')
    })
})

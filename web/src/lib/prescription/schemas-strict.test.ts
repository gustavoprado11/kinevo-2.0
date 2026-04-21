import { describe, it, expect } from 'vitest'
import {
    GENERATION_JSON_SCHEMA,
    PROMPT_VERSION,
    validateCompactGeneration,
} from './schemas'

const baseValid = {
    program: { name: 'Test', duration_weeks: 4 },
    workouts: [
        {
            name: 'A',
            order_index: 0,
            scheduled_days: [1, 4],
            items: [
                {
                    item_type: 'exercise',
                    exercise_id: 'ex-1',
                    sets: 4,
                    reps: '8-10',
                    rest_seconds: 90,
                    exercise_function: 'main',
                    substitute_exercise_ids: [],
                    note_key: null,
                    item_config: null,
                },
            ],
        },
    ],
    meta: { confidence: 0.9, flags: [] },
}

describe('schemas — strict validation', () => {
    it('exports PROMPT_VERSION', () => {
        expect(PROMPT_VERSION).toBe('v2.5.0')
    })

    it('GENERATION_JSON_SCHEMA has strict + additionalProperties:false at top level', () => {
        expect(GENERATION_JSON_SCHEMA.strict).toBe(true)
        expect(GENERATION_JSON_SCHEMA.schema.additionalProperties).toBe(false)
        expect(GENERATION_JSON_SCHEMA.schema.properties.program.additionalProperties).toBe(false)
        expect(GENERATION_JSON_SCHEMA.schema.properties.meta.additionalProperties).toBe(false)
    })

    it('accepts a well-formed payload', () => {
        const result = validateCompactGeneration(baseValid)
        expect(result).not.toBeNull()
        expect(result!.program.name).toBe('Test')
    })

    it('rejects payload with extra field on program', () => {
        const withExtra = {
            ...baseValid,
            program: { ...baseValid.program, sneaky: 'extra' },
        }
        expect(validateCompactGeneration(withExtra)).toBeNull()
    })

    // ── B1 regression: item_config schema + string JSON parse flow ─────────

    it('item_config schema type is ["string","null"] (strict-mode safe)', () => {
        // workouts -> array.items (workout) -> properties.items (array of
        // workout items) -> items (one workout item) -> properties.item_config.
        const itemProps =
            GENERATION_JSON_SCHEMA.schema.properties.workouts.items.properties.items.items.properties
        expect(itemProps.item_config.type).toEqual(['string', 'null'])
    })

    it('validateCompactGeneration parses item_config when delivered as JSON string', () => {
        const payload = {
            ...baseValid,
            workouts: [
                {
                    name: 'Warmup block',
                    order_index: 0,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'warmup',
                            exercise_id: null,
                            sets: null,
                            reps: null,
                            rest_seconds: null,
                            exercise_function: null,
                            substitute_exercise_ids: [],
                            note_key: null,
                            item_config: '{"duration_sec":300,"style":"dynamic"}',
                        },
                        {
                            item_type: 'exercise',
                            exercise_id: 'ex-1',
                            sets: 4,
                            reps: '8-10',
                            rest_seconds: 90,
                            exercise_function: 'main',
                            substitute_exercise_ids: [],
                            note_key: null,
                            item_config: null,
                        },
                    ],
                },
            ],
        }
        const result = validateCompactGeneration(payload)
        expect(result).not.toBeNull()
        const warmup = result!.workouts[0].items[0]
        expect(warmup.item_type).toBe('warmup')
        expect(warmup.item_config).toEqual({ duration_sec: 300, style: 'dynamic' })
    })

    it('validateCompactGeneration accepts legacy object item_config (backwards compat)', () => {
        const payload = {
            ...baseValid,
            workouts: [
                {
                    name: 'Legacy',
                    order_index: 0,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'warmup',
                            substitute_exercise_ids: [],
                            note_key: null,
                            item_config: { duration_sec: 60 },
                        },
                    ],
                },
            ],
        }
        const result = validateCompactGeneration(payload)
        expect(result).not.toBeNull()
        expect(result!.workouts[0].items[0].item_config).toEqual({ duration_sec: 60 })
    })

    it('validateCompactGeneration rejects invalid JSON in item_config string', () => {
        const payload = {
            ...baseValid,
            workouts: [
                {
                    name: 'Bad',
                    order_index: 0,
                    scheduled_days: [1],
                    items: [
                        {
                            item_type: 'warmup',
                            exercise_id: null,
                            sets: null,
                            reps: null,
                            rest_seconds: null,
                            exercise_function: null,
                            substitute_exercise_ids: [],
                            note_key: null,
                            item_config: '{not valid json',
                        },
                    ],
                },
            ],
        }
        expect(validateCompactGeneration(payload)).toBeNull()
    })

    it('validateCompactGeneration preserves null item_config for exercises', () => {
        const result = validateCompactGeneration(baseValid)
        expect(result).not.toBeNull()
        const exercise = result!.workouts[0].items[0]
        expect(exercise.item_type).toBe('exercise')
        expect(exercise.item_config).toBeUndefined()
    })
})

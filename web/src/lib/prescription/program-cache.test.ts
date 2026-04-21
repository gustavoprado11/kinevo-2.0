import { describe, it, expect, beforeEach } from 'vitest'
import {
    computeCacheKey,
    storeInCache,
    lookupCache,
    clearCache,
} from './program-cache'

import type { StudentPrescriptionProfile } from '@kinevo/shared/types/prescription'
import type { EnrichedStudentContextV2 } from './context-enricher-v2'
import type { CompactGenerationOutput } from './schemas'

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

function ctx(over: Partial<EnrichedStudentContextV2>): EnrichedStudentContextV2 {
    return {
        student_name: 'x',
        previous_programs: [],
        load_progression: [],
        session_patterns: {
            preferred_days: [],
            avg_session_duration_minutes: null,
            dropout_rate_by_workout: {},
            total_sessions_4w: 0,
            completed_sessions_4w: 0,
        },
        previous_exercise_ids: [],
        anamnese_summary: '',
        performance_summary: { stagnated_exercises: [], progressing_well: [], last_session_dates: [] },
        adherence: { rate_last_4_weeks: 0, bucket: 'baixa' },
        trainer_observations: [],
        active_injuries: [],
        equipment_preference: null,
        is_new_student: false,
        ...over,
    }
}

const fakeOutput: CompactGenerationOutput = {
    program: { name: 'p', duration_weeks: 4 },
    workouts: [{ name: 'A', order_index: 0, scheduled_days: [1], items: [] }],
    meta: { confidence: 0.8, flags: [] },
}

beforeEach(() => clearCache())

describe('computeCacheKey', () => {
    it('same profile without extra yields stable key', () => {
        expect(computeCacheKey(baseProfile)).toBe(computeCacheKey(baseProfile))
    })

    it('same profile + same extra context yields same key', () => {
        const a = computeCacheKey(baseProfile, ctx({ anamnese_summary: 'a' }))
        const b = computeCacheKey(baseProfile, ctx({ anamnese_summary: 'a' }))
        expect(a).toBe(b)
    })

    it('differing performance_summary produces different keys', () => {
        const a = computeCacheKey(baseProfile, ctx({
            performance_summary: {
                stagnated_exercises: [{ name: 'Supino Reto', group: 'Peito', weeks_stalled: 4 }],
                progressing_well: [],
                last_session_dates: [],
            },
        }))
        const b = computeCacheKey(baseProfile, ctx({
            performance_summary: { stagnated_exercises: [], progressing_well: [], last_session_dates: [] },
        }))
        expect(a).not.toBe(b)
    })

    it('differing adherence bucket produces different keys', () => {
        const a = computeCacheKey(baseProfile, ctx({ adherence: { rate_last_4_weeks: 95, bucket: 'excelente' } }))
        const b = computeCacheKey(baseProfile, ctx({ adherence: { rate_last_4_weeks: 60, bucket: 'regular' } }))
        expect(a).not.toBe(b)
    })

    it('differing trainer observations produces different keys', () => {
        const a = computeCacheKey(baseProfile, ctx({ trainer_observations: [{ note: 'foo', created_at: '' }] }))
        const b = computeCacheKey(baseProfile, ctx({ trainer_observations: [{ note: 'bar', created_at: '' }] }))
        expect(a).not.toBe(b)
    })
})

describe('lookupCache + storeInCache', () => {
    it('round-trips a payload for the same profile + extraContext', () => {
        const extra = ctx({ anamnese_summary: 'foo' })
        const key = storeInCache(baseProfile, fakeOutput, extra)
        const r = lookupCache(baseProfile, extra)
        expect(r.hit).toBe(true)
        expect(r.cache_key).toBe(key)
    })

    it('miss when extraContext changes', () => {
        storeInCache(baseProfile, fakeOutput, ctx({ anamnese_summary: 'foo' }))
        const r = lookupCache(baseProfile, ctx({ anamnese_summary: 'bar' }))
        expect(r.hit).toBe(false)
    })

    it('respects TTL (expired entries miss)', () => {
        storeInCache(baseProfile, fakeOutput)
        const r = lookupCache(baseProfile, null, -1)
        expect(r.hit).toBe(false)
    })
})

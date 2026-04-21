import { describe, it, expect } from 'vitest'
import {
    derivePerformanceSummary,
    deriveAdherence,
    deriveActiveInjuries,
    buildAnamneseSummary,
} from './context-enricher-v2'
import type { StudentPrescriptionProfile } from '@kinevo/shared/types/prescription'
import type { LoadProgressionEntry } from './context-enricher'

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

describe('context-enricher-v2 — derivePerformanceSummary', () => {
    it('lists exercises stalled for ≥3 weeks', () => {
        const progression: LoadProgressionEntry[] = [
            { exercise_id: 'a', exercise_name: 'Supino Reto', trend: 'stalled', weeks_at_current: 4, last_weight: 60 },
            { exercise_id: 'b', exercise_name: 'Agachamento', trend: 'progressing', weeks_at_current: 1, last_weight: 100 },
            { exercise_id: 'c', exercise_name: 'Rosca', trend: 'stalled', weeks_at_current: 2, last_weight: 10 },
        ]
        const summary = derivePerformanceSummary(progression, [])
        expect(summary.stagnated_exercises).toHaveLength(1)
        expect(summary.stagnated_exercises[0].name).toBe('Supino Reto')
        expect(summary.stagnated_exercises[0].weeks_stalled).toBe(4)
        expect(summary.progressing_well).toEqual([{ name: 'Agachamento' }])
    })
})

describe('context-enricher-v2 — deriveAdherence', () => {
    it('buckets ≥90% as excelente', () => {
        expect(deriveAdherence(10, 10).bucket).toBe('excelente')
        expect(deriveAdherence(10, 9).bucket).toBe('excelente')
    })
    it('buckets 70-89% as boa', () => {
        expect(deriveAdherence(10, 8).bucket).toBe('boa')
        expect(deriveAdherence(10, 7).bucket).toBe('boa')
    })
    it('buckets 50-69% as regular', () => {
        expect(deriveAdherence(10, 5).bucket).toBe('regular')
    })
    it('buckets <50% as baixa', () => {
        expect(deriveAdherence(10, 4).bucket).toBe('baixa')
    })
    it('defaults to baixa when zero sessions scheduled', () => {
        expect(deriveAdherence(0, 0).bucket).toBe('baixa')
        expect(deriveAdherence(0, 0).rate_last_4_weeks).toBe(0)
    })
})

describe('context-enricher-v2 — deriveActiveInjuries', () => {
    it('maps medical restrictions to injury labels', () => {
        const injuries = deriveActiveInjuries([
            { type: 'joint', description: 'Tendinite no ombro direito' } as any,
        ])
        expect(injuries).toHaveLength(1)
        expect(injuries[0].label).toContain('Tendinite')
    })
    it('returns empty when no restrictions', () => {
        expect(deriveActiveInjuries([])).toEqual([])
        expect(deriveActiveInjuries(null)).toEqual([])
    })
})

describe('context-enricher-v2 — buildAnamneseSummary', () => {
    it('includes level, goal, days and duration', () => {
        const s = buildAnamneseSummary(baseProfile, null)
        expect(s).toContain('intermediate')
        expect(s).toContain('hypertrophy')
        expect(s).toContain('3 dias/semana')
        expect(s).toContain('60 min')
    })
})

import { describe, it, expect } from 'vitest'

import { applyVolumeOverrides, getSkippedIsolationGroups, previewVolumeBudget } from './constraints-engine'
import { PRIMARY_MUSCLE_GROUPS } from './constants'

// ============================================================================
// previewVolumeBudget — Phase 2 read-only preview
// ============================================================================
// Same pipeline as buildConstraints' volume section, called purely from form
// inputs (no agent answers, no DB context). The component VolumePreviewCard
// shows this to the trainer in real time.

describe('previewVolumeBudget', () => {
    it('returns {} when no days are selected', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [],
            session_duration_minutes: 60,
        })
        expect(out).toEqual({})
    })

    it('produces a budget for every primary group at intermediate × 4 days × 60min', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
        })
        for (const group of PRIMARY_MUSCLE_GROUPS) {
            expect(out[group]).toBeDefined()
            expect(out[group].min).toBeGreaterThan(0)
            expect(out[group].max).toBeGreaterThanOrEqual(out[group].min)
        }
    })

    it('beginner produces lower volume than advanced for the same frequency', () => {
        const beginner = previewVolumeBudget({
            training_level: 'beginner',
            available_days: [1, 3, 5],
            session_duration_minutes: 60,
        })
        const advanced = previewVolumeBudget({
            training_level: 'advanced',
            available_days: [1, 3, 5],
            session_duration_minutes: 60,
        })
        // For at least one primary group, advanced has higher max — the level
        // bands in VOLUME_RANGES guarantee monotonic growth across levels.
        const someAdvancedHigher = PRIMARY_MUSCLE_GROUPS.some(
            g => advanced[g] && beginner[g] && advanced[g].max > beginner[g].max,
        )
        expect(someAdvancedHigher).toBe(true)
    })

    it('shorter sessions produce a smaller per-group budget than longer sessions', () => {
        // 30min × 4 days = ~12 exercises/week; 90min × 4 days = ~36 exercises/week.
        // The cap function scales the budget down when total min > 130% of capacity.
        const short = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 30,
        })
        const long = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 90,
        })
        const shortTotal = Object.values(short).reduce((s, r) => s + r.min, 0)
        const longTotal = Object.values(long).reduce((s, r) => s + r.min, 0)
        expect(shortTotal).toBeLessThan(longTotal)
    })

    it('higher frequency keeps primary groups in budget without dropping coverage', () => {
        // The screenshot regression: 4-day Upper/Lower must include all primary
        // groups (Peito, Costas, Ombros, Quadríceps, Posterior de Coxa, Glúteo).
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
        })
        for (const group of PRIMARY_MUSCLE_GROUPS) {
            expect(out[group]).toBeDefined()
            // Primary groups should have min >= 6 after the cap (PRIMARY_FLOOR
            // in capVolumeBudget), so the AI is never asked to ship a primary
            // group with effectively no volume.
            expect(out[group].min).toBeGreaterThanOrEqual(6)
        }
    })

    it('low frequency (2 days) deprioritizes some small groups', () => {
        // applyFrequencyPriority drops or minimizes small groups when there
        // aren't enough sessions to cover them. The exact list comes from
        // FREQUENCY_CUTS in constants — we just verify the mechanism fires.
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 4],
            session_duration_minutes: 60,
        })
        // Every primary group must still be present.
        for (const group of PRIMARY_MUSCLE_GROUPS) {
            expect(out[group]).toBeDefined()
        }
        // At least one small group should be missing or zeroed.
        const smallGroupsAffected = ['Trapézio', 'Antebraço', 'Adutores'].some(
            g => !out[g] || out[g].max === 0,
        )
        expect(smallGroupsAffected).toBe(true)
    })

    // ─── Phase 3 — trainer overrides ──────────────────────────────────────

    it('applies a trainer override to a primary group', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
            volume_overrides: { 'Peito': 16 },
        })
        expect(out['Peito']).toEqual({ min: 16, max: 16 })
        // Other groups stay on their natural budget.
        expect(out['Costas'].min).not.toBe(16)
    })

    it('override wins over frequency-priority deprioritization', () => {
        // At 2x/week, Trapézio is normally minimized/dropped. An override
        // of 6 should re-introduce it explicitly.
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 4],
            session_duration_minutes: 60,
            volume_overrides: { 'Trapézio': 6 },
        })
        expect(out['Trapézio']).toEqual({ min: 6, max: 6 })
    })

    it('override wins over the session-capacity cap', () => {
        // Session capacity at 30min/2d would normally cap chest below 12.
        // Override at 16 must survive — trainer is taking responsibility.
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 4],
            session_duration_minutes: 30,
            volume_overrides: { 'Peito': 16 },
        })
        expect(out['Peito']).toEqual({ min: 16, max: 16 })
    })

    it('multiple overrides apply independently', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
            volume_overrides: { 'Peito': 18, 'Glúteo': 14, 'Bíceps': 8 },
        })
        expect(out['Peito']).toEqual({ min: 18, max: 18 })
        expect(out['Glúteo']).toEqual({ min: 14, max: 14 })
        expect(out['Bíceps']).toEqual({ min: 8, max: 8 })
    })

    it('empty or missing overrides leaves the natural budget untouched', () => {
        const baseline = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
        })
        const withEmpty = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
            volume_overrides: {},
        })
        expect(withEmpty).toEqual(baseline)
    })
})

describe('applyVolumeOverrides', () => {
    it('returns the budget unchanged when overrides are nullish', () => {
        const budget = { 'Peito': { min: 12, max: 18 } }
        expect(applyVolumeOverrides(budget, null)).toEqual(budget)
        expect(applyVolumeOverrides(budget, undefined)).toEqual(budget)
    })

    it('returns the budget unchanged when overrides is an empty object', () => {
        const budget = { 'Peito': { min: 12, max: 18 } }
        expect(applyVolumeOverrides(budget, {})).toEqual(budget)
    })

    it('treats override value of 0 as the skip signal (Phase 3.5)', () => {
        // 0 is now meaningful: trainer is asking to skip isolation work for
        // this group. Pipeline propagates this to the prompt and validator.
        const budget = { 'Peito': { min: 12, max: 18 } }
        const out = applyVolumeOverrides(budget, { 'Peito': 0 })
        expect(out['Peito']).toEqual({ min: 0, max: 0 })
    })

    it('drops non-finite override values silently', () => {
        const budget = { 'Peito': { min: 12, max: 18 } }
        const out = applyVolumeOverrides(budget, { 'Peito': Number.NaN })
        // Original budget preserved when the override is invalid.
        expect(out['Peito']).toEqual({ min: 12, max: 18 })
    })

    it('rounds fractional overrides to the nearest integer', () => {
        const budget = { 'Peito': { min: 12, max: 18 } }
        const out = applyVolumeOverrides(budget, { 'Peito': 14.6 })
        expect(out['Peito']).toEqual({ min: 15, max: 15 })
    })

    it('adds groups that were not in the budget when overridden', () => {
        // Trainer overrides a small group that frequency-priority had
        // dropped earlier; applyVolumeOverrides should re-introduce it.
        const budget = { 'Peito': { min: 12, max: 18 } }
        const out = applyVolumeOverrides(budget, { 'Antebraço': 4 })
        expect(out['Antebraço']).toEqual({ min: 4, max: 4 })
        expect(out['Peito']).toEqual({ min: 12, max: 18 })
    })

    // ─── Phase 3.5 — range and skip ────────────────────────────────────────

    it('accepts a {min, max} range override', () => {
        const budget = { 'Peito': { min: 12, max: 18 } }
        const out = applyVolumeOverrides(budget, {
            'Peito': { min: 14, max: 20 },
        })
        expect(out['Peito']).toEqual({ min: 14, max: 20 })
    })

    it('swaps min/max when given inverted range (max gets min as floor)', () => {
        const budget = { 'Peito': { min: 12, max: 18 } }
        // We don't fix the swap explicitly — instead we floor max at min.
        // If trainer types reverse, the UI parser already swaps; this is a
        // defensive layer.
        const out = applyVolumeOverrides(budget, {
            'Peito': { min: 18, max: 14 },
        })
        // min=18 wins, max becomes max(min, 14) = 18 → exact target
        expect(out['Peito']).toEqual({ min: 18, max: 18 })
    })

    it('preserves the {0, 0} skip signal through the pipeline', () => {
        const budget = { 'Bíceps': { min: 8, max: 12 } }
        const out = applyVolumeOverrides(budget, {
            'Bíceps': { min: 0, max: 0 },
        })
        expect(out['Bíceps']).toEqual({ min: 0, max: 0 })
    })

    it('legacy plain-number overrides still work alongside range overrides', () => {
        const budget = { 'Peito': { min: 12, max: 18 }, 'Glúteo': { min: 12, max: 18 } }
        const out = applyVolumeOverrides(budget, {
            'Peito': 16,                       // legacy single number
            'Glúteo': { min: 14, max: 20 },   // new range
        })
        expect(out['Peito']).toEqual({ min: 16, max: 16 })
        expect(out['Glúteo']).toEqual({ min: 14, max: 20 })
    })
})

describe('previewVolumeBudget — range + skip (Phase 3.5)', () => {
    it('a range override survives the cap step', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
            volume_overrides: { 'Peito': { min: 14, max: 20 } },
        })
        expect(out['Peito']).toEqual({ min: 14, max: 20 })
    })

    it('a {0, 0} skip override is preserved as-is', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
            volume_overrides: { 'Bíceps': { min: 0, max: 0 } },
        })
        expect(out['Bíceps']).toEqual({ min: 0, max: 0 })
    })

    it('mixing range, single, and skip overrides works in one call', () => {
        const out = previewVolumeBudget({
            training_level: 'intermediate',
            available_days: [1, 2, 4, 5],
            session_duration_minutes: 60,
            volume_overrides: {
                'Peito': { min: 14, max: 20 },
                'Glúteo': 16,                          // legacy single
                'Bíceps': { min: 0, max: 0 },          // skip
            },
        })
        expect(out['Peito']).toEqual({ min: 14, max: 20 })
        expect(out['Glúteo']).toEqual({ min: 16, max: 16 })
        expect(out['Bíceps']).toEqual({ min: 0, max: 0 })
    })
})

describe('getSkippedIsolationGroups', () => {
    it('returns empty when no overrides are passed', () => {
        expect(getSkippedIsolationGroups(null)).toEqual([])
        expect(getSkippedIsolationGroups(undefined)).toEqual([])
        expect(getSkippedIsolationGroups({})).toEqual([])
    })

    it('returns groups whose override resolves to {0, 0}', () => {
        const out = getSkippedIsolationGroups({
            'Peito': { min: 14, max: 20 },         // not skipped
            'Bíceps': { min: 0, max: 0 },          // skipped
            'Tríceps': 0,                          // legacy form, also skipped
            'Trapézio': { min: 0, max: 0 },        // skipped
        })
        expect(out.sort()).toEqual(['Bíceps', 'Trapézio', 'Tríceps'])
    })

    it('does not consider {min: 0, max: 6} (asymmetric) as skipped', () => {
        // Only the fully-zero shape counts as skip. {0, 6} is "0 to 6 séries"
        // — different semantics.
        const out = getSkippedIsolationGroups({
            'Bíceps': { min: 0, max: 6 },
        })
        expect(out).toEqual([])
    })
})

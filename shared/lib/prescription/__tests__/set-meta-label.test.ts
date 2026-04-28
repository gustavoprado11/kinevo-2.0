import { describe, it, expect } from 'vitest'
import { buildSetMetaLabel } from '@kinevo/shared/lib/prescription/set-meta-label'

describe('buildSetMetaLabel', () => {
    it('returns just "Meta: 10 reps" when only reps are prescribed', () => {
        expect(buildSetMetaLabel({ reps: '10' })).toBe('Meta: 10 reps')
    })

    it('appends "· RIR N" when RIR is prescribed', () => {
        expect(buildSetMetaLabel({ reps: '10', rir: 2 })).toBe('Meta: 10 reps · RIR 2')
    })

    it('appends "· Cadência X" when tempo is prescribed', () => {
        // Internal field is still `tempo` (DB / type compat); user-facing
        // label was renamed to "Cadência" in Fase 4.5h.
        expect(buildSetMetaLabel({ reps: '10', tempo: '3-1-1-0' }))
            .toBe('Meta: 10 reps · Cadência 3-1-1-0')
    })

    it('joins reps + RIR + Cadência in order with " · "', () => {
        expect(buildSetMetaLabel({ reps: '10', rir: 2, tempo: '3-1-1-0' }))
            .toBe('Meta: 10 reps · RIR 2 · Cadência 3-1-1-0')
    })

    it('treats RIR=0 as a valid prescription (= "to failure")', () => {
        // The trainer setting RIR=0 explicitly means "go to failure" — it
        // must not be hidden as a falsy-default ambiguity.
        expect(buildSetMetaLabel({ reps: '10', rir: 0 })).toBe('Meta: 10 reps · RIR 0')
    })

    it('hides RIR when null or undefined', () => {
        expect(buildSetMetaLabel({ reps: '10', rir: null })).toBe('Meta: 10 reps')
        expect(buildSetMetaLabel({ reps: '10' })).toBe('Meta: 10 reps')
    })

    it('hides Cadência when null, undefined, or empty/whitespace string', () => {
        expect(buildSetMetaLabel({ reps: '10', tempo: null })).toBe('Meta: 10 reps')
        expect(buildSetMetaLabel({ reps: '10' })).toBe('Meta: 10 reps')
        expect(buildSetMetaLabel({ reps: '10', tempo: '' })).toBe('Meta: 10 reps')
        expect(buildSetMetaLabel({ reps: '10', tempo: '   ' })).toBe('Meta: 10 reps')
    })

    it('formats AMRAP as "Meta: até a falha"', () => {
        expect(buildSetMetaLabel({ reps: 'AMRAP' })).toBe('Meta: até a falha')
        expect(buildSetMetaLabel({ reps: 'amrap' })).toBe('Meta: até a falha')
        expect(buildSetMetaLabel({ reps: 'falha' })).toBe('Meta: até a falha')
    })

    it('combines AMRAP with Cadência when both are prescribed', () => {
        expect(buildSetMetaLabel({ reps: 'AMRAP', tempo: '3-0-1-0' }))
            .toBe('Meta: até a falha · Cadência 3-0-1-0')
    })

    it('formats cluster reps as "Meta: 5+5+5 · cluster"', () => {
        expect(buildSetMetaLabel({ reps: '5+5+5' })).toBe('Meta: 5+5+5 · cluster')
        expect(buildSetMetaLabel({ reps: '8+4+2' })).toBe('Meta: 8+4+2 · cluster')
    })

    it('combines cluster with RIR', () => {
        expect(buildSetMetaLabel({ reps: '5+5+5', rir: 1 }))
            .toBe('Meta: 5+5+5 · cluster · RIR 1')
    })

    it('returns empty string when nothing is prescribed', () => {
        // Caller is expected to hide the meta line entirely in that case.
        expect(buildSetMetaLabel({})).toBe('')
        expect(buildSetMetaLabel({ reps: '' })).toBe('')
        expect(buildSetMetaLabel({ reps: null, rir: null, tempo: null })).toBe('')
    })

    it('handles RIR-only / Cadência-only edge cases (no reps prescribed)', () => {
        // Unusual but possible: trainer prescribed RIR or tempo without reps.
        // We render what we have without "Meta:" prefix becoming dangling.
        expect(buildSetMetaLabel({ rir: 2 })).toBe('RIR 2')
        expect(buildSetMetaLabel({ tempo: '3-1-1-0' })).toBe('Cadência 3-1-1-0')
    })
})

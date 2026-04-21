import { describe, it, expect, beforeEach } from 'vitest'
import {
    setPrescriptionAnimateFlag,
    consumePrescriptionAnimateFlag,
} from '../prescription-animate-flag'

describe('prescription-animate-flag', () => {
    beforeEach(() => {
        window.sessionStorage.clear()
    })

    it('returns false when no flag is set', () => {
        expect(consumePrescriptionAnimateFlag('gen-1')).toBe(false)
    })

    it('set → consume returns true once, then false (flag is removed)', () => {
        setPrescriptionAnimateFlag('gen-1')
        expect(consumePrescriptionAnimateFlag('gen-1')).toBe(true)
        // Second call finds the flag already consumed — critical so a refresh
        // doesn't animate the same generation again.
        expect(consumePrescriptionAnimateFlag('gen-1')).toBe(false)
    })

    it('flags are per-generationId', () => {
        setPrescriptionAnimateFlag('gen-A')
        expect(consumePrescriptionAnimateFlag('gen-B')).toBe(false)
        expect(consumePrescriptionAnimateFlag('gen-A')).toBe(true)
    })
})

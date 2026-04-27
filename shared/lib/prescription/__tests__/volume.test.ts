import { describe, it, expect } from 'vitest'
import { effectiveSetsForVolume } from '@kinevo/shared/lib/prescription/volume'

describe('effectiveSetsForVolume', () => {
    it('linear methods: returns sets directly when rounds is 1 or absent', () => {
        // Pirâmide ↓ 4 séries
        expect(effectiveSetsForVolume({ sets: 4, rounds: 1 })).toBe(4)
        // 5×5
        expect(effectiveSetsForVolume({ sets: 5, rounds: 1 })).toBe(5)
        // top + backoff
        expect(effectiveSetsForVolume({ sets: 4, rounds: 1 })).toBe(4)
    })

    it('compound methods: each round counts as ONE effective set', () => {
        // Drop-set 3 rondas × 3 fases (sets=9 materializado, rounds=3) → 3
        expect(effectiveSetsForVolume({ sets: 9, rounds: 3 })).toBe(3)
        // Cluster 3 rondas × 3 fases → 3
        expect(effectiveSetsForVolume({ sets: 9, rounds: 3 })).toBe(3)
        // Drop-set 5 rondas × 3 fases → 5
        expect(effectiveSetsForVolume({ sets: 15, rounds: 5 })).toBe(5)
    })

    it('legacy programs without rounds (null/undefined) fall back to sets', () => {
        // Pre-Fase-4.3 program — never gained `rounds`
        expect(effectiveSetsForVolume({ sets: 3, rounds: null })).toBe(3)
        expect(effectiveSetsForVolume({ sets: 3 })).toBe(3)
    })

    it('returns 0 defensively when sets is null and method is not compound', () => {
        expect(effectiveSetsForVolume({ sets: null, rounds: 1 })).toBe(0)
        expect(effectiveSetsForVolume({ sets: null })).toBe(0)
        // rounds=null AND sets=null → 0
        expect(effectiveSetsForVolume({ sets: null, rounds: null })).toBe(0)
    })

    it('compound with rounds=1 collapses to linear path', () => {
        // Edge: trainer typed rounds=1 manually on a method tagged as compound.
        // We treat as linear (no over-counting kick-in unless rounds > 1).
        expect(effectiveSetsForVolume({ sets: 10, rounds: 1 })).toBe(10)
    })
})

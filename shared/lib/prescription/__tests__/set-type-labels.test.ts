import { describe, it, expect } from 'vitest'
import {
    SET_TYPE_LABELS,
    SET_TYPE_BADGE_LABELS,
} from '@kinevo/shared/lib/prescription/set-type-labels'
import { SET_TYPE_OPTIONS } from '@kinevo/shared/types/prescription'

describe('SET_TYPE_LABELS / SET_TYPE_BADGE_LABELS', () => {
    it('full labels cover every SetType union member', () => {
        for (const type of SET_TYPE_OPTIONS) {
            expect(SET_TYPE_LABELS[type]).toBeDefined()
            expect(SET_TYPE_LABELS[type].length).toBeGreaterThan(0)
        }
        expect(Object.keys(SET_TYPE_LABELS)).toHaveLength(SET_TYPE_OPTIONS.length)
    })

    it('badge labels cover every SetType (empty string for normal hides the chip)', () => {
        for (const type of SET_TYPE_OPTIONS) {
            expect(SET_TYPE_BADGE_LABELS[type]).toBeDefined()
        }
        // Sentence-case pt-BR labels (519ee80): badges legíveis pro aluno em
        // vez das siglas em caixa-alta. AMRAP permanece sigla (uso consagrado).
        expect(SET_TYPE_BADGE_LABELS.normal).toBe('')
        expect(SET_TYPE_BADGE_LABELS.warmup).toBe('Aquecimento')
        expect(SET_TYPE_BADGE_LABELS.top).toBe('Top')
        expect(SET_TYPE_BADGE_LABELS.backoff).toBe('Backoff')
        expect(SET_TYPE_BADGE_LABELS.drop).toBe('Drop')
        expect(SET_TYPE_BADGE_LABELS.failure).toBe('Falha')
        expect(SET_TYPE_BADGE_LABELS.amrap).toBe('AMRAP')
        expect(SET_TYPE_BADGE_LABELS.cluster).toBe('Cluster')
    })
})

import { describe, it, expect } from 'vitest'
import {
    METHOD_KEY_LABELS,
    getMethodChipLabel,
} from '@kinevo/shared/lib/prescription/method-labels'
import { METHOD_KEY_OPTIONS } from '@kinevo/shared/types/prescription'

describe('METHOD_KEY_LABELS', () => {
    it('covers every MethodKey union member exactly once', () => {
        for (const key of METHOD_KEY_OPTIONS) {
            expect(METHOD_KEY_LABELS[key]).toBeDefined()
        }
        expect(Object.keys(METHOD_KEY_LABELS)).toHaveLength(METHOD_KEY_OPTIONS.length)
    })

    it('hides the chip for null, undefined and "standard"', () => {
        expect(getMethodChipLabel(null)).toBeNull()
        expect(getMethodChipLabel(undefined)).toBeNull()
        expect(getMethodChipLabel('standard')).toBeNull()
    })

    it('returns translated labels for presets and custom', () => {
        expect(getMethodChipLabel('pyramid_down')).toBe('Pirâmide ↓')
        expect(getMethodChipLabel('pyramid_up')).toBe('Pirâmide ↑')
        expect(getMethodChipLabel('drop_set')).toBe('Drop-set')
        expect(getMethodChipLabel('5x5')).toBe('5×5')
        expect(getMethodChipLabel('cluster')).toBe('Cluster')
        expect(getMethodChipLabel('top_backoff')).toBe('Top + backoff')
        expect(getMethodChipLabel('custom')).toBe('Customizado')
    })
})

import { describe, expect, it } from 'vitest'

import type { MethodKey } from '@kinevo/shared/types/prescription'
import { SET_TYPE_OPTIONS } from '@kinevo/shared/types/prescription'
import { applyPreset } from '../set-scheme'
import { SYSTEM_PRESETS } from '../set-scheme-presets'

const PRESET_KEYS = Object.keys(SYSTEM_PRESETS) as Array<Exclude<MethodKey, 'standard' | 'custom'>>

describe('SYSTEM_PRESETS', () => {
    it('seeds 6 system presets', () => {
        expect(PRESET_KEYS.sort()).toEqual(
            ['5x5', 'cluster', 'drop_set', 'pyramid_down', 'pyramid_up', 'top_backoff'].sort(),
        )
    })

    it('matches applyPreset output exactly (data/function parity)', () => {
        PRESET_KEYS.forEach((key) => {
            const fromData = SYSTEM_PRESETS[key].defaultSetsConfig
            const fromFn = applyPreset(key)
            expect(fromFn).toEqual(fromData)
        })
    })

    it('uses only valid SetType values', () => {
        PRESET_KEYS.forEach((key) => {
            SYSTEM_PRESETS[key].defaultSetsConfig.forEach((s) => {
                expect(SET_TYPE_OPTIONS).toContain(s.set_type)
            })
        })
    })

    it('keeps set_number contiguous starting at 1', () => {
        PRESET_KEYS.forEach((key) => {
            const config = SYSTEM_PRESETS[key].defaultSetsConfig
            config.forEach((s, i) => {
                expect(s.set_number).toBe(i + 1)
            })
        })
    })
})

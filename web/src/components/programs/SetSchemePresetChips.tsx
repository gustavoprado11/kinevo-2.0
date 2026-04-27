'use client'

import type { MethodKey } from '@kinevo/shared/types/prescription'
import { SYSTEM_PRESETS } from '@kinevo/shared/lib/prescription/set-scheme-presets'

interface SetSchemePresetChipsProps {
    activeKey: MethodKey | null
    onApply: (key: Exclude<MethodKey, 'standard' | 'custom'>) => void
}

const PRESET_ORDER: Array<Exclude<MethodKey, 'standard' | 'custom'>> = [
    'pyramid_down',
    'pyramid_up',
    'drop_set',
    'top_backoff',
    '5x5',
    'cluster',
]

export function SetSchemePresetChips({ activeKey, onApply }: SetSchemePresetChipsProps) {
    return (
        <div role="group" aria-label="Presets de método" className="flex flex-wrap gap-2">
            {PRESET_ORDER.map((key) => {
                const preset = SYSTEM_PRESETS[key]
                const active = activeKey === key
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onApply(key)}
                        title={preset.description}
                        aria-pressed={active}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            active
                                ? 'bg-[#007AFF] dark:bg-violet-600 text-white border-transparent'
                                : 'bg-transparent text-k-text-secondary border-[#E8E8ED] dark:border-k-border-subtle hover:border-[#007AFF]/40 dark:hover:border-violet-500/40 hover:text-[#007AFF] dark:hover:text-violet-300'
                        }`}
                    >
                        {preset.name}
                    </button>
                )
            })}
        </div>
    )
}

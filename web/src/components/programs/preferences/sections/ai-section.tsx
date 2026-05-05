'use client'

import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type { AiFocus, AiVariation } from '@/types/prescription-preferences'
import { ChipRow, type ChipOption } from '../chip-row'
import { CollapsibleSection } from '../collapsible-section'
import { usePreferenceSaver } from '../use-preference-saver'

const FOCUS_OPTIONS: ChipOption<AiFocus>[] = [
    { value: 'hypertrophy', label: 'Hipertrofia' },
    { value: 'strength', label: 'Força' },
    { value: 'conditioning', label: 'Condicionamento' },
    { value: 'mixed', label: 'Misto' },
]

const VARIATION_OPTIONS: ChipOption<AiVariation>[] = [
    { value: 'conservative', label: 'Conservadora' },
    { value: 'moderate', label: 'Moderada' },
    { value: 'varied', label: 'Variada' },
]

export function AiSection() {
    const ai = usePrescriptionPreferencesStore((s) => s.preferences.ai)
    const savePatch = usePreferenceSaver()

    return (
        <CollapsibleSection title="IA">
            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">Foco</label>
                <ChipRow
                    options={FOCUS_OPTIONS}
                    value={ai.focus}
                    onChange={(next) => savePatch({ ai: { focus: next } })}
                    ariaLabel="Foco da IA"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">Variação</label>
                <ChipRow
                    options={VARIATION_OPTIONS}
                    value={ai.variation}
                    onChange={(next) => savePatch({ ai: { variation: next } })}
                    ariaLabel="Variação da IA"
                />
            </div>
        </CollapsibleSection>
    )
}

'use client'

import { useState } from 'react'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type { NamingConvention } from '@/types/prescription-preferences'
import { ChipRow, type ChipOption } from '../chip-row'
import { CollapsibleSection } from '../collapsible-section'
import { useDraftSync } from '../use-draft-sync'
import { usePreferenceSaver } from '../use-preference-saver'

const NAMING_OPTIONS: ChipOption<NamingConvention>[] = [
    { value: 'letter', label: 'Letras A/B/C' },
    { value: 'free', label: 'Livre' },
]

export function ProgramStructureSection() {
    const programStructure = usePrescriptionPreferencesStore((s) => s.preferences.program_structure)
    const savePatch = usePreferenceSaver()

    const [weeksDraft, setWeeksDraft] = useDraftSync(String(programStructure.default_weeks))
    const [weeksError, setWeeksError] = useState<string | null>(null)
    const [countDraft, setCountDraft] = useDraftSync(String(programStructure.default_workout_count))
    const [countError, setCountError] = useState<string | null>(null)

    const validateRange = (value: string, min: number, max: number) => {
        const n = Number(value)
        return Number.isInteger(n) && n >= min && n <= max
    }

    const handleWeeksBlur = () => {
        if (!validateRange(weeksDraft, 1, 52)) {
            setWeeksError('Entre 1 e 52 semanas')
            return
        }
        setWeeksError(null)
        const n = Number(weeksDraft)
        if (n === programStructure.default_weeks) return
        savePatch({ program_structure: { default_weeks: n } })
    }

    const handleCountBlur = () => {
        if (!validateRange(countDraft, 1, 14)) {
            setCountError('Entre 1 e 14 treinos')
            return
        }
        setCountError(null)
        const n = Number(countDraft)
        if (n === programStructure.default_workout_count) return
        savePatch({ program_structure: { default_workout_count: n } })
    }

    return (
        <CollapsibleSection title="Estrutura do programa">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label htmlFor="pref-weeks" className="text-xs text-k-text-tertiary">Duração padrão</label>
                    <div className="relative">
                        <input
                            id="pref-weeks"
                            type="number"
                            min={1}
                            max={52}
                            value={weeksDraft}
                            onChange={(e) => setWeeksDraft(e.target.value)}
                            onBlur={handleWeeksBlur}
                            className={`w-full px-2 py-1.5 pr-16 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${weeksError ? 'border-red-500' : 'border-k-border-subtle'}`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-k-text-tertiary pointer-events-none">semanas</span>
                    </div>
                    {weeksError && <p className="text-xs text-red-500">{weeksError}</p>}
                </div>
                <div className="space-y-1">
                    <label htmlFor="pref-workout-count" className="text-xs text-k-text-tertiary">Quantidade de treinos</label>
                    <input
                        id="pref-workout-count"
                        type="number"
                        min={1}
                        max={14}
                        value={countDraft}
                        onChange={(e) => setCountDraft(e.target.value)}
                        onBlur={handleCountBlur}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${countError ? 'border-red-500' : 'border-k-border-subtle'}`}
                    />
                    {countError && <p className="text-xs text-red-500">{countError}</p>}
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">Nomenclatura</label>
                <ChipRow
                    options={NAMING_OPTIONS}
                    value={programStructure.naming_convention}
                    onChange={(next) => savePatch({ program_structure: { naming_convention: next } })}
                    ariaLabel="Convenção de nomenclatura dos treinos"
                />
            </div>
        </CollapsibleSection>
    )
}

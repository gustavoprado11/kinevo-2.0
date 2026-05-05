'use client'

import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type { AddExerciseMode } from '@/types/prescription-preferences'
import { ChipRow, type ChipOption } from '../chip-row'
import { CollapsibleSection } from '../collapsible-section'
import { usePreferenceSaver } from '../use-preference-saver'

const MODE_OPTIONS: ChipOption<AddExerciseMode>[] = [
    { value: 'simplified', label: 'Simplificado' },
    { value: 'set_editor', label: 'Editor de séries' },
]

export function AddExerciseSection() {
    const addExercise = usePrescriptionPreferencesStore((s) => s.preferences.add_exercise)
    const savePatch = usePreferenceSaver()

    return (
        <CollapsibleSection title="Adicionar exercício">
            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">Modo padrão</label>
                <ChipRow
                    options={MODE_OPTIONS}
                    value={addExercise.open_mode}
                    onChange={(next) => savePatch({ add_exercise: { open_mode: next } })}
                    ariaLabel="Modo padrão ao adicionar exercício"
                />
            </div>

            <div className="flex items-start justify-between gap-4 pt-1">
                <div className="flex-1">
                    <label htmlFor="pref-auto-warmup" className="block text-sm text-k-text-primary cursor-pointer">
                        Adicionar aquecimento automático
                    </label>
                    <p className="text-xs text-k-text-tertiary mt-0.5">
                        Gera um item de aquecimento ao adicionar exercício.
                    </p>
                </div>
                <button
                    id="pref-auto-warmup"
                    type="button"
                    role="switch"
                    aria-checked={addExercise.auto_warmup}
                    onClick={() => savePatch({ add_exercise: { auto_warmup: !addExercise.auto_warmup } })}
                    className={`relative inline-flex shrink-0 h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        addExercise.auto_warmup ? 'bg-violet-600' : 'bg-k-border-primary'
                    }`}
                >
                    <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            addExercise.auto_warmup ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                    />
                </button>
            </div>
        </CollapsibleSection>
    )
}

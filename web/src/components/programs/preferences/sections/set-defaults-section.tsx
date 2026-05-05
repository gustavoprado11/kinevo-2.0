'use client'

import { useState } from 'react'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type { LoadMethod, VisibleField } from '@/types/prescription-preferences'
import { ChipRow, type ChipOption } from '../chip-row'
import { CollapsibleSection } from '../collapsible-section'
import { useDraftSync } from '../use-draft-sync'
import { usePreferenceSaver } from '../use-preference-saver'

const SCHEME_PATTERN = /^\d+(-\d+)?$/

const LOAD_METHOD_OPTIONS: ChipOption<LoadMethod>[] = [
    { value: 'kg', label: 'kg' },
    { value: 'percent_1rm', label: '%1RM' },
    { value: 'rir', label: 'RIR' },
    { value: 'rpe', label: 'RPE' },
]

const VISIBLE_FIELD_OPTIONS: ChipOption<VisibleField>[] = [
    { value: 'sets', label: 'Séries' },
    { value: 'reps', label: 'Reps' },
    { value: 'load', label: 'Carga' },
    { value: 'rest', label: 'Descanso' },
    { value: 'tempo', label: 'Cadência' },
    { value: 'rir', label: 'RIR' },
]

export function SetDefaultsSection() {
    const setDefaults = usePrescriptionPreferencesStore((s) => s.preferences.set_defaults)
    const savePatch = usePreferenceSaver()

    const [setsDraft, setSetsDraft] = useDraftSync(setDefaults.sets)
    const [setsError, setSetsError] = useState<string | null>(null)
    const [repsDraft, setRepsDraft] = useDraftSync(setDefaults.reps)
    const [repsError, setRepsError] = useState<string | null>(null)
    const [restCompoundDraft, setRestCompoundDraft] = useDraftSync(String(setDefaults.rest_compound_seconds))
    const [restCompoundError, setRestCompoundError] = useState<string | null>(null)
    const [restIsolationDraft, setRestIsolationDraft] = useDraftSync(String(setDefaults.rest_isolation_seconds))
    const [restIsolationError, setRestIsolationError] = useState<string | null>(null)
    const [tempoDraft, setTempoDraft] = useDraftSync(setDefaults.tempo ?? '')

    const validateScheme = (value: string) => SCHEME_PATTERN.test(value.trim())
    const validateRest = (value: string) => {
        const n = Number(value)
        return Number.isInteger(n) && n >= 0 && n <= 600
    }

    const handleSchemeBlur = (
        field: 'sets' | 'reps',
        draft: string,
        current: string,
        setError: (msg: string | null) => void,
    ) => {
        if (!validateScheme(draft)) {
            setError('Use formato 3 ou 3-4')
            return
        }
        setError(null)
        if (draft.trim() === current) return
        savePatch({ set_defaults: { [field]: draft.trim() } })
    }

    const handleRestBlur = (
        field: 'rest_compound_seconds' | 'rest_isolation_seconds',
        draft: string,
        current: number,
        setError: (msg: string | null) => void,
    ) => {
        if (!validateRest(draft)) {
            setError('Entre 0 e 600 segundos')
            return
        }
        setError(null)
        const n = Number(draft)
        if (n === current) return
        savePatch({ set_defaults: { [field]: n } })
    }

    const handleTempoBlur = () => {
        const trimmed = tempoDraft.trim()
        const next = trimmed === '' ? null : trimmed
        if (next === setDefaults.tempo) return
        savePatch({ set_defaults: { tempo: next } })
    }

    return (
        <CollapsibleSection title="Padrões de série">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label htmlFor="pref-sets" className="text-xs text-k-text-tertiary">Séries</label>
                    <input
                        id="pref-sets"
                        type="text"
                        value={setsDraft}
                        onChange={(e) => setSetsDraft(e.target.value)}
                        onBlur={() => handleSchemeBlur('sets', setsDraft, setDefaults.sets, setSetsError)}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500 ${setsError ? 'border-red-500' : 'border-k-border-subtle'}`}
                    />
                    {setsError && <p className="text-xs text-red-500">{setsError}</p>}
                </div>
                <div className="space-y-1">
                    <label htmlFor="pref-reps" className="text-xs text-k-text-tertiary">Reps</label>
                    <input
                        id="pref-reps"
                        type="text"
                        value={repsDraft}
                        onChange={(e) => setRepsDraft(e.target.value)}
                        onBlur={() => handleSchemeBlur('reps', repsDraft, setDefaults.reps, setRepsError)}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500 ${repsError ? 'border-red-500' : 'border-k-border-subtle'}`}
                    />
                    {repsError && <p className="text-xs text-red-500">{repsError}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label htmlFor="pref-rest-compound" className="text-xs text-k-text-tertiary">Descanso composto</label>
                    <div className="relative">
                        <input
                            id="pref-rest-compound"
                            type="number"
                            min={0}
                            max={600}
                            value={restCompoundDraft}
                            onChange={(e) => setRestCompoundDraft(e.target.value)}
                            onBlur={() => handleRestBlur('rest_compound_seconds', restCompoundDraft, setDefaults.rest_compound_seconds, setRestCompoundError)}
                            className={`w-full px-2 py-1.5 pr-7 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${restCompoundError ? 'border-red-500' : 'border-k-border-subtle'}`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-k-text-tertiary pointer-events-none">s</span>
                    </div>
                    {restCompoundError && <p className="text-xs text-red-500">{restCompoundError}</p>}
                </div>
                <div className="space-y-1">
                    <label htmlFor="pref-rest-isolation" className="text-xs text-k-text-tertiary">Descanso isolado</label>
                    <div className="relative">
                        <input
                            id="pref-rest-isolation"
                            type="number"
                            min={0}
                            max={600}
                            value={restIsolationDraft}
                            onChange={(e) => setRestIsolationDraft(e.target.value)}
                            onBlur={() => handleRestBlur('rest_isolation_seconds', restIsolationDraft, setDefaults.rest_isolation_seconds, setRestIsolationError)}
                            className={`w-full px-2 py-1.5 pr-7 text-sm rounded-lg bg-surface-card border text-k-text-primary focus:outline-none focus:ring-1 focus:ring-violet-500 ${restIsolationError ? 'border-red-500' : 'border-k-border-subtle'}`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-k-text-tertiary pointer-events-none">s</span>
                    </div>
                    {restIsolationError && <p className="text-xs text-red-500">{restIsolationError}</p>}
                </div>
            </div>

            <div className="space-y-1">
                <label htmlFor="pref-tempo" className="text-xs text-k-text-tertiary">Cadência</label>
                <input
                    id="pref-tempo"
                    type="text"
                    placeholder="ex: 2-0-2"
                    value={tempoDraft}
                    onChange={(e) => setTempoDraft(e.target.value)}
                    onBlur={handleTempoBlur}
                    className="w-full px-2 py-1.5 text-sm rounded-lg bg-surface-card border border-k-border-subtle text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">Método de carga</label>
                <ChipRow
                    options={LOAD_METHOD_OPTIONS}
                    value={setDefaults.load_method}
                    onChange={(next) => savePatch({ set_defaults: { load_method: next } })}
                    ariaLabel="Método de carga padrão"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-xs text-k-text-tertiary">Campos visíveis</label>
                <ChipRow
                    multi
                    minSelected={1}
                    options={VISIBLE_FIELD_OPTIONS}
                    value={setDefaults.visible_fields}
                    onChange={(next) => savePatch({ set_defaults: { visible_fields: next } })}
                    ariaLabel="Campos visíveis no editor de séries"
                />
            </div>
        </CollapsibleSection>
    )
}

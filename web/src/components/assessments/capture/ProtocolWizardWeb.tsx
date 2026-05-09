'use client'

import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react'
import { AnatomyDiagramWeb } from './AnatomyDiagramWeb'
import type {
    AssessmentProtocol,
    MeasurementInput,
} from '@kinevo/shared/types/assessments'
import {
    PROTOCOLS,
    type ProtocolDefinition,
    type Sex,
    type SkinfoldSite,
} from '@kinevo/shared/lib/assessment-protocols'

const SITE_LABELS: Record<SkinfoldSite, string> = {
    chest: 'Peitoral',
    abdomen: 'Abdominal',
    thigh: 'Coxa',
    triceps: 'Tríceps',
    subscapular: 'Subescapular',
    suprailiac: 'Supra-ilíaca',
    midaxillary: 'Axilar média',
    biceps: 'Bíceps',
    calf: 'Panturrilha',
}

export interface ProtocolWizardWebProps {
    test_id: string
    protocol: AssessmentProtocol
    sex: Sex
    label: string
    initialValues?: Partial<Record<SkinfoldSite, number>>
    onCommit: (rows: MeasurementInput[]) => void
    onCancel?: () => void
}

// M10B — port web do ProtocolWizard. Sub-wizard pra protocolos de skinfold
// (J&P 7, Petroski 4, etc). Uma site por página; commit gera N MeasurementInput
// rows (uma por site) com `metric_key='skinfold_<site>'`.
export function ProtocolWizardWeb({
    test_id,
    protocol,
    sex,
    label,
    initialValues,
    onCommit,
    onCancel,
}: ProtocolWizardWebProps) {
    const def: ProtocolDefinition = PROTOCOLS[protocol]
    const sites = useMemo<SkinfoldSite[]>(() => {
        const entry = def.required_sites.find(r => r.sex === sex)
        return entry ? entry.sites : []
    }, [def, sex])

    const [stepIdx, setStepIdx] = useState(0)
    const [values, setValues] = useState<Partial<Record<SkinfoldSite, string>>>(() => {
        const seed: Partial<Record<SkinfoldSite, string>> = {}
        for (const s of sites) {
            const v = initialValues?.[s]
            if (typeof v === 'number') seed[s] = String(v).replace('.', ',')
        }
        return seed
    })

    const currentSite = sites[stepIdx]

    const parsed = useMemo<Partial<Record<SkinfoldSite, number>>>(() => {
        const out: Partial<Record<SkinfoldSite, number>> = {}
        for (const s of sites) {
            const raw = values[s]
            if (raw === undefined) continue
            const n = Number(raw.replace(',', '.'))
            if (Number.isFinite(n) && n >= 0) out[s] = n
        }
        return out
    }, [values, sites])

    const allDone = sites.every(s => parsed[s] !== undefined)
    const currentDone = currentSite ? parsed[currentSite] !== undefined : false

    const goPrev = useCallback(() => {
        if (stepIdx === 0) {
            onCancel?.()
            return
        }
        setStepIdx(i => Math.max(0, i - 1))
    }, [stepIdx, onCancel])

    const goNext = useCallback(() => {
        if (!currentDone) return
        setStepIdx(i => Math.min(sites.length - 1, i + 1))
    }, [currentDone, sites.length])

    const updateValue = useCallback((site: SkinfoldSite, text: string) => {
        setValues(prev => ({ ...prev, [site]: text }))
    }, [])

    const reset = useCallback(() => {
        setValues({})
        setStepIdx(0)
    }, [])

    const handleCommit = useCallback(() => {
        if (!allDone) return
        const rows: MeasurementInput[] = sites.map(site => ({
            metric_key: `skinfold_${site}`,
            value_numeric: parsed[site] as number,
            value_unit: 'mm',
            side: null,
            attempt_number: 1,
            is_selected: true,
            raw_input: { test_id, protocol, site },
        }))
        onCommit(rows)
    }, [allDone, sites, parsed, test_id, protocol, onCommit])

    if (sites.length === 0 || !currentSite) {
        return (
            <div className="p-4">
                <p className="text-sm text-red-500">
                    Protocolo {protocol} não definido para sexo {sex}.
                </p>
            </div>
        )
    }

    const currentRaw = values[currentSite] ?? ''
    const currentParsed = parsed[currentSite]
    const inputBorderClass = currentParsed !== undefined ? 'border-violet-500' : 'border-k-border-subtle'

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={goPrev}
                    aria-label={stepIdx === 0 ? 'Voltar' : 'Dobra anterior'}
                    className="rounded-md p-2 text-k-text-secondary hover:bg-surface-inset"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-bold uppercase tracking-wider text-k-text-tertiary">
                    {label} — {stepIdx + 1} / {sites.length}
                </span>
                <button
                    type="button"
                    onClick={reset}
                    aria-label="Reiniciar protocolo"
                    className="rounded-md p-2 text-k-text-tertiary hover:bg-surface-inset"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {/* Sub-progress dots */}
            <div className="flex justify-center gap-1.5">
                {sites.map((s, i) => (
                    <span
                        key={s}
                        className="h-1.5 rounded-full transition-all"
                        style={{
                            width: i === stepIdx ? 18 : 6,
                            backgroundColor:
                                parsed[s] !== undefined
                                    ? '#7c3aed'
                                    : i === stepIdx
                                        ? '#7c3aed88'
                                        : '#E5E7EB',
                        }}
                    />
                ))}
            </div>

            <AnatomyDiagramWeb highlight_site={currentSite} />

            <h3 className="text-center text-xl font-bold text-k-text-primary">
                {SITE_LABELS[currentSite]}
            </h3>

            <div className={`flex items-end gap-3 rounded-2xl border bg-surface-card px-5 py-4 ${inputBorderClass}`}>
                <input
                    type="text"
                    inputMode="decimal"
                    value={currentRaw}
                    onChange={e => updateValue(currentSite, e.target.value)}
                    placeholder="0"
                    aria-label={`${SITE_LABELS[currentSite]} em milímetros`}
                    className="flex-1 bg-transparent text-[44px] font-extrabold leading-tight text-k-text-primary outline-none placeholder:text-k-text-quaternary"
                />
                <span className="mb-1.5 text-lg font-semibold text-k-text-secondary">mm</span>
            </div>

            {stepIdx < sites.length - 1 ? (
                <button
                    type="button"
                    onClick={goNext}
                    disabled={!currentDone}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                        currentDone
                            ? 'bg-violet-500 text-white hover:bg-violet-600'
                            : 'bg-surface-inset text-k-text-tertiary cursor-not-allowed'
                    }`}
                >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleCommit}
                    disabled={!allDone}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${
                        allDone
                            ? 'bg-violet-500 text-white hover:bg-violet-600'
                            : 'bg-surface-inset text-k-text-tertiary cursor-not-allowed'
                    }`}
                >
                    <Check className="h-4 w-4" />
                    Confirmar protocolo
                </button>
            )}

            <p className="text-center text-[11px] text-k-text-tertiary">
                {def.source_citation}
            </p>
        </div>
    )
}

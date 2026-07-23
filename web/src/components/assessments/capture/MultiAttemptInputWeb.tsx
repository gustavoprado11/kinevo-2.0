'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { MeasurementInput, MeasurementUnit } from '@kinevo/shared/types/assessments'

export type SelectionStrategy = 'best_max' | 'best_min' | 'median' | 'mean'

export interface MultiAttemptInputWebProps {
    test_id: string
    metric_key: string
    label: string
    unit: MeasurementUnit
    attempts: number
    selection_strategy: SelectionStrategy
    hint?: string
    initialAttempts?: number[]
    onAttemptsChange?: (values: number[]) => void
    onCommit: (rows: MeasurementInput[]) => void
}

// M10B — port web do MultiAttemptInput. N slots numéricos. Computes valor
// final por strategy. Commits N rows (1 por attempt) com is_selected=true
// no escolhido.
export function MultiAttemptInputWeb({
    test_id,
    metric_key,
    label,
    unit,
    attempts,
    selection_strategy,
    hint,
    initialAttempts,
    onAttemptsChange,
    onCommit,
}: MultiAttemptInputWebProps) {
    const [raw, setRaw] = useState<string[]>(() => {
        const seed = initialAttempts ?? []
        const arr = Array(attempts).fill('')
        for (let i = 0; i < Math.min(attempts, seed.length); i++) {
            arr[i] = String(seed[i]).replace('.', ',')
        }
        return arr
    })

    const parsed = useMemo(() => raw.map(s => parseDecimal(s)), [raw])

    const validValues = useMemo(
        () => parsed.filter((v): v is number => v !== null),
        [parsed],
    )

    useEffect(() => {
        onAttemptsChange?.(validValues)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validValues.length, ...validValues])

    const allFilled = validValues.length === attempts

    const finalValue = useMemo(() => {
        if (!allFilled) return null
        return applyStrategy(validValues, selection_strategy)
    }, [allFilled, validValues, selection_strategy])

    const selectedIndex = useMemo(() => {
        if (finalValue === null || !allFilled) return -1
        let bestI = 0
        let bestDelta = Number.POSITIVE_INFINITY
        for (let i = 0; i < parsed.length; i++) {
            const v = parsed[i]
            if (v === null) continue
            const d = Math.abs(v - finalValue)
            if (d < bestDelta) { bestDelta = d; bestI = i }
        }
        return bestI
    }, [parsed, finalValue, allFilled])

    const updateSlot = useCallback((idx: number, text: string) => {
        setRaw(prev => {
            const next = [...prev]
            next[idx] = text
            return next
        })
    }, [])

    const reset = useCallback(() => {
        setRaw(Array(attempts).fill(''))
    }, [attempts])

    const handleCommit = useCallback(() => {
        if (!allFilled || finalValue === null) return
        const rows: MeasurementInput[] = parsed.map((v, i) => ({
            metric_key,
            value_numeric: v as number,
            value_unit: unit,
            side: null,
            attempt_number: i + 1,
            is_selected: i === selectedIndex,
            raw_input: { test_id, selection_strategy },
        }))
        onCommit(rows)
    }, [allFilled, finalValue, parsed, metric_key, unit, test_id, selectedIndex, selection_strategy, onCommit])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-k-text-tertiary">
                    {label} — {attempts} tentativas
                </div>
                <button
                    type="button"
                    onClick={reset}
                    aria-label="Limpar tentativas"
                    className="flex items-center gap-1 rounded p-1 text-xs text-k-text-tertiary hover:bg-surface-inset"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Limpar
                </button>
            </div>

            <div className="space-y-2">
                {Array.from({ length: attempts }).map((_, i) => (
                    <Slot
                        key={i}
                        index={i}
                        value={raw[i] ?? ''}
                        onChange={t => updateSlot(i, t)}
                        unit={unit}
                        valid={parsed[i] !== null}
                        isSelected={i === selectedIndex && allFilled}
                    />
                ))}
            </div>

            {finalValue !== null && (
                <div className="flex items-center justify-between rounded-control bg-surface-inset px-4 py-3">
                    <span className="text-xs font-medium text-k-text-secondary">
                        Valor final ({strategyLabel(selection_strategy)})
                    </span>
                    <span className="text-xl font-mono font-semibold tabular-nums text-k-text-primary">
                        {finalValue.toFixed(1)} {unit}
                    </span>
                </div>
            )}

            {hint && <p className="text-xs text-k-text-tertiary">{hint}</p>}

            <button
                type="button"
                onClick={handleCommit}
                disabled={!allFilled}
                className={`mt-1 flex w-full items-center justify-center gap-2 rounded-control py-3 text-sm font-semibold transition-colors ${
                    allFilled
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'bg-surface-inset text-k-text-tertiary cursor-not-allowed'
                }`}
            >
                <Check className="h-4 w-4" />
                Confirmar
            </button>
        </div>
    )
}

function Slot(props: {
    index: number
    value: string
    onChange: (v: string) => void
    unit: MeasurementUnit
    valid: boolean
    isSelected: boolean
}) {
    const stateClass = props.isSelected
        ? 'border-k-border-primary bg-surface-inset'
        : props.valid
            ? 'border-k-border-subtle bg-surface-card'
            : 'border-k-border-subtle/50 bg-surface-card'
    return (
        <div className={`flex items-center gap-2 rounded-control border px-4 py-3 ${stateClass}`}>
            <span className="w-6 font-mono text-xs font-semibold tabular-nums text-k-text-tertiary">#{props.index + 1}</span>
            <input
                type="text"
                inputMode="decimal"
                value={props.value}
                onChange={e => props.onChange(e.target.value)}
                placeholder="0"
                aria-label={`Tentativa ${props.index + 1} em ${props.unit}`}
                className="flex-1 bg-transparent text-2xl font-mono font-semibold tabular-nums text-k-text-primary outline-none placeholder:text-k-text-quaternary"
            />
            <span className="text-sm font-semibold text-k-text-tertiary">{props.unit}</span>
            {props.isSelected && <Check className="ml-1 h-4 w-4 text-k-text-primary" />}
        </div>
    )
}

function applyStrategy(values: number[], s: SelectionStrategy): number {
    if (values.length === 0) return 0
    if (s === 'best_max') return Math.max(...values)
    if (s === 'best_min') return Math.min(...values)
    if (s === 'mean') return values.reduce((a, b) => a + b, 0) / values.length
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function strategyLabel(s: SelectionStrategy): string {
    switch (s) {
        case 'best_max': return 'melhor'
        case 'best_min': return 'menor'
        case 'mean': return 'média'
        case 'median': return 'mediana'
    }
}

function parseDecimal(text: string): number | null {
    if (!text || !text.trim()) return null
    const n = Number(text.trim().replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return null
    return n
}

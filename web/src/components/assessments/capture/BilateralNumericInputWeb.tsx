'use client'

import { useCallback, useState } from 'react'
import type { MeasurementInput, MeasurementUnit } from '@kinevo/shared/types/assessments'

export interface BilateralNumericInputWebProps {
    test_id: string
    metric_key: string
    label: string
    unit: MeasurementUnit
    hint?: string
    onCommit: (measurements: MeasurementInput[]) => void
    initialLeft?: number | null
    initialRight?: number | null
    /** Reportar mudanças de estado pra wizard parent decidir canAdvance. */
    onValidChange?: (valid: boolean, leftRight?: { left: number; right: number }) => void
}

// M10B — port web do BilateralNumericInput. 2 inputs lado-a-lado D/E.
// Commits 2 MeasurementInput rows (mesma metric_key, side='left' / 'right').
export function BilateralNumericInputWeb({
    test_id,
    metric_key,
    label,
    unit,
    hint,
    onCommit,
    initialLeft,
    initialRight,
    onValidChange,
}: BilateralNumericInputWebProps) {
    const [leftRaw, setLeftRaw] = useState(initialLeft != null ? String(initialLeft).replace('.', ',') : '')
    const [rightRaw, setRightRaw] = useState(initialRight != null ? String(initialRight).replace('.', ',') : '')

    const left = parseDecimal(leftRaw)
    const right = parseDecimal(rightRaw)
    const isValid = left !== null && right !== null

    // Notifica parent sempre que validez mudar
    const handleChange = useCallback((side: 'left' | 'right', text: string) => {
        if (side === 'left') setLeftRaw(text)
        else setRightRaw(text)
        const nextLeft = side === 'left' ? parseDecimal(text) : left
        const nextRight = side === 'right' ? parseDecimal(text) : right
        const valid = nextLeft !== null && nextRight !== null
        if (valid && onValidChange) {
            onValidChange(true, { left: nextLeft!, right: nextRight! })
        } else if (onValidChange) {
            onValidChange(false)
        }
    }, [left, right, onValidChange])

    const handleSubmit = useCallback(() => {
        if (left === null || right === null) return
        onCommit([
            {
                metric_key,
                value_numeric: left,
                value_unit: unit,
                side: 'left',
                attempt_number: 1,
                is_selected: true,
                raw_input: { test_id },
            },
            {
                metric_key,
                value_numeric: right,
                value_unit: unit,
                side: 'right',
                attempt_number: 1,
                is_selected: true,
                raw_input: { test_id },
            },
        ])
    }, [left, right, metric_key, unit, test_id, onCommit])

    return (
        <div className="space-y-3">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-k-text-tertiary">
                {label}
            </div>

            <div className="flex gap-3">
                <SidePad
                    label="Esquerdo"
                    value={leftRaw}
                    valid={left !== null}
                    unit={unit}
                    onChange={t => handleChange('left', t)}
                    onSubmit={handleSubmit}
                />
                <SidePad
                    label="Direito"
                    value={rightRaw}
                    valid={right !== null}
                    unit={unit}
                    onChange={t => handleChange('right', t)}
                    onSubmit={handleSubmit}
                />
            </div>

            {hint && <p className="text-xs text-k-text-tertiary">{hint}</p>}
            {isValid && (
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="hidden"
                    aria-hidden
                />
            )}
        </div>
    )
}

function SidePad(props: {
    label: string
    value: string
    onChange: (v: string) => void
    onSubmit: () => void
    valid: boolean
    unit: MeasurementUnit
}) {
    const borderClass = props.valid ? 'border-k-border-primary' : 'border-k-border-subtle'
    return (
        <div className={`flex-1 rounded-control border bg-surface-card p-4 ${borderClass}`}>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-k-text-tertiary">
                {props.label}
            </div>
            <div className="mt-1.5 flex items-end gap-1.5">
                <input
                    type="text"
                    inputMode="decimal"
                    value={props.value}
                    onChange={e => props.onChange(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            props.onSubmit()
                        }
                    }}
                    placeholder="0"
                    aria-label={`${props.label} em ${props.unit}`}
                    className="flex-1 bg-transparent text-3xl font-mono font-semibold tabular-nums leading-tight text-k-text-primary outline-none placeholder:text-k-text-quaternary"
                />
                <span className="mb-1 text-sm font-semibold text-k-text-secondary">
                    {props.unit}
                </span>
            </div>
        </div>
    )
}

function parseDecimal(text: string): number | null {
    if (!text || !text.trim()) return null
    const n = Number(text.trim().replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return null
    return n
}

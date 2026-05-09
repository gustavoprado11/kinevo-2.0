'use client'

import { useCallback, useEffect } from 'react'
import { useAssessmentMeasurementForm } from '@/hooks/use-assessment-measurement-form'
import type { MeasurementInput, MeasurementUnit } from '@kinevo/shared/types/assessments'

export interface NumericUnitInputWebProps {
    test_id: string
    metric_key: string
    label: string
    unit: MeasurementUnit
    hint?: string
    warn_below?: number
    warn_above?: number
    initialValue?: number | null
    onCommit: (m: MeasurementInput) => void
    onValidParsed?: (value: number, isOutOfRange: boolean) => void
}

// M10B — single-value numeric input. Big-display visuals (44px font),
// inputmode=decimal pra teclado numérico em mobile/tablet, focus ring violet,
// border amarela quando out-of-range.
export function NumericUnitInputWeb({
    test_id,
    metric_key,
    label,
    unit,
    hint,
    warn_below,
    warn_above,
    initialValue,
    onCommit,
    onValidParsed,
}: NumericUnitInputWebProps) {
    const form = useAssessmentMeasurementForm({
        test_id,
        metric_key,
        unit,
        warn_below,
        warn_above,
    })

    useEffect(() => {
        if (initialValue != null) {
            form.onChangeText(String(initialValue).replace('.', ','))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleChange = useCallback(
        (text: string) => {
            form.onChangeText(text)
        },
        [form],
    )

    const handleSubmit = useCallback(() => {
        const m = form.toMeasurementInput()
        if (!m) return
        onCommit(m)
    }, [form, onCommit])

    useEffect(() => {
        if (form.state.isValid && form.state.parsed !== null && onValidParsed) {
            onValidParsed(form.state.parsed, form.state.isOutOfRange)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.state.parsed, form.state.isOutOfRange])

    const borderClass = form.state.isOutOfRange
        ? 'border-amber-500'
        : form.state.isValid
            ? 'border-violet-500'
            : 'border-k-border-subtle'

    return (
        <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-k-text-secondary">
                {label}
            </div>

            <div
                className={`flex items-end gap-3 rounded-2xl border bg-surface-card px-5 py-4 ${borderClass}`}
            >
                <input
                    type="text"
                    inputMode="decimal"
                    value={form.state.rawValue}
                    onChange={e => handleChange(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSubmit()
                        }
                    }}
                    placeholder="0"
                    aria-label={`${label} em ${unit}`}
                    className="flex-1 bg-transparent text-[44px] font-extrabold leading-tight text-k-text-primary outline-none placeholder:text-k-text-quaternary"
                />
                <span className="mb-1.5 text-lg font-semibold text-k-text-secondary">
                    {unit}
                </span>
            </div>

            {hint && (
                <p className="text-xs text-k-text-tertiary">{hint}</p>
            )}

            {form.state.isOutOfRange && (
                <p className="text-xs font-semibold text-amber-500" role="alert">
                    {form.state.rangeReason === 'below'
                        ? 'Valor parece muito baixo — confirme antes de prosseguir'
                        : 'Valor parece muito alto — confirme antes de prosseguir'}
                </p>
            )}
        </div>
    )
}

'use client'

export interface ComputedDisplayWebProps {
    label: string
    value: number | null
    unit?: string
    formula_label?: string
    description?: string
    classification_label?: string
    classification_color?: string
}

// M10B — port web do ComputedDisplay. Read-only card pra metric calculada
// (BMI, RCQ, %BG via protocol). Inputs vêm de steps anteriores; esse comp
// nunca edita o draft.
export function ComputedDisplayWeb({
    label,
    value,
    unit,
    formula_label,
    description,
    classification_label,
    classification_color,
}: ComputedDisplayWebProps) {
    const hasValue = value !== null && Number.isFinite(value)

    return (
        <div
            className="space-y-2 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5"
            role="text"
            aria-label={
                hasValue
                    ? `${label}: ${(value as number).toFixed(2)}${unit ? ' ' + unit : ''}`
                    : `${label}: aguardando dados`
            }
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    {label}
                </span>
                {formula_label && (
                    <span className="text-[11px] text-k-text-tertiary">{formula_label}</span>
                )}
            </div>

            {hasValue ? (
                <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-extrabold text-k-text-primary">
                        {(value as number).toFixed(2)}
                    </span>
                    {unit && (
                        <span className="mb-1.5 text-sm font-semibold text-k-text-secondary">
                            {unit}
                        </span>
                    )}
                </div>
            ) : (
                <p className="text-base font-medium text-k-text-tertiary">Faltam medidas</p>
            )}

            {classification_label && (
                <span
                    className="inline-block rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{
                        backgroundColor: (classification_color ?? '#8b5cf6') + '22',
                        color: classification_color ?? '#8b5cf6',
                    }}
                >
                    {classification_label}
                </span>
            )}

            {description && (
                <p className="text-xs text-k-text-tertiary">{description}</p>
            )}
        </div>
    )
}

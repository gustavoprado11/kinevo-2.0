'use client'

import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { AssessmentSessionListItem } from '@kinevo/shared/types/assessments'

interface ResultComparisonTableProps {
    /** Most-recent first. Component picks up to N entries to compare. */
    sessions: AssessmentSessionListItem[]
    maxColumns?: number
}

const ROWS: { key: string; label: string; digits: number; suffix?: string; betterDirection?: 'down' | 'up' }[] = [
    { key: 'body_fat_percent', label: '% Gordura', digits: 1, suffix: '%', betterDirection: 'down' },
    { key: 'bmi', label: 'IMC', digits: 1, betterDirection: 'down' },
    { key: 'rcq', label: 'RCQ', digits: 2, betterDirection: 'down' },
    { key: 'lean_mass_kg', label: 'Massa magra', digits: 1, suffix: ' kg', betterDirection: 'up' },
    { key: 'fat_mass_kg', label: 'Massa gorda', digits: 1, suffix: ' kg', betterDirection: 'down' },
]

const TIMEZONE = 'America/Sao_Paulo'

function formatDate(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: TIMEZONE,
    })
}

function fmt(n: number | undefined, digits: number, suffix?: string): string {
    if (n == null || !Number.isFinite(n)) return '—'
    return `${n.toFixed(digits).replace('.', ',')}${suffix ?? ''}`
}

/**
 * Compact comparison table — current session in the leftmost data column,
 * up to N previous sessions on the right. Trend arrow on the most recent vs
 * the immediately previous, color-coded by `betterDirection`.
 */
export function ResultComparisonTable({ sessions, maxColumns = 4 }: ResultComparisonTableProps) {
    const completed = sessions.filter(s => s.status === 'completed' && s.computed_metrics)
    if (completed.length < 2) {
        return (
            <div className="rounded-2xl border border-k-border-subtle bg-surface-card p-5">
                <h3 className="text-sm font-semibold text-k-text-primary">Comparativo</h3>
                <p className="mt-2 text-xs text-k-text-tertiary">
                    {completed.length === 0
                        ? 'Sem outras avaliações concluídas para comparar.'
                        : 'Apenas uma avaliação concluída — comparativo aparece a partir da segunda.'}
                </p>
            </div>
        )
    }

    const cols = completed.slice(0, maxColumns)
    const current = cols[0]!
    const previous = cols[1]!

    return (
        <div className="overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card">
            <header className="border-b border-k-border-subtle px-5 py-4">
                <h3 className="text-sm font-semibold text-k-text-primary">Comparativo</h3>
                <p className="mt-0.5 text-xs text-k-text-tertiary">
                    Últimas {cols.length} avaliações concluídas (mais recente à esquerda)
                </p>
            </header>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-k-border-subtle bg-surface-inset">
                            <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                                Métrica
                            </th>
                            {cols.map((c, i) => (
                                <th
                                    key={c.id}
                                    className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary"
                                >
                                    {i === 0 ? 'Atual' : formatDate(c.completed_at)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-k-border-subtle">
                        {ROWS.map(row => {
                            const cur = current.computed_metrics?.[row.key] as number | undefined
                            const prev = previous.computed_metrics?.[row.key] as number | undefined
                            const delta =
                                typeof cur === 'number' && typeof prev === 'number' && Number.isFinite(cur) && Number.isFinite(prev)
                                    ? cur - prev
                                    : null

                            return (
                                <tr key={row.key}>
                                    <td className="px-5 py-2.5 text-k-text-secondary">{row.label}</td>
                                    {cols.map((c, i) => {
                                        const val = c.computed_metrics?.[row.key] as number | undefined
                                        return (
                                            <td
                                                key={c.id}
                                                className={`px-3 py-2.5 text-right ${
                                                    i === 0 ? 'font-semibold text-k-text-primary' : 'text-k-text-tertiary'
                                                }`}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {i === 0 && delta != null && (
                                                        <Trend delta={delta} digits={row.digits} suffix={row.suffix} better={row.betterDirection} />
                                                    )}
                                                    <span>{fmt(val, row.digits, row.suffix)}</span>
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function Trend({
    delta,
    digits,
    suffix,
    better,
}: {
    delta: number
    digits: number
    suffix?: string
    better?: 'down' | 'up'
}) {
    const isUp = delta > 0
    const isDown = delta < 0
    if (!isUp && !isDown) return null

    const isImprovement =
        (better === 'down' && isDown) || (better === 'up' && isUp)
    const isWorse =
        (better === 'down' && isUp) || (better === 'up' && isDown)

    const cls = isImprovement
        ? 'text-emerald-600 dark:text-emerald-400'
        : isWorse
            ? 'text-red-500'
            : 'text-k-text-tertiary'

    const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

    return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${cls}`}>
            <Icon className="h-3 w-3" />
            {Math.abs(delta).toFixed(digits).replace('.', ',')}{suffix ?? ''}
        </span>
    )
}

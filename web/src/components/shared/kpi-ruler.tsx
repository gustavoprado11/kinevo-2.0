import type { ReactNode } from 'react'

/**
 * KpiRuler / KpiCell
 * ------------------
 * Régua de métricas do redesign "ferramenta profissional" — painel único com
 * divisores hairline (gap-px sobre o tom da borda), rótulo em Geist Mono
 * micro-caps e número 26px tabular. Cor é alerta, não decoração.
 *
 * Extraído das cópias locais que viviam em components/dashboard/stat-cards.tsx
 * e components/students/student-kpi-ruler.tsx para poder ser reusado nas telas
 * de Formulários e Avaliações (e onde mais a régua reaparecer).
 */

export type KpiTone = 'neutral' | 'amber' | 'red' | 'emerald'

export interface KpiCellData {
    key: string
    label: string
    value: ReactNode
    tone?: KpiTone
    sub?: ReactNode
    action?: ReactNode
}

const TONE_CLASS: Record<KpiTone, string> = {
    neutral: 'text-k-text-primary',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
}

// Sufixo/unidade dentro do número grande ("2/4", "3d", "%") em corpo menor.
export function KpiUnit({ children }: { children: ReactNode }) {
    return <span className="text-sm font-medium text-k-text-tertiary">{children}</span>
}

export function KpiCell({ label, value, tone = 'neutral', sub, action }: Omit<KpiCellData, 'key'>) {
    return (
        <div className="bg-surface-card px-5 py-4 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    {label}
                </span>
                {action}
            </div>
            <p className={`text-[26px] leading-tight font-bold tracking-tight tabular-nums ${TONE_CLASS[tone]}`}>
                {value}
            </p>
            {sub && (
                <span className="text-[11.5px] text-k-text-tertiary tabular-nums truncate">{sub}</span>
            )}
        </div>
    )
}

const GRID_CLASS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
}

export function KpiRuler({ cells, ariaLabel, className = '' }: {
    cells: KpiCellData[]
    ariaLabel?: string
    className?: string
}) {
    if (cells.length === 0) return null
    const grid = GRID_CLASS[cells.length] ?? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'

    return (
        <div
            role="region"
            aria-label={ariaLabel}
            className={`grid ${grid} gap-px rounded-panel border border-k-border-subtle bg-k-border-subtle overflow-hidden ${className}`}
        >
            {cells.map(cell => (
                <KpiCell
                    key={cell.key}
                    label={cell.label}
                    value={cell.value}
                    tone={cell.tone}
                    sub={cell.sub}
                    action={cell.action}
                />
            ))}
        </div>
    )
}

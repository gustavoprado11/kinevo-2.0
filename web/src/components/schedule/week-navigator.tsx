'use client'

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Props {
    weekStart: string // YYYY-MM-DD (domingo)
    isNavigating: boolean
    onPrevious: () => void
    onNext: () => void
    onToday: () => void
}

const MONTHS_PT = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function parseKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

/** Formata "DD/MM – DD/MM" do intervalo da semana. */
function formatWeekRange(weekStart: string): string {
    const start = parseKey(weekStart)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    const sd = String(start.getUTCDate()).padStart(2, '0')
    const sm = MONTHS_PT[start.getUTCMonth()]
    const ed = String(end.getUTCDate()).padStart(2, '0')
    const em = MONTHS_PT[end.getUTCMonth()]
    if (start.getUTCMonth() === end.getUTCMonth()) {
        return `${sd}–${ed} ${sm}`
    }
    return `${sd} ${sm} – ${ed} ${em}`
}

export function WeekNavigator({
    weekStart,
    isNavigating,
    onPrevious,
    onNext,
    onToday,
}: Props) {
    const rangeLabel = formatWeekRange(weekStart)

    return (
        <div className="flex items-center gap-1.5">
            <button
                type="button"
                onClick={onPrevious}
                aria-label="Semana anterior"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#6E6E73] dark:text-k-text-secondary border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
            >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <div className="flex items-center gap-2 min-w-[140px] justify-center px-2">
                {isNavigating && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#86868B] dark:text-k-text-quaternary" />
                )}
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary tabular-nums">
                    {rangeLabel}
                </span>
            </div>
            <button
                type="button"
                onClick={onNext}
                aria-label="Próxima semana"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#6E6E73] dark:text-k-text-secondary border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
            >
                <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
                type="button"
                onClick={onToday}
                className="ml-1.5 h-8 px-3 text-[11px] font-semibold text-[#007AFF] dark:text-violet-400 border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-lg transition-colors"
            >
                Hoje
            </button>
        </div>
    )
}

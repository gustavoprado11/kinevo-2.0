'use client'

import { memo } from 'react'
import Link from 'next/link'
import { CalendarClock, RefreshCw, Check } from 'lucide-react'
import type { StudentRenewal } from '@/lib/financial/upcoming-renewals'
import { formatBrDate } from '@kinevo/shared/utils/format-br-date'

interface UpcomingRenewalsCardProps {
    renewals: StudentRenewal[]
}

const MAX_ROWS = 5

function planPhrase(kind: 'subscription' | 'fixed_term', days: number): string {
    const isSub = kind === 'subscription'
    if (days < 0) {
        const n = Math.abs(days)
        return `${isSub ? 'atrasada' : 'vencido'} há ${n} dia${n > 1 ? 's' : ''}`
    }
    if (days === 0) return isSub ? 'cobra hoje' : 'vence hoje'
    return `${isSub ? 'cobra' : 'vence'} em ${days} dia${days > 1 ? 's' : ''}`
}

// Card do Dashboard focado na VIGÊNCIA DO PLANO — o vencimento do treino já
// vive em "Programas encerrando". Ordena pelo plano que vence primeiro.
export const UpcomingRenewalsCard = memo(function UpcomingRenewalsCard({ renewals }: UpcomingRenewalsCardProps) {
    const rows = renewals
        .filter((r) => r.plan)
        .sort((a, b) => a.plan!.daysUntil - b.plan!.daysUntil)
        .slice(0, MAX_ROWS)

    return (
        <section className="flex flex-col rounded-panel border border-k-border-subtle bg-surface-card">
            <div className="flex items-baseline justify-between gap-2 border-b border-k-border-subtle px-5 py-3">
                <div className="flex items-baseline gap-2">
                    <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Vencimentos
                    </h2>
                    {rows.length > 0 && (
                        <span className="font-mono text-[10.5px] tabular-nums text-k-text-quaternary">
                            {rows.length}
                        </span>
                    )}
                </div>
                <Link
                    href="/financial/vencimentos"
                    className="text-[11px] font-medium text-k-text-tertiary transition-colors hover:text-k-text-primary"
                >
                    Ver todos →
                </Link>
            </div>

            {rows.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-inset">
                        <Check className="h-4 w-4 text-k-text-tertiary" strokeWidth={2} />
                    </div>
                    <p className="text-[13px] text-k-text-secondary">Nenhum plano vencendo</p>
                    <p className="mt-1 text-xs text-k-text-quaternary">Vigências e cobranças próximas aparecerão aqui</p>
                </div>
            ) : (
                <div className="divide-y divide-k-border-subtle">
                    {rows.map((r) => {
                        const plan = r.plan!
                        const isSub = plan.kind === 'subscription'
                        const urgent = plan.daysUntil <= 3
                        return (
                            <Link
                                key={r.studentId}
                                href={`/students/${r.studentId}?tab=financeiro`}
                                className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-inset/60"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-k-border-subtle bg-surface-inset">
                                        <span className="text-[11px] font-semibold text-k-text-secondary">
                                            {r.studentName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-k-text-primary">
                                            {r.studentName}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-k-text-tertiary">
                                            {isSub
                                                ? <RefreshCw size={11} className="shrink-0 text-k-text-quaternary" />
                                                : <CalendarClock size={11} className="shrink-0 text-k-text-quaternary" />}
                                            <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">
                                                {isSub ? 'Assinatura' : 'Plano'}
                                            </span>
                                            <span className="tabular-nums">{formatBrDate(plan.periodEnd)}</span>
                                        </span>
                                    </div>
                                </div>
                                <span
                                    className={`shrink-0 text-[12px] font-medium tabular-nums ${
                                        plan.daysUntil < 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : urgent
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-k-text-tertiary'
                                    }`}
                                >
                                    {planPhrase(plan.kind, plan.daysUntil)}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            )}
        </section>
    )
})

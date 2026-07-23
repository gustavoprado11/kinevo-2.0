'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarClock, Dumbbell, RefreshCw } from 'lucide-react'
import { AppLayout } from '@/components/layout'
import type { StudentRenewal, PlanRenewal, ProgramExpiry } from '@/lib/financial/upcoming-renewals'
import { formatBrDate } from '@kinevo/shared/utils/format-br-date'

interface VencimentosClientProps {
    renewals: StudentRenewal[]
    trainer: {
        name: string | null
        email: string | null
        avatar_url: string | null
        theme: string | null
    }
}

type FilterKey = 'all' | 'overdue' | 'week' | 'month'

const FILTERS: { key: FilterKey; label: string; match: (d: number) => boolean }[] = [
    { key: 'all', label: 'Todos', match: () => true },
    { key: 'overdue', label: 'Vencidos', match: (d) => d < 0 },
    { key: 'week', label: '7 dias', match: (d) => d >= 0 && d <= 7 },
    { key: 'month', label: '30 dias', match: (d) => d >= 0 && d <= 30 },
]

// "vence em 3 dias" / "vence hoje" / "vencido há 2 dias" — verbo conforme o contexto.
function daysPhrase(days: number, verb: { future: string; today: string; past: string }): string {
    if (days < 0) {
        const n = Math.abs(days)
        return `${verb.past} há ${n} dia${n > 1 ? 's' : ''}`
    }
    if (days === 0) return verb.today
    return `${verb.future} em ${days} dia${days > 1 ? 's' : ''}`
}

function urgencyClass(days: number): string {
    if (days < 0) return 'text-red-600 dark:text-red-400'
    if (days <= 3) return 'text-amber-600 dark:text-amber-400'
    return 'text-k-text-tertiary'
}

function PlanCell({ plan, studentId }: { plan: PlanRenewal; studentId: string }) {
    const isSub = plan.kind === 'subscription'
    const phrase = daysPhrase(
        plan.daysUntil,
        isSub
            ? { future: 'cobra', today: 'cobra hoje', past: 'atrasada' }
            : { future: 'vence', today: 'vence hoje', past: 'vencido' },
    )
    return (
        <Link
            href={`/students/${studentId}?tab=financeiro`}
            className="group/plan flex min-w-0 flex-1 items-center gap-2 rounded-control border border-k-border-subtle bg-surface-inset/50 px-3 py-2 transition-colors hover:bg-surface-inset"
        >
            {isSub
                ? <RefreshCw size={13} className="shrink-0 text-k-text-quaternary" />
                : <CalendarClock size={13} className="shrink-0 text-k-text-quaternary" />}
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">
                        {isSub ? 'Assinatura' : 'Plano'}
                    </span>
                    <span className="text-[11px] tabular-nums text-k-text-tertiary">
                        {isSub ? 'Próx. cobrança' : 'Vigência até'} {formatBrDate(plan.periodEnd)}
                    </span>
                </div>
                <span className={`text-xs font-medium ${urgencyClass(plan.daysUntil)}`}>{phrase}</span>
            </div>
        </Link>
    )
}

function ProgramCell({ program, studentId }: { program: ProgramExpiry; studentId: string }) {
    const phrase = daysPhrase(program.daysUntil, { future: 'encerra', today: 'encerra hoje', past: 'encerrou' })
    return (
        <Link
            href={`/students/${studentId}/program/new?from=${program.programId}`}
            className="group/prog flex min-w-0 flex-1 items-center gap-2 rounded-control border border-k-border-subtle bg-surface-inset/50 px-3 py-2 transition-colors hover:bg-surface-inset"
        >
            <Dumbbell size={13} className="shrink-0 text-k-text-quaternary" />
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-quaternary">
                        Treino
                    </span>
                    <span className="text-[11px] tabular-nums text-k-text-tertiary truncate">
                        {program.programName}
                    </span>
                </div>
                <span className={`text-xs font-medium ${urgencyClass(program.daysUntil)}`}>{phrase}</span>
            </div>
        </Link>
    )
}

export function VencimentosClient({ renewals, trainer }: VencimentosClientProps) {
    const [filter, setFilter] = useState<FilterKey>('all')

    const counts = useMemo(() => {
        const c: Record<FilterKey, number> = { all: 0, overdue: 0, week: 0, month: 0 }
        for (const r of renewals) for (const f of FILTERS) if (f.match(r.soonestDays)) c[f.key]++
        return c
    }, [renewals])

    const visible = useMemo(() => {
        const f = FILTERS.find((x) => x.key === filter)!
        return renewals.filter((r) => f.match(r.soonestDays))
    }, [renewals, filter])

    return (
        <AppLayout
            trainerName={trainer.name ?? ''}
            trainerEmail={trainer.email ?? ''}
            trainerAvatarUrl={trainer.avatar_url ?? undefined}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-5">
                <Link
                    href="/financial"
                    className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-k-text-tertiary transition-colors hover:text-k-text-primary"
                >
                    <ArrowLeft size={13} />
                    Voltar pro Financeiro
                </Link>
                <h1 className="text-xl font-semibold text-k-text-primary">Vencimentos</h1>
                <p className="mt-1 text-[13px] text-k-text-tertiary">
                    A vigência do <span className="text-k-text-secondary">plano</span> (comercial) e o vencimento do{' '}
                    <span className="text-k-text-secondary">treino</span> (programa), lado a lado — quem vence primeiro no topo.
                </p>
            </div>

            {/* Filtros */}
            <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => {
                    const active = filter === f.key
                    return (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors ${
                                active
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-k-border-subtle text-k-text-tertiary hover:bg-surface-inset'
                            }`}
                        >
                            {f.label}
                            <span className="font-mono tabular-nums text-[10px] opacity-70">{counts[f.key]}</span>
                        </button>
                    )
                })}
            </div>

            {/* Lista */}
            <div className="rounded-panel border border-k-border-subtle bg-surface-card">
                {visible.length === 0 ? (
                    <div className="py-14 text-center">
                        <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-inset">
                            <CalendarClock className="h-4 w-4 text-k-text-tertiary" strokeWidth={2} />
                        </div>
                        <p className="text-[13px] text-k-text-secondary">Nada vencendo nesse filtro</p>
                    </div>
                ) : (
                    <div className="divide-y divide-k-border-subtle">
                        {visible.map((r) => (
                            <div key={r.studentId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                                <Link
                                    href={`/students/${r.studentId}`}
                                    className="flex shrink-0 items-center gap-2.5 sm:w-44"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-k-border-subtle bg-surface-inset text-[11px] font-semibold text-k-text-secondary">
                                        {r.studentName.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="truncate text-sm font-semibold text-k-text-primary">{r.studentName}</span>
                                </Link>
                                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                                    {r.plan
                                        ? <PlanCell plan={r.plan} studentId={r.studentId} />
                                        : <div className="flex-1 rounded-control border border-dashed border-k-border-subtle px-3 py-2 text-[11px] text-k-text-quaternary">Sem plano ativo</div>}
                                    {r.program
                                        ? <ProgramCell program={r.program} studentId={r.studentId} />
                                        : <div className="flex-1 rounded-control border border-dashed border-k-border-subtle px-3 py-2 text-[11px] text-k-text-quaternary">Sem treino com prazo</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </AppLayout>
    )
}

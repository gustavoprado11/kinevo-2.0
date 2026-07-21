'use client'

import { memo } from 'react'
import { Check } from 'lucide-react'
import Link from 'next/link'
import type { ExpiringProgramItem } from '@/lib/dashboard/get-dashboard-data'

interface ExpiringProgramsProps {
    programs: ExpiringProgramItem[]
}

// Redesign "ferramenta profissional": painel hairline sem sombra, header em
// mono micro-caps com contagem tabular, avatar neutro (tinta sobre inset),
// urgência em âmbar (cor só no estado) e violeta apenas na ação da linha.

export const ExpiringPrograms = memo(function ExpiringPrograms({ programs }: ExpiringProgramsProps) {
    return (
        <section className="flex flex-col rounded-panel border border-k-border-subtle bg-surface-card">
            {/* Header */}
            <div className="flex items-baseline gap-2 border-b border-k-border-subtle px-5 py-3">
                <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Programas encerrando
                </h2>
                {programs.length > 0 && (
                    <span className="font-mono text-[10.5px] tabular-nums text-k-text-quaternary">
                        {programs.length}
                    </span>
                )}
            </div>

            {/* Rows */}
            {programs.length === 0 ? (
                <div className="py-8 text-center">
                    <div className="mb-3 flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-surface-inset">
                        <Check className="h-4 w-4 text-k-text-tertiary" strokeWidth={2} />
                    </div>
                    <p className="text-[13px] text-k-text-secondary">Nenhum programa encerrando</p>
                    <p className="text-xs text-k-text-quaternary mt-1">Programas próximos ao vencimento aparecerão aqui</p>
                </div>
            ) : (
                <div className="divide-y divide-k-border-subtle">
                    {programs.map((p) => {
                        const urgent = p.endsInDays <= 1
                        return (
                            <Link
                                key={p.programId}
                                href={`/students/${p.studentId}`}
                                className="group flex w-full items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-inset/60"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-8 w-8 shrink-0 rounded-full border border-k-border-subtle bg-surface-inset flex items-center justify-center">
                                        <span className="text-[11px] font-semibold text-k-text-secondary">
                                            {p.studentName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm font-semibold text-k-text-primary block truncate">{p.studentName}</span>
                                        <span className="text-xs text-k-text-tertiary block truncate">
                                            {p.programName}
                                            {' · '}
                                            <span className="tabular-nums">Semana {p.currentWeek}/{p.totalWeeks}</span>
                                            {' · '}
                                            <span className={urgent ? 'text-amber-600 dark:text-amber-400 font-medium' : undefined}>
                                                {p.endsInDays <= 0
                                                    ? 'Encerrou'
                                                    : `Termina em ${p.endsInDays} dia${p.endsInDays > 1 ? 's' : ''}`
                                                }
                                            </span>
                                        </span>
                                    </div>
                                </div>
                                <span className="shrink-0 text-[12px] font-medium text-primary opacity-90 group-hover:opacity-100 transition-opacity">
                                    {p.endsInDays <= 0 ? 'Criar próximo' : 'Renovar'} →
                                </span>
                            </Link>
                        )
                    })}
                </div>
            )}
        </section>
    )
})

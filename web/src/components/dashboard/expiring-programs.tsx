'use client'

import { Calendar } from 'lucide-react'
import Link from 'next/link'
import type { ExpiringProgramItem } from '@/lib/dashboard/get-dashboard-data'

interface ExpiringProgramsProps {
    programs: ExpiringProgramItem[]
}

export function ExpiringPrograms({ programs }: ExpiringProgramsProps) {
    if (programs.length === 0) return null

    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            {/* Header — matches DailyActivityFeed pattern */}
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Programas encerrando</h2>
                    <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded">
                        {programs.length}
                    </span>
                </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#E8E8ED] dark:divide-border">
                {programs.map((p) => (
                    <Link
                        key={p.programId}
                        href={`/students/${p.studentId}`}
                        className="group flex w-full items-center justify-between px-6 py-4 transition-all hover:bg-[#F5F5F7] dark:hover:bg-muted/50"
                    >
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="h-10 w-10 shrink-0 rounded-full border border-[#E8E8ED] dark:border-border bg-[#F5F5F7] dark:bg-muted flex items-center justify-center">
                                <span className="text-sm font-bold text-[#007AFF] dark:text-primary">
                                    {p.studentName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-foreground block truncate">{p.studentName}</span>
                                <span className="text-xs text-[#86868B] dark:text-muted-foreground block">
                                    {p.programName} · Semana {p.currentWeek}/{p.totalWeeks}
                                    {' · '}
                                    {p.endsInDays <= 0
                                        ? 'Encerrou'
                                        : `Termina em ${p.endsInDays} dia${p.endsInDays > 1 ? 's' : ''}`
                                    }
                                </span>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-[#007AFF] dark:text-violet-400 group-hover:text-[#0056B3] dark:group-hover:text-violet-300 transition-colors flex-shrink-0 flex items-center gap-1">
                            <Calendar size={12} />
                            {p.endsInDays <= 0 ? 'Criar próximo' : 'Renovar'} →
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

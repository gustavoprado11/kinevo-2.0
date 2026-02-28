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
        <div className="mb-6">
            <h2 className="text-sm font-semibold text-k-text-primary mb-3">Programas encerrando</h2>
            <div className="space-y-1.5">
                {programs.map(p => (
                    <Link
                        key={p.programId}
                        href={`/students/${p.studentId}`}
                        className="flex items-center justify-between p-3 rounded-xl border border-k-border-primary bg-surface-card hover:border-violet-500/30 transition-colors group"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full border border-k-border-subtle bg-glass-bg flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-k-text-secondary">
                                    {p.studentName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-sm text-k-text-primary block truncate">{p.studentName}</span>
                                <span className="text-xs text-k-text-quaternary block">
                                    {p.programName} · Semana {p.currentWeek}/{p.totalWeeks}
                                    {' · '}
                                    {p.endsInDays <= 0
                                        ? 'Encerrou'
                                        : `Termina em ${p.endsInDays} dia${p.endsInDays > 1 ? 's' : ''}`
                                    }
                                </span>
                            </div>
                        </div>
                        <span className="text-xs text-violet-400 group-hover:text-violet-300 px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors flex-shrink-0 flex items-center gap-1">
                            <Calendar size={12} />
                            {p.endsInDays <= 0 ? 'Criar próximo' : 'Renovar'} →
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

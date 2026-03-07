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
            <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary mb-3">Programas encerrando</h2>
            <div className="bg-white dark:bg-transparent rounded-xl border border-[#D2D2D7] dark:border-transparent shadow-apple-card dark:shadow-none overflow-hidden">
                {programs.map((p, index) => (
                    <Link
                        key={p.programId}
                        href={`/students/${p.studentId}`}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors group ${
                            index < programs.length - 1 ? 'border-b border-[#E8E8ED] dark:border-k-border-subtle' : ''
                        }`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full border border-[#E8E8ED] dark:border-k-border-subtle bg-[#F5F5F7] dark:bg-glass-bg flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-[#6E6E73] dark:text-k-text-secondary">
                                    {p.studentName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <span className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary block truncate">{p.studentName}</span>
                                <span className="text-xs text-[#86868B] dark:text-k-text-quaternary block">
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

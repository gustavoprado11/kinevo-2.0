'use client'

import { Trophy, Flame } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'

export interface RankedStudent {
    id: string
    name: string
    avatarUrl?: string | null
    sessionsThisWeek: number
    streak: number   // consecutive days trained
}

interface StudentRankingWidgetProps {
    students: RankedStudent[]
}

const medalColors = [
    'text-amber-500',  // gold
    'text-[#AEAEB2]',  // silver
    'text-amber-700',  // bronze
]

export function StudentRankingWidget({ students }: StudentRankingWidgetProps) {
    // Sort by sessions desc, then by streak desc
    const ranked = [...students]
        .sort((a, b) => b.sessionsThisWeek - a.sessionsThisWeek || b.streak - a.streak)
        .slice(0, 5)

    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Ranking de alunos</h2>
                    <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded">
                        Esta semana
                    </span>
                </div>
            </div>

            {ranked.length === 0 ? (
                <div className="py-8 text-center">
                    <p className="text-sm text-[#6E6E73] dark:text-k-text-secondary">Nenhum treino registrado ainda</p>
                </div>
            ) : (
                <div className="divide-y divide-[#E8E8ED] dark:divide-border">
                    {ranked.map((student, index) => (
                        <motion.div
                            key={student.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            className="flex items-center gap-3 px-6 py-3"
                        >
                            {/* Position */}
                            <span className={`w-5 text-center text-sm font-bold ${
                                index < 3 ? (medalColors[index]) : 'text-[#AEAEB2] dark:text-k-text-quaternary'
                            }`}>
                                {index + 1}
                            </span>

                            {/* Avatar */}
                            {student.avatarUrl ? (
                                <Image src={student.avatarUrl} alt={student.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                            ) : (
                                <div className="h-8 w-8 shrink-0 rounded-full bg-[#F5F5F7] dark:bg-muted border border-[#E8E8ED] dark:border-border flex items-center justify-center">
                                    <span className="text-xs font-bold text-[#007AFF] dark:text-primary">
                                        {student.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-[#1D1D1F] dark:text-foreground truncate block">
                                    {student.name}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-3 shrink-0">
                                {student.streak > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                        <Flame className="w-3 h-3" />
                                        {student.streak}d
                                    </span>
                                )}
                                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-foreground">
                                    {student.sessionsThisWeek} <span className="font-normal text-[#AEAEB2] dark:text-k-text-quaternary">treinos</span>
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    )
}

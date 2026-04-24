'use client'

import { memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trophy, Flame, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export interface RankedStudent {
    studentId: string
    studentName: string
    studentAvatar: string | null
    completed: number
    expected: number
    adherence: number  // 0..1
    streak: number
}

interface StudentRankingWidgetProps {
    students: RankedStudent[]
}

// ── Tokens ──

// Podium tier tokens: gold / silver / bronze.
const podium = [
    {
        label: '1º',
        ring: 'ring-amber-300 dark:ring-amber-400/60',
        medalBg: 'bg-gradient-to-br from-amber-300 to-amber-500',
        medalText: 'text-amber-950',
        cardBg: 'bg-gradient-to-b from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent',
        border: 'border-amber-200 dark:border-amber-400/30',
        height: 'h-[132px]',
        order: 'order-2',
    },
    {
        label: '2º',
        ring: 'ring-slate-300 dark:ring-slate-300/50',
        medalBg: 'bg-gradient-to-br from-slate-200 to-slate-400',
        medalText: 'text-slate-900',
        cardBg: 'bg-gradient-to-b from-slate-50 to-white dark:from-slate-400/10 dark:to-transparent',
        border: 'border-slate-200 dark:border-slate-400/30',
        height: 'h-[112px]',
        order: 'order-1',
    },
    {
        label: '3º',
        ring: 'ring-orange-300 dark:ring-orange-400/50',
        medalBg: 'bg-gradient-to-br from-orange-300 to-orange-500',
        medalText: 'text-orange-950',
        cardBg: 'bg-gradient-to-b from-orange-50 to-white dark:from-orange-500/10 dark:to-transparent',
        border: 'border-orange-200 dark:border-orange-400/30',
        height: 'h-[100px]',
        order: 'order-3',
    },
]

// ── Helpers ──

function initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}

function formatAdherence(adherence: number, expected: number): string {
    if (expected === 0) return '—'
    return `${Math.round(adherence * 100)}%`
}

// ── Component ──

export const StudentRankingWidget = memo(function StudentRankingWidget({ students }: StudentRankingWidgetProps) {
    const top3 = students.slice(0, 3)
    const rest = students.slice(3, 8)

    return (
        <div className="flex flex-col rounded-xl border border-[#D2D2D7] dark:border-k-border-primary bg-white dark:bg-surface-card shadow-apple-card dark:shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle px-6 py-4">
                <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-primary">Ranking de alunos</h2>
                    <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary bg-[#F5F5F7] dark:bg-glass-bg px-1.5 py-0.5 rounded">
                        Esta semana
                    </span>
                </div>
                <span className="text-[11px] text-[#AEAEB2] dark:text-k-text-quaternary hidden sm:inline">
                    por aderência
                </span>
            </div>

            {students.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* Podium — top 3 */}
                    {top3.length > 0 && (
                        <div className="px-4 pt-6 pb-4">
                            <div className="flex items-end justify-center gap-3">
                                {top3.map((student, idx) => {
                                    const tier = podium[idx]
                                    return (
                                        <PodiumCard
                                            key={student.studentId}
                                            student={student}
                                            tier={tier}
                                            rank={idx + 1}
                                            delay={idx * 0.08}
                                        />
                                    )
                                })}

                                {/* Fill phantom slots so the podium keeps its shape with 1 or 2 students */}
                                {top3.length < 2 && <div className="w-[88px] order-1" aria-hidden />}
                                {top3.length < 3 && <div className="w-[88px] order-3" aria-hidden />}
                            </div>
                        </div>
                    )}

                    {/* Rest — 4º onwards */}
                    {rest.length > 0 && (
                        <div className="border-t border-[#E8E8ED] dark:border-k-border-subtle divide-y divide-[#E8E8ED] dark:divide-k-border-subtle">
                            {rest.map((student, idx) => (
                                <motion.div
                                    key={student.studentId}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + idx * 0.05, duration: 0.25 }}
                                >
                                    <Link
                                        href={`/students/${student.studentId}`}
                                        className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#F5F5F7] dark:hover:bg-glass-bg transition-colors"
                                    >
                                        <span className="w-5 text-center text-[11px] font-semibold text-[#AEAEB2] dark:text-k-text-quaternary">
                                            {idx + 4}º
                                        </span>
                                        <Avatar student={student} size={28} ring={null} />
                                        <span className="flex-1 min-w-0 text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary truncate">
                                            {student.studentName}
                                        </span>
                                        {student.streak > 1 && (
                                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                <Flame className="w-3 h-3" aria-hidden="true" />
                                                {student.streak}d
                                            </span>
                                        )}
                                        <span className="text-xs font-semibold text-[#1D1D1F] dark:text-k-text-primary w-9 text-right tabular-nums">
                                            {formatAdherence(student.adherence, student.expected)}
                                        </span>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
})

// ── Podium Card ──

function PodiumCard({
    student,
    tier,
    rank,
    delay,
}: {
    student: RankedStudent
    tier: typeof podium[number]
    rank: number
    delay: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3, ease: 'easeOut' }}
            className={`${tier.order} w-[92px] sm:w-[104px]`}
        >
            <Link
                href={`/students/${student.studentId}`}
                className="group flex flex-col items-center"
            >
                {/* Avatar + medal */}
                <div className="relative mb-1.5">
                    <Avatar student={student} size={46} ring={tier.ring} />
                    <span
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${tier.medalBg} ${tier.medalText} text-[10px] font-bold flex items-center justify-center shadow`}
                        aria-label={`${rank}º lugar`}
                    >
                        {rank}
                    </span>
                </div>

                {/* Name */}
                <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-k-text-primary max-w-full truncate text-center group-hover:text-[#007AFF] dark:group-hover:text-blue-400 transition-colors">
                    {student.studentName.split(' ')[0]}
                </span>

                {/* Streak (tiny, above card) */}
                {student.streak > 1 ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                        <Flame className="w-3 h-3" aria-hidden="true" />
                        {student.streak}d
                    </span>
                ) : (
                    <span className="h-[14px] mt-0.5" aria-hidden />
                )}

                {/* Pedestal */}
                <div className={`mt-1.5 w-full ${tier.height} ${tier.cardBg} ${tier.border} border rounded-lg flex flex-col items-center justify-center gap-0.5 transition-transform duration-200 group-hover:-translate-y-0.5`}>
                    <span className="text-base font-bold text-[#1D1D1F] dark:text-k-text-primary tabular-nums">
                        {formatAdherence(student.adherence, student.expected)}
                    </span>
                    <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary tabular-nums">
                        {student.completed}/{student.expected || '—'} treinos
                    </span>
                </div>
            </Link>
        </motion.div>
    )
}

// ── Avatar ──

function Avatar({
    student,
    size,
    ring,
}: {
    student: RankedStudent
    size: number
    ring: string | null
}) {
    const ringClass = ring ? `ring-2 ${ring}` : ''
    if (student.studentAvatar) {
        return (
            <Image
                src={student.studentAvatar}
                alt={student.studentName}
                width={size}
                height={size}
                className={`rounded-full object-cover ${ringClass}`}
                style={{ width: size, height: size }}
                unoptimized
            />
        )
    }
    return (
        <div
            className={`rounded-full bg-gradient-to-br from-[#007AFF]/10 to-violet-500/10 dark:from-violet-500/20 dark:to-blue-500/20 flex items-center justify-center shrink-0 ${ringClass}`}
            style={{ width: size, height: size }}
        >
            <span className="text-[11px] font-bold text-[#007AFF] dark:text-violet-300">
                {initials(student.studentName)}
            </span>
        </div>
    )
}

// ── Empty State ──

function EmptyState() {
    return (
        <div className="py-10 px-6 text-center flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#1D1D1F] dark:text-k-text-primary">
                O ranking começa quando os alunos treinam
            </p>
            <p className="text-xs text-[#86868B] dark:text-k-text-tertiary max-w-[260px]">
                Assim que houver treinos feitos esta semana, os alunos aparecem aqui ordenados por aderência.
            </p>
        </div>
    )
}

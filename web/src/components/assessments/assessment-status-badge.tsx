'use client'

import { Calendar, CheckCircle2, CircleDot, XCircle } from 'lucide-react'
import type { AssessmentSessionStatus } from '@kinevo/shared/types/assessments'

interface AssessmentStatusBadgeProps {
    status: AssessmentSessionStatus
    overdue?: boolean
    size?: 'sm' | 'md'
}

const STATUS_LABELS: Record<AssessmentSessionStatus, string> = {
    scheduled: 'Agendada',
    in_progress: 'Em andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
}

export function AssessmentStatusBadge({ status, overdue, size = 'sm' }: AssessmentStatusBadgeProps) {
    const isOverdue = overdue && status === 'scheduled'
    const Icon =
        status === 'completed' ? CheckCircle2
        : status === 'cancelled' ? XCircle
        : status === 'in_progress' ? CircleDot
        : Calendar

    const cls =
        status === 'completed'
            ? 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400'
        : status === 'cancelled'
            ? 'bg-k-text-quaternary/10 text-k-text-tertiary ring-1 ring-k-border-subtle'
        : isOverdue
            ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
        : status === 'in_progress'
            ? 'bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20 dark:text-violet-400'
            : 'bg-violet-500/8 text-violet-500 ring-1 ring-violet-500/15 dark:text-violet-400'

    const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
    const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

    return (
        <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding} ${cls}`}>
            <Icon className={iconSize} />
            {isOverdue ? 'Em atraso' : STATUS_LABELS[status]}
        </span>
    )
}

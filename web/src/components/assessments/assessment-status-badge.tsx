'use client'

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

// Redesign "ferramenta profissional": status = ponto + texto (cor só semântica),
// não mais badge com fundo + anel + ícone. Violeta saiu do status.
export function AssessmentStatusBadge({ status, overdue, size = 'sm' }: AssessmentStatusBadgeProps) {
    const isOverdue = overdue && status === 'scheduled'

    const dotClass =
        status === 'completed' ? 'bg-emerald-500'
        : status === 'cancelled' ? 'bg-k-text-quaternary'
        : isOverdue ? 'bg-red-500'
        : status === 'in_progress' ? 'bg-k-text-primary'
        : 'bg-k-text-tertiary'

    const textClass =
        isOverdue ? 'text-red-600 dark:text-red-400'
        : status === 'completed' ? 'text-k-text-secondary'
        : status === 'in_progress' ? 'text-k-text-secondary'
        : 'text-k-text-tertiary'

    const textSize = size === 'md' ? 'text-[11px]' : 'text-[10px]'

    return (
        <span className={`inline-flex items-center gap-1.5 font-medium ${textSize} ${textClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {isOverdue ? 'Em atraso' : STATUS_LABELS[status]}
        </span>
    )
}

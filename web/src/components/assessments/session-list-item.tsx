'use client'

import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import type { AssessmentSessionListItem } from '@kinevo/shared/types/assessments'
import { AssessmentStatusBadge } from './assessment-status-badge'

interface SessionListItemProps {
    session: AssessmentSessionListItem
    onClick: () => void
}

const TIMEZONE = 'America/Sao_Paulo'

function formatDate(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: TIMEZONE,
    })
}

function formatTime(value: string | null): string {
    if (!value) return ''
    return new Date(value).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIMEZONE,
    })
}

export function SessionListItem({ session, onClick }: SessionListItemProps) {
    const isOverdue =
        session.status === 'scheduled'
        && session.scheduled_at != null
        && new Date(session.scheduled_at).getTime() < Date.now()

    const dateStr = session.completed_at
        ? formatDate(session.completed_at)
        : formatDate(session.scheduled_at)
    const timeStr = session.completed_at
        ? formatTime(session.completed_at)
        : formatTime(session.scheduled_at)

    const bf = session.computed_metrics?.body_fat_percent
    const bmi = session.computed_metrics?.bmi
    const summary =
        session.status === 'completed' && (bf != null || bmi != null)
            ? [
                bmi != null ? `IMC ${bmi.toFixed(1).replace('.', ',')}` : null,
                bf != null ? `${bf.toFixed(1).replace('.', ',')}% BG` : null,
            ].filter(Boolean).join(' · ')
            : null

    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex w-full items-center justify-between px-5 py-3 text-left transition-all hover:bg-[#F5F5F7] dark:hover:bg-glass-bg"
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D2D2D7] bg-[#F5F5F7] dark:border-k-border-primary dark:bg-glass-bg">
                    {session.student_avatar ? (
                        <Image
                            src={session.student_avatar}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
                            unoptimized
                        />
                    ) : (
                        <span className="text-[10px] font-semibold text-[#1D1D1F] dark:text-k-text-primary">
                            {(session.student_name || '?').charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-[#1D1D1F] dark:text-k-text-secondary group-hover:text-[#1D1D1F] dark:group-hover:text-k-text-primary transition-colors">
                            {session.student_name || 'Aluno'}
                        </p>
                        <AssessmentStatusBadge status={session.status} overdue={isOverdue} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#86868B] dark:text-k-text-quaternary">
                        {session.template_title || 'Avaliação'}
                        {dateStr ? ` · ${dateStr}` : ''}
                        {timeStr ? ` ${timeStr}` : ''}
                        {summary ? ` · ${summary}` : ''}
                    </p>
                </div>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-k-border-subtle group-hover:text-k-text-tertiary transition-all" />
        </button>
    )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Smartphone, XCircle } from 'lucide-react'
import type { AssessmentSessionDetail } from '@kinevo/shared/types/assessments'
import { cancelAssessmentSession } from '@/actions/assessments/cancel-session'
import { useToast } from '@/components/ui/toast'
import { AssessmentStatusBadge } from '@/components/assessments/assessment-status-badge'
import { SessionChecklistCard } from '@/components/assessments/view/session-checklist-card'

interface SessionDetailClientProps {
    detail: AssessmentSessionDetail
    studentId: string
}

const TIMEZONE = 'America/Sao_Paulo'

function formatDateTime(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIMEZONE,
    })
}

export function SessionDetailClient({ detail, studentId }: SessionDetailClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [confirming, setConfirming] = useState(false)
    const [pending, startTransition] = useTransition()

    const session = detail.session
    const student = detail.student
    const template = detail.template

    const isOverdue =
        session.status === 'scheduled'
        && session.scheduled_at != null
        && new Date(session.scheduled_at).getTime() < Date.now()

    const handleCancel = async () => {
        const result = await cancelAssessmentSession({ sessionId: session.id })
        if (result.success) {
            toast({ type: 'success', message: 'Avaliação cancelada' })
            router.push('/forms?tab=assessments')
            router.refresh()
        } else {
            toast({ type: 'error', message: result.error ?? 'Erro ao cancelar' })
        }
        setConfirming(false)
    }

    const canCancel = session.status === 'scheduled' || session.status === 'in_progress'

    return (
        <div className="mx-auto max-w-4xl">
            {/* Back */}
            <button
                onClick={() => router.push('/forms?tab=assessments')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-k-text-secondary hover:text-k-text-primary"
            >
                <ArrowLeft className="h-4 w-4" />
                Voltar para Avaliações
            </button>

            {/* Header */}
            <div className="mb-6 flex items-start gap-4 rounded-2xl border border-k-border-subtle bg-surface-card p-5">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-k-border-subtle bg-surface-inset">
                    {student.avatar_url ? (
                        <Image
                            src={student.avatar_url}
                            alt=""
                            width={56}
                            height={56}
                            className="h-14 w-14 rounded-full object-cover"
                            unoptimized
                        />
                    ) : (
                        <span className="text-lg font-semibold text-k-text-secondary">
                            {(student.name || '?').charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <button
                        onClick={() => router.push(`/students/${studentId}`)}
                        className="text-base font-semibold text-k-text-primary hover:text-violet-500 dark:hover:text-violet-400"
                    >
                        {student.name}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-k-text-tertiary">
                        <span>{template?.title ?? 'Avaliação'}</span>
                        <span>·</span>
                        <AssessmentStatusBadge status={session.status} overdue={isOverdue} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-k-text-secondary">
                        {session.scheduled_at && (
                            <span>
                                <span className="text-k-text-tertiary">Agendada: </span>
                                {formatDateTime(session.scheduled_at)}
                            </span>
                        )}
                        {session.started_at && (
                            <span>
                                <span className="text-k-text-tertiary">Iniciada: </span>
                                {formatDateTime(session.started_at)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    {canCancel && !confirming && (
                        <button
                            onClick={() => setConfirming(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:border-red-500/40 hover:text-red-500"
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar
                        </button>
                    )}
                    {confirming && (
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setConfirming(false)}
                                disabled={pending}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-k-text-secondary hover:bg-surface-inset"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={() => startTransition(handleCancel)}
                                disabled={pending}
                                className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                Confirmar cancelamento
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Capture hint */}
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3">
                <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500 dark:text-violet-400" />
                <div className="text-xs text-k-text-secondary">
                    <p className="font-medium text-k-text-primary">Captura via app mobile</p>
                    <p className="mt-0.5">
                        Abra esta sessão no app Kinevo (Avaliações &gt; {student.name}) para registrar
                        as medições com checklist guiado, cálculos automáticos e captura presencial.
                    </p>
                </div>
            </div>

            {/* Checklist */}
            <SessionChecklistCard
                schema={template?.schema_json ?? null}
                measurements={detail.measurements}
            />

            {session.notes && (
                <div className="mt-5 rounded-2xl border border-k-border-subtle bg-surface-card p-5">
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                        Observações
                    </h4>
                    <p className="whitespace-pre-wrap text-sm text-k-text-primary">{session.notes}</p>
                </div>
            )}
        </div>
    )
}

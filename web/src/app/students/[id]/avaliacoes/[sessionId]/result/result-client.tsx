'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react'
import type {
    AssessmentSessionDetail,
    AssessmentSessionListItem,
} from '@kinevo/shared/types/assessments'
import type { Sex } from '@kinevo/shared/lib/assessment-protocols'
import { parseFilenameFromHeader } from '@kinevo/shared/lib/http/parseFilename'
import { useToast } from '@/components/ui/toast'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import { ResultStatsCardWeb } from '@/components/assessments/view/result-stats-card-web'
import { ResultComparisonTable } from '@/components/assessments/view/result-comparison-table'
import { HistoryMiniChartWeb } from '@/components/assessments/view/history-mini-chart-web'

interface ResultClientProps {
    detail: AssessmentSessionDetail
    studentId: string
    history: AssessmentSessionListItem[]
}

const TIMEZONE = 'America/Sao_Paulo'

function formatDate(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: TIMEZONE,
    })
}

/**
 * Read the subject sex from the session's measurements (mirrors the mobile
 * pattern in mobile/lib/assessmentComputed.ts: SUBJECT_SEX_KEY = 'subject_sex').
 */
function readSubjectSex(detail: AssessmentSessionDetail): Sex | null {
    for (let i = detail.measurements.length - 1; i >= 0; i--) {
        const m = detail.measurements[i]!
        if (m.metric_key === 'subject_sex' && typeof m.value_text === 'string') {
            if (m.value_text === 'male' || m.value_text === 'female') return m.value_text
        }
    }
    return null
}

export function ResultClient({ detail, studentId, history }: ResultClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isGenerating, setIsGenerating] = useState(false)
    const session = detail.session
    const student = detail.student
    const sex = readSubjectSex(detail)

    // PDF download only makes sense for completed sessions (the Edge Function
    // also enforces this for student access; for trainers we hide the button
    // pre-completion to avoid generating a half-empty laudo).
    const canDownloadPdf = session.status === 'completed'

    const handleShareReport = async () => {
        if (isGenerating) return
        setIsGenerating(true)
        try {
            const supabase = createBrowserSupabase()
            const { data: { session: authSession } } = await supabase.auth.getSession()
            if (!authSession?.access_token) {
                throw new Error('Sessão expirada. Faça login novamente.')
            }

            const url = process.env.NEXT_PUBLIC_SUPABASE_URL
            if (!url) throw new Error('Configuração inválida')

            const res = await fetch(`${url}/functions/v1/generate-assessment-pdf`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authSession.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ session_id: session.id }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'unknown' })) as { error?: string }
                const message =
                    err.error === 'forbidden' ? 'Sem permissão para gerar este laudo.'
                    : err.error === 'session_not_found' ? 'Sessão não encontrada.'
                    : 'Falha ao gerar o laudo. Tente novamente em instantes.'
                throw new Error(message)
            }

            const blob = await res.blob()
            const filename = parseFilenameFromHeader(res.headers.get('content-disposition'))
                ?? `laudo-${session.id}.pdf`
            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = filename
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(objectUrl)

            toast({ type: 'success', message: 'Laudo baixado.' })
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Erro inesperado'
            toast({ type: 'error', message })
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="mx-auto max-w-4xl">
            <button
                onClick={() => router.push('/avaliacoes')}
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
                    <p className="mt-1 text-xs text-k-text-tertiary">
                        Avaliação concluída em {formatDate(session.completed_at)}
                    </p>
                </div>
                {canDownloadPdf && (
                    <button
                        onClick={handleShareReport}
                        disabled={isGenerating}
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:border-violet-500/40 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-violet-400"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <FileDown className="h-3.5 w-3.5" />
                        )}
                        {isGenerating ? 'Gerando…' : 'Compartilhar laudo (PDF)'}
                    </button>
                )}
            </div>

            {/* Stats */}
            <ResultStatsCardWeb metrics={session.computed_metrics} sex={sex} />

            {/* Sparklines */}
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <HistoryMiniChartWeb
                    sessions={history}
                    metric="body_fat_percent"
                    label="% Gordura ao longo do tempo"
                    suffix="%"
                    digits={1}
                    betterDirection="down"
                />
                <HistoryMiniChartWeb
                    sessions={history}
                    metric="bmi"
                    label="IMC ao longo do tempo"
                    digits={1}
                    betterDirection="down"
                />
            </div>

            {/* Comparison */}
            <div className="mt-5">
                <ResultComparisonTable sessions={history} />
            </div>

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

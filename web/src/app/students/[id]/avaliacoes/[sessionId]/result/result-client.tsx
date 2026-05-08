'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, FileDown, Info } from 'lucide-react'
import type {
    AssessmentSessionDetail,
    AssessmentSessionListItem,
} from '@kinevo/shared/types/assessments'
import type { Sex } from '@kinevo/shared/lib/assessment-protocols'
import { useToast } from '@/components/ui/toast'
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
    const [pdfPlaceholderVisible, setPdfPlaceholderVisible] = useState(false)
    const session = detail.session
    const student = detail.student
    const sex = readSubjectSex(detail)

    const handleShareReport = () => {
        // PDF generation is a future-milestone feature. Surface both an inline
        // disclosure (persistent, can't be missed if the toast scrolls out of
        // viewport on long pages) and a toast for redundant feedback.
        setPdfPlaceholderVisible(true)
        toast({
            type: 'success',
            message: 'Geração de PDF chega em uma próxima atualização.',
        })
    }

    return (
        <div className="mx-auto max-w-4xl">
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
                    <p className="mt-1 text-xs text-k-text-tertiary">
                        Avaliação concluída em {formatDate(session.completed_at)}
                    </p>
                </div>
                <button
                    onClick={handleShareReport}
                    aria-pressed={pdfPlaceholderVisible}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-k-border-subtle bg-surface-card px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:border-violet-500/40 hover:text-violet-500 dark:hover:text-violet-400"
                >
                    <FileDown className="h-3.5 w-3.5" />
                    Compartilhar laudo (PDF)
                </button>
            </div>

            {/* PDF placeholder disclosure — persistent so the user can't miss
                the response to clicking the button, even on long pages where
                the bottom-right toast may scroll out of view. */}
            {pdfPlaceholderVisible && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500 dark:text-violet-400" />
                    <div className="flex-1 text-xs text-k-text-secondary">
                        <p className="font-medium text-k-text-primary">
                            Geração de PDF em desenvolvimento
                        </p>
                        <p className="mt-0.5">
                            O laudo em PDF chega em uma próxima atualização. Por enquanto, você pode
                            tirar um print ou compartilhar o link desta página com o aluno.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPdfPlaceholderVisible(false)}
                        aria-label="Fechar aviso"
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-k-text-tertiary hover:bg-violet-500/10 hover:text-k-text-primary"
                    >
                        Ok
                    </button>
                </div>
            )}

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

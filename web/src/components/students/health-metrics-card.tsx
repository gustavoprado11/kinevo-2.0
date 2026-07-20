'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    FileCheck,
    Loader2,
    Plus,
    Ruler,
    Send,
} from 'lucide-react'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { getSubmissionResponses, type SubmissionResponses } from '@/actions/forms/get-submission-responses'
import { sendFormFeedback } from '@/actions/forms/send-form-feedback'
import { CheckinResponsesViewer } from '@/components/forms/checkin-responses-viewer'
import { ActiveSchedulesList } from './active-schedules-list'
import { useToast } from '@/components/ui/toast'
import { BodyMetricsTrend } from './body-metrics-trend'
import type { FormScheduleRow } from '@/actions/forms/form-schedules'
import type { AssessmentSessionListItem } from '@kinevo/shared/types/assessments'
import { classifyBMI } from '@kinevo/shared/lib/assessment-protocols'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LastSubmission {
    id: string
    templateTitle: string
    templateCategory: string
    submittedAt: string
}

interface PendingForm {
    id: string
    title: string
    status: string
    createdAt: string
}

interface BodyMetrics {
    weight: string | null
    bodyFat: string | null
    updatedAt: string | null
}

interface FormTemplate {
    id: string
    title: string
    category: string
}

interface BodyMetricsHistoryPoint {
    weight: number | null
    bodyFat: number | null
    date: string
}

interface HealthMetricsCardProps {
    studentId: string
    lastSubmission: LastSubmission | null
    pendingForms: PendingForm[]
    bodyMetrics: BodyMetrics | null
    bodyMetricsHistory?: BodyMetricsHistoryPoint[]
    formTemplates: FormTemplate[]
    formSchedules?: FormScheduleRow[]
    latestPresencialSession?: AssessmentSessionListItem | null
    /**
     * Onda 3 — Quando o `SmartBanner` está exibindo `reassessment_due`,
     * o card esconde seu próprio banner amarelo de reavaliação pendente
     * pra evitar duplicação visual. Demais elementos (lista de pendingForms,
     * accordion de schedules) seguem inalterados.
     */
    hideReassessmentBanner?: boolean
}

const categoryLabels: Record<string, string> = {
    anamnese: 'Anamnese',
    checkin: 'Check-in',
    survey: 'Pesquisa',
}

const TIMEZONE = 'America/Sao_Paulo'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Card unificado de Saúde & métricas (Onda 2 do redesign).
 *
 * Reúne: avaliação presencial mais recente, peso/% de gordura com sparkline,
 * formulários pendentes, agenda de reavaliações e dropdown pra enviar um novo
 * formulário. Redesign "ferramenta profissional": painel hairline, eyebrow
 * mono, números tabulares e cor apenas como estado (pendências/vencidas).
 */
export function HealthMetricsCard({
    studentId,
    lastSubmission,
    pendingForms,
    bodyMetrics,
    bodyMetricsHistory = [],
    formTemplates,
    formSchedules = [],
    latestPresencialSession = null,
    hideReassessmentBanner = false,
}: HealthMetricsCardProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [sending, setSending] = useState(false)
    const [schedulesExpanded, setSchedulesExpanded] = useState(false)
    // Visualização inline das respostas da última avaliação (sem sair da tela).
    const [viewer, setViewer] = useState<SubmissionResponses | null>(null)
    const [loadingViewer, setLoadingViewer] = useState(false)

    const handleViewSubmission = async () => {
        if (!lastSubmission || loadingViewer) return
        setLoadingViewer(true)
        try {
            const result = await getSubmissionResponses(lastSubmission.id)
            if (result.success && result.data) {
                setViewer(result.data)
            } else {
                toast({ message: result.error || 'Não foi possível carregar as respostas', type: 'error' })
            }
        } catch {
            toast({ message: 'Não foi possível carregar as respostas', type: 'error' })
        } finally {
            setLoadingViewer(false)
        }
    }

    const handleSendForm = async (templateId: string) => {
        setSending(true)
        setDropdownOpen(false)
        try {
            const result = await assignFormToStudents({
                formTemplateId: templateId,
                studentIds: [studentId],
            })
            if (result.success) {
                router.refresh()
            } else {
                toast({ message: result.error || 'Erro ao enviar formulário', type: 'error' })
            }
        } catch {
            toast({ message: 'Erro ao enviar formulário', type: 'error' })
        } finally {
            setSending(false)
        }
    }

    const pendingCount = pendingForms.length
    const hasBodyMetrics = !!(bodyMetrics?.weight || bodyMetrics?.bodyFat)
    const hasTrend = bodyMetricsHistory.length >= 2 && hasBodyMetrics

    // Banner "Reavaliação periódica · pendente" — dispara quando há pendências
    // ou quando alguma agenda recorrente vence em até 7 dias (inclusive vencidas).
    const now = Date.now()
    const sevenDaysAhead = now + SEVEN_DAYS_MS
    const dueSchedules = formSchedules.filter((s) => {
        if (!s.is_active) return false
        const due = new Date(s.next_due_at).getTime()
        return Number.isFinite(due) && due <= sevenDaysAhead
    })
    const showReassessmentBanner =
        !hideReassessmentBanner && (pendingCount > 0 || dueSchedules.length > 0)
    const hasOverdue = dueSchedules.some((s) => new Date(s.next_due_at).getTime() < now)

    const hasData =
        !!lastSubmission ||
        pendingCount > 0 ||
        formSchedules.length > 0 ||
        hasBodyMetrics ||
        !!latestPresencialSession

    // -------------------------------------------------------------------------
    // Empty state
    // -------------------------------------------------------------------------
    if (!hasData) {
        return (
            <div
                className={`bg-surface-card rounded-panel border border-k-border-subtle p-5 ${
                    dropdownOpen ? 'relative z-sidebar' : ''
                }`}
                data-testid="health-metrics-card"
            >
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Saúde &amp; métricas
                </span>
                <p className="text-[11.5px] text-k-text-quaternary mt-2 mb-3">
                    Sem avaliações. Envie um formulário pra conhecer melhor o aluno.
                </p>
                <SendButton
                    label="Enviar avaliação"
                    formTemplates={formTemplates}
                    dropdownOpen={dropdownOpen}
                    setDropdownOpen={setDropdownOpen}
                    sending={sending}
                    onSend={handleSendForm}
                />
            </div>
        )
    }

    // -------------------------------------------------------------------------
    // Default
    // -------------------------------------------------------------------------
    const lastUpdated = bodyMetrics?.updatedAt ?? lastSubmission?.submittedAt ?? null

    return (
        <div
            className={`bg-surface-card rounded-panel border border-k-border-subtle p-5 ${
                dropdownOpen ? 'relative z-sidebar' : ''
            }`}
            data-testid="health-metrics-card"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3 gap-2">
                <div className="min-w-0">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Saúde &amp; métricas
                        {pendingCount > 0 && (
                            <span className="text-red-600 dark:text-red-400 tabular-nums"> · {pendingCount}</span>
                        )}
                    </span>
                    {lastUpdated && (
                        <p className="font-mono text-[10px] text-k-text-quaternary mt-0.5 tabular-nums">
                            atualizado em{' '}
                            {new Date(lastUpdated).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })}
                        </p>
                    )}
                </div>
                <SendButton
                    label="Enviar reavaliação"
                    formTemplates={formTemplates}
                    dropdownOpen={dropdownOpen}
                    setDropdownOpen={setDropdownOpen}
                    sending={sending}
                    onSend={handleSendForm}
                />
            </div>

            <div className="space-y-3">
                {/* In-person assessment block */}
                <PresencialBlock
                    studentId={studentId}
                    session={latestPresencialSession}
                    onPush={(href) => router.push(href)}
                />

                {/* Reassessment banner — borda-esquerda de severidade, sem fundo tintado */}
                {showReassessmentBanner && (
                    <div
                        role="status"
                        data-testid="reassessment-banner"
                        className={`flex items-start gap-2.5 rounded-control border border-k-border-subtle border-l-2 px-3 py-2.5 ${
                            hasOverdue ? 'border-l-red-500' : 'border-l-amber-500'
                        }`}
                    >
                        <AlertTriangle
                            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                hasOverdue ? 'text-red-500' : 'text-amber-500'
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-k-text-primary">
                                Reavaliação periódica · {hasOverdue ? 'vencida' : 'pendente'}
                            </p>
                            <p className="text-[11px] mt-0.5 text-k-text-tertiary tabular-nums">
                                {pendingCount > 0
                                    ? `${pendingCount} formulário${pendingCount > 1 ? 's' : ''} pendente${pendingCount > 1 ? 's' : ''}.`
                                    : `${dueSchedules.length} reavaliação${dueSchedules.length > 1 ? 'ões' : ''} vencendo nos próximos 7 dias.`}
                            </p>
                        </div>
                    </div>
                )}

                {/* Pending forms list — linha com ponto âmbar, sem caixa tintada */}
                {pendingCount > 0 && (
                    <div>
                        {pendingForms.slice(0, 3).map((form) => (
                            <div
                                key={form.id}
                                className="flex items-center gap-2.5 py-2 border-b border-k-border-subtle last:border-b-0"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                                <span className="text-xs font-medium text-k-text-secondary flex-1 truncate">
                                    {form.title}
                                </span>
                                <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-amber-600 dark:text-amber-400 shrink-0">
                                    Pendente
                                </span>
                            </div>
                        ))}
                        {pendingCount > 3 && (
                            <p className="text-xs text-k-text-quaternary pt-1.5 tabular-nums">
                                e mais {pendingCount - 3}…
                            </p>
                        )}
                    </div>
                )}

                {/* Body metrics — sparkline quando há histórico, estático caso contrário */}
                {hasBodyMetrics && (
                    hasTrend ? (
                        <BodyMetricsTrend
                            history={bodyMetricsHistory}
                            currentWeight={bodyMetrics?.weight ?? null}
                            currentBodyFat={bodyMetrics?.bodyFat ?? null}
                        />
                    ) : (
                        <div className="rounded-control border border-k-border-subtle bg-surface-primary p-3">
                            <div className="grid grid-cols-2 gap-3">
                                {bodyMetrics?.weight && (
                                    <div>
                                        <p className="text-xs text-k-text-tertiary">Peso</p>
                                        <p className="font-mono text-[15px] font-semibold text-k-text-primary mt-0.5 tabular-nums">
                                            {bodyMetrics.weight} <span className="text-[10.5px] font-normal text-k-text-tertiary">kg</span>
                                        </p>
                                    </div>
                                )}
                                {bodyMetrics?.bodyFat && (
                                    <div>
                                        <p className="text-xs text-k-text-tertiary">
                                            Gordura corporal
                                        </p>
                                        <p className="font-mono text-[15px] font-semibold text-k-text-primary mt-0.5 tabular-nums">
                                            {bodyMetrics.bodyFat} <span className="text-[10.5px] font-normal text-k-text-tertiary">%</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}

                {/* Last submission — clicável para ver as respostas inline */}
                {lastSubmission && (
                    <button
                        type="button"
                        onClick={handleViewSubmission}
                        disabled={loadingViewer}
                        className="group flex w-full items-start gap-2 rounded-control -mx-2 px-2 py-1.5 text-left transition-colors hover:bg-surface-inset disabled:opacity-60"
                        aria-label="Ver respostas da avaliação"
                    >
                        <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-k-text-secondary">
                                {categoryLabels[lastSubmission.templateCategory] || lastSubmission.templateCategory}
                                <span className="font-mono text-xs text-k-text-quaternary ml-1 tabular-nums">
                                    — {new Date(lastSubmission.submittedAt).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })}
                                </span>
                            </p>
                            <p className="text-xs text-k-text-quaternary mt-0.5 truncate">
                                {lastSubmission.templateTitle}
                            </p>
                        </div>
                        {loadingViewer ? (
                            <Loader2 className="w-4 h-4 shrink-0 mt-0.5 text-k-text-quaternary animate-spin" />
                        ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-k-text-quaternary transition-colors group-hover:text-k-text-primary" />
                        )}
                    </button>
                )}

                {/* Recurring schedules — accordion fechado por padrão */}
                {formSchedules.length > 0 && (
                    <div className="rounded-control border border-k-border-subtle">
                        <button
                            type="button"
                            onClick={() => setSchedulesExpanded((v) => !v)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-k-text-tertiary tabular-nums"
                            aria-expanded={schedulesExpanded}
                        >
                            <span>Reavaliações agendadas ({formSchedules.length})</span>
                            <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${schedulesExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {schedulesExpanded && (
                            <div className="px-3 pb-3">
                                <ActiveSchedulesList schedules={formSchedules} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Respostas da avaliação — modal inline, read-only.
             *  Renderizado via portal no body para garantir `position: fixed`
             *  relativo à viewport, independente do stacking context do card. */}
            {viewer && createPortal(
                <CheckinResponsesViewer
                    title={viewer.title}
                    date={viewer.submittedAt || ''}
                    answers={viewer.answers}
                    schema={viewer.schema}
                    onClose={() => setViewer(null)}
                    feedback={{
                        initialMessage: viewer.feedback,
                        sentAt: viewer.feedbackSentAt,
                        onSend: async (message) => {
                            const result = await sendFormFeedback({ submissionId: viewer.id, message })
                            if (result.success) router.refresh()
                            return result
                        },
                    }}
                />,
                document.body,
            )}
        </div>
    )
}

// -----------------------------------------------------------------------------
// Internal: Send button (dropdown)
// -----------------------------------------------------------------------------

function SendButton({
    label,
    formTemplates,
    dropdownOpen,
    setDropdownOpen,
    sending,
    onSend,
}: {
    label: string
    formTemplates: FormTemplate[]
    dropdownOpen: boolean
    setDropdownOpen: (v: boolean) => void
    sending: boolean
    onSend: (templateId: string) => void
}) {
    if (formTemplates.length === 0) return null

    return (
        <div className="relative">
            <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset border border-k-border-primary rounded-control transition-colors disabled:opacity-50"
            >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                {sending ? 'Enviando…' : label}
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
                <>
                    <div className="fixed inset-0 z-sidebar" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1 z-dropdown min-w-[220px] bg-surface-card border border-k-border-primary rounded-panel shadow-lg overflow-hidden">
                        {formTemplates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => onSend(template.id)}
                                className="w-full text-left px-4 py-2.5 text-sm text-k-text-secondary hover:bg-surface-inset transition-colors flex items-center justify-between gap-2"
                            >
                                <span className="truncate">{template.title}</span>
                                <span className="text-[10px] text-k-text-quaternary shrink-0">
                                    {categoryLabels[template.category] || template.category}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// -----------------------------------------------------------------------------
// In-person assessment block — neutro (o violeta decorativo saiu no redesign)
// -----------------------------------------------------------------------------

function formatShortDate(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: TIMEZONE,
    })
}

function safeBmiLabelShort(value: number | undefined): string | null {
    if (value == null) return null
    try {
        return classifyBMI(value).label_pt
    } catch {
        return null
    }
}

function PresencialBlock({
    studentId,
    session,
    onPush,
}: {
    studentId: string
    session: AssessmentSessionListItem | null
    onPush: (href: string) => void
}) {
    if (!session) {
        return (
            <button
                type="button"
                onClick={() => onPush(`/avaliacoes?createAssessment=1&studentId=${studentId}`)}
                className="group flex w-full items-center gap-2.5 rounded-control border border-k-border-subtle bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-surface-inset"
                aria-label="Criar avaliação presencial"
            >
                <Ruler className="h-3.5 w-3.5 shrink-0 text-k-text-quaternary" />
                <div className="min-w-0 flex-1">
                    <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">
                        Avaliação presencial
                    </div>
                    <div className="text-xs text-k-text-secondary">
                        Sem avaliações ainda
                    </div>
                </div>
                <Plus className="h-3.5 w-3.5 text-k-text-quaternary transition-colors group-hover:text-k-text-primary" />
            </button>
        )
    }

    const bmi = session.computed_metrics?.bmi
    const bf = session.computed_metrics?.body_fat_percent
    const bmiLabel = bmi != null ? safeBmiLabelShort(bmi) : null
    const dateStr = formatShortDate(session.completed_at)

    return (
        <button
            type="button"
            onClick={() => onPush(`/students/${studentId}/avaliacoes/${session.id}/result`)}
            className="group flex w-full items-center gap-2.5 rounded-control border border-k-border-subtle bg-surface-primary px-3 py-2.5 text-left transition-colors hover:bg-surface-inset"
            aria-label="Ver última avaliação presencial"
        >
            <Ruler className="h-3.5 w-3.5 shrink-0 text-k-text-quaternary" />
            <div className="min-w-0 flex-1">
                <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-k-text-tertiary">
                    Avaliação presencial
                    <span className="normal-case tracking-normal text-k-text-quaternary tabular-nums">
                        {' '}· {dateStr}
                    </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                    {bmi != null && (
                        <span className="font-mono text-[13px] font-semibold text-k-text-primary tabular-nums">
                            IMC {bmi.toFixed(1).replace('.', ',')}
                        </span>
                    )}
                    {bf != null && (
                        <span className="font-mono text-[13px] font-semibold text-k-text-primary tabular-nums">
                            {bf.toFixed(1).replace('.', ',')}% BG
                        </span>
                    )}
                    {bmi == null && bf == null && (
                        <span className="text-[13px] text-k-text-quaternary">sem métricas</span>
                    )}
                </div>
                {bmiLabel && (
                    <div className="text-[11px] text-k-text-tertiary">{bmiLabel}</div>
                )}
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-k-text-quaternary transition-colors group-hover:text-k-text-primary" />
        </button>
    )
}

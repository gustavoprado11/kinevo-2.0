'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    FileCheck,
    Loader2,
    Plus,
    Ruler,
    Send,
    Activity,
} from 'lucide-react'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { getSubmissionResponses, type SubmissionResponses } from '@/actions/forms/get-submission-responses'
import { sendFormFeedback } from '@/actions/forms/send-form-feedback'
import { CheckinResponsesViewer } from '@/components/forms/checkin-responses-viewer'
import { ActiveSchedulesList } from './active-schedules-list'
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
 * Substitui o par `AssessmentSidebarCard` + `BodyMetricsTrend` por um único
 * cartão na sidebar direita do dashboard do aluno. Reúne: avaliação presencial
 * mais recente, peso/% de gordura com sparkline, formulários pendentes, agenda
 * de reavaliações e dropdown pra enviar um novo formulário.
 *
 * O componente legado (`AssessmentSidebarCard`) segue vivo e marcado como
 * `@deprecated` até a Onda 3 — só não é mais consumido pelo
 * `student-detail-client`.
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
                alert(result.error || 'Não foi possível carregar as respostas')
            }
        } catch {
            alert('Não foi possível carregar as respostas')
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
                alert(result.error || 'Erro ao enviar formulário')
            }
        } catch {
            alert('Erro ao enviar formulário')
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
                className={`bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6 ${
                    dropdownOpen ? 'relative z-sidebar' : ''
                }`}
                data-testid="health-metrics-card"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-violet-500" />
                        Saúde &amp; métricas
                    </h3>
                </div>
                <div className="text-center py-4">
                    <div className="rounded-xl border-2 border-dashed border-[#D2D2D7] dark:border-k-border-subtle p-4 mb-3">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <ClipboardList className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-sm font-medium text-[#1C1C1E] dark:text-k-text-secondary">
                            Sem avaliações
                        </p>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5">
                            Envie um formulário pra conhecer melhor o aluno.
                        </p>
                    </div>
                    <div className="flex items-center justify-center">
                        <SendButton
                            label="Enviar avaliação"
                            formTemplates={formTemplates}
                            dropdownOpen={dropdownOpen}
                            setDropdownOpen={setDropdownOpen}
                            sending={sending}
                            onSend={handleSendForm}
                        />
                    </div>
                </div>
            </div>
        )
    }

    // -------------------------------------------------------------------------
    // Default
    // -------------------------------------------------------------------------
    const lastUpdated = bodyMetrics?.updatedAt ?? lastSubmission?.submittedAt ?? null

    return (
        <div
            className={`bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6 ${
                dropdownOpen ? 'relative z-sidebar' : ''
            }`}
            data-testid="health-metrics-card"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-violet-500" />
                        Saúde &amp; métricas
                        {pendingCount > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white">
                                {pendingCount}
                            </span>
                        )}
                    </h3>
                    {lastUpdated && (
                        <p className="text-[10px] text-[#86868B] dark:text-k-text-quaternary mt-0.5">
                            Última atualização em{' '}
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

                {/* Reassessment banner — Onda 2 */}
                {showReassessmentBanner && (
                    <div
                        role="status"
                        data-testid="reassessment-banner"
                        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                            hasOverdue
                                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                        }`}
                    >
                        <AlertTriangle
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                                hasOverdue ? 'text-red-500' : 'text-amber-500'
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                            <p
                                className={`text-xs font-bold ${
                                    hasOverdue
                                        ? 'text-red-700 dark:text-red-300'
                                        : 'text-amber-700 dark:text-amber-300'
                                }`}
                            >
                                Reavaliação periódica · {hasOverdue ? 'vencida' : 'pendente'}
                            </p>
                            <p
                                className={`text-[11px] mt-0.5 ${
                                    hasOverdue
                                        ? 'text-red-600/80 dark:text-red-400/80'
                                        : 'text-amber-600/80 dark:text-amber-400/80'
                                }`}
                            >
                                {pendingCount > 0
                                    ? `${pendingCount} formulário${pendingCount > 1 ? 's' : ''} pendente${pendingCount > 1 ? 's' : ''}.`
                                    : `${dueSchedules.length} reavaliação${dueSchedules.length > 1 ? 'ões' : ''} vencendo nos próximos 7 dias.`}
                            </p>
                        </div>
                    </div>
                )}

                {/* Pending forms list */}
                {pendingCount > 0 && (
                    <div className="space-y-2">
                        {pendingForms.slice(0, 3).map((form) => (
                            <div
                                key={form.id}
                                className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2"
                            >
                                <FileCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 flex-1 truncate">
                                    {form.title}
                                </span>
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                    Pendente
                                </span>
                            </div>
                        ))}
                        {pendingCount > 3 && (
                            <p className="text-xs text-[#86868B] dark:text-k-text-quaternary pl-3">
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
                        <div className="rounded-lg bg-[#F5F5F7] dark:bg-white/5 p-3">
                            <div className="grid grid-cols-2 gap-3">
                                {bodyMetrics?.weight && (
                                    <div>
                                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Peso</p>
                                        <p className="text-base font-semibold text-[#1C1C1E] dark:text-white mt-0.5">
                                            {bodyMetrics.weight} kg
                                        </p>
                                    </div>
                                )}
                                {bodyMetrics?.bodyFat && (
                                    <div>
                                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">
                                            Gordura corporal
                                        </p>
                                        <p className="text-base font-semibold text-[#1C1C1E] dark:text-white mt-0.5">
                                            {bodyMetrics.bodyFat}%
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
                        className="group flex w-full items-start gap-2 rounded-lg -mx-2 px-2 py-1.5 text-left transition-colors hover:bg-[#F5F5F7] dark:hover:bg-white/5 disabled:opacity-60"
                        aria-label="Ver respostas da avaliação"
                    >
                        <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-[#1C1C1E] dark:text-k-text-secondary">
                                {categoryLabels[lastSubmission.templateCategory] || lastSubmission.templateCategory}
                                <span className="text-[#86868B] dark:text-k-text-quaternary ml-1">
                                    — {new Date(lastSubmission.submittedAt).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })}
                                </span>
                            </p>
                            <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5 truncate">
                                {lastSubmission.templateTitle}
                            </p>
                        </div>
                        {loadingViewer ? (
                            <Loader2 className="w-4 h-4 shrink-0 mt-0.5 text-[#86868B] dark:text-k-text-quaternary animate-spin" />
                        ) : (
                            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-[#C7C7CC] dark:text-k-text-quaternary transition-colors group-hover:text-violet-500 dark:group-hover:text-violet-400" />
                        )}
                    </button>
                )}

                {/* Recurring schedules — accordion fechado por padrão */}
                {formSchedules.length > 0 && (
                    <div className="rounded-lg border border-[#E8E8ED] dark:border-k-border-subtle">
                        <button
                            type="button"
                            onClick={() => setSchedulesExpanded((v) => !v)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold text-[#6E6E73] dark:text-k-text-tertiary"
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
             *  Renderizado via portal no body: o card raiz usa backdrop-blur
             *  (backdrop-filter), que criaria um containing block e prenderia
             *  o `position: fixed` do modal à área do card em vez da viewport. */}
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
// Internal: Send button (dropdown) — local pra não acoplar ao componente
// legado AssessmentSidebarCard, que será removido na Onda 3.
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-k-text-tertiary hover:text-k-text-primary border border-k-border-subtle rounded-lg transition-all disabled:opacity-50"
            >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                {sending ? 'Enviando…' : label}
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
                <>
                    <div className="fixed inset-0 z-sidebar" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1 z-dropdown min-w-[220px] bg-white dark:bg-surface-card border border-[#E5E5EA] dark:border-k-border-primary rounded-xl shadow-lg overflow-hidden">
                        {formTemplates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => onSend(template.id)}
                                className="w-full text-left px-4 py-2.5 text-sm text-[#1C1C1E] dark:text-k-text-secondary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-hover transition-colors flex items-center justify-between gap-2"
                            >
                                <span className="truncate">{template.title}</span>
                                <span className="text-[10px] text-[#86868B] dark:text-k-text-quaternary shrink-0">
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
// In-person assessment block
//
// Duplicated from assessment-sidebar-card.tsx (wave 2). Will be the canonical
// location once AssessmentSidebarCard is removed in wave 3.
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
                className="group flex w-full items-center gap-2 rounded-lg border border-dashed border-[#D2D2D7] dark:border-k-border-subtle bg-transparent px-3 py-2.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
                aria-label="Criar avaliação presencial"
            >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-violet-500/10">
                    <Ruler className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B] dark:text-k-text-quaternary">
                        Avaliação presencial
                    </div>
                    <div className="text-xs text-[#1C1C1E] dark:text-k-text-secondary">
                        Sem avaliações ainda
                    </div>
                </div>
                <Plus className="h-3.5 w-3.5 text-[#86868B] transition-colors group-hover:text-violet-500 dark:text-k-text-quaternary dark:group-hover:text-violet-400" />
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
            className="group flex w-full items-center gap-2.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/10"
            aria-label="Ver última avaliação presencial"
        >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-violet-500/15">
                <Ruler className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400">
                    Avaliação presencial
                    <span className="font-normal normal-case tracking-normal text-[#86868B] dark:text-k-text-quaternary">
                        · {dateStr}
                    </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    {bmi != null && (
                        <span className="font-semibold text-[#1C1C1E] dark:text-k-text-primary">
                            IMC {bmi.toFixed(1).replace('.', ',')}
                        </span>
                    )}
                    {bf != null && (
                        <span className="font-semibold text-[#1C1C1E] dark:text-k-text-primary">
                            {bf.toFixed(1).replace('.', ',')}% BG
                        </span>
                    )}
                    {bmi == null && bf == null && (
                        <span className="text-[#86868B] dark:text-k-text-quaternary">sem métricas</span>
                    )}
                </div>
                {bmiLabel && (
                    <div className="text-[11px] text-[#86868B] dark:text-k-text-tertiary">{bmiLabel}</div>
                )}
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#86868B] transition-colors group-hover:text-violet-500 dark:text-k-text-quaternary dark:group-hover:text-violet-400" />
        </button>
    )
}

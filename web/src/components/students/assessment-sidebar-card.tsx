'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ClipboardList, FileCheck, Clock, Loader2, Plus, Ruler, Send, ChevronDown } from 'lucide-react'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { ActiveSchedulesList } from './active-schedules-list'
import { BodyMetricsTrend } from './body-metrics-trend'
import type { FormScheduleRow } from '@/actions/forms/form-schedules'
import type { AssessmentSessionListItem } from '@kinevo/shared/types/assessments'
import { classifyBMI } from '@kinevo/shared/lib/assessment-protocols'

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

interface AssessmentSidebarCardProps {
    studentId: string
    lastSubmission: LastSubmission | null
    pendingForms: PendingForm[]
    bodyMetrics: BodyMetrics | null
    /**
     * Histórico de métricas corporais. Quando houver ≥ 2 pontos com dados,
     * renderizamos o `BodyMetricsTrend` (sparkline + variação) em vez do
     * bloco estático. Assim evitamos um card adicional na sidebar.
     */
    bodyMetricsHistory?: BodyMetricsHistoryPoint[]
    formTemplates: FormTemplate[]
    formSchedules?: FormScheduleRow[]
    /**
     * Most-recent completed in-person assessment for this student. Drives the
     * new "Avaliação Presencial" block at the top of the sidebar (M4). When
     * null, the block shows an empty hint with a CTA to create one.
     */
    latestPresencialSession?: AssessmentSessionListItem | null
}

const categoryLabels: Record<string, string> = {
    anamnese: 'Anamnese',
    checkin: 'Check-in',
    survey: 'Pesquisa',
}

export function AssessmentSidebarCard({
    studentId,
    lastSubmission,
    pendingForms,
    bodyMetrics,
    bodyMetricsHistory = [],
    formTemplates,
    formSchedules = [],
    latestPresencialSession = null,
}: AssessmentSidebarCardProps) {
    const router = useRouter()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [sending, setSending] = useState(false)

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
    const hasData =
        lastSubmission
        || pendingCount > 0
        || formSchedules.length > 0
        || (bodyMetrics?.weight || bodyMetrics?.bodyFat)
        || !!latestPresencialSession
    const maxVisiblePending = 3

    // Empty state — follows "Próximos Programas" empty pattern
    if (!hasData) {
        return (
            <div className={`bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6 ${dropdownOpen ? 'relative z-sidebar' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        Avaliações
                    </h3>
                </div>
                <div className="text-center py-4">
                    <div className="rounded-xl border-2 border-dashed border-[#D2D2D7] dark:border-k-border-subtle p-4 mb-3">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <ClipboardList className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-sm font-medium text-[#1C1C1E] dark:text-k-text-secondary">Sem avaliações</p>
                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5">Envie um formulário para conhecer melhor o aluno</p>
                    </div>
                    <div className="flex items-center justify-center">
                        <SendButton
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

    return (
        <div className={`bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-6 ${dropdownOpen ? 'relative z-sidebar' : ''}`}>
            {/* Header — same pattern as Observações / Próximos Programas */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                    Avaliações
                    {pendingCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white">
                            {pendingCount}
                        </span>
                    )}
                </h3>
                <SendButton
                    formTemplates={formTemplates}
                    dropdownOpen={dropdownOpen}
                    setDropdownOpen={setDropdownOpen}
                    sending={sending}
                    onSend={handleSendForm}
                />
            </div>

            <div className="space-y-3">
                {/* M4 — In-person assessment summary (top, intentionally above
                    Pending forms since this is a richer, slower-cadence signal). */}
                <PresencialBlock
                    studentId={studentId}
                    session={latestPresencialSession}
                    onPush={(href) => router.push(href)}
                />

                {/* Pending forms — shown FIRST (more urgent) */}
                {pendingCount > 0 && (
                    <div className="space-y-2">
                        {pendingForms.slice(0, maxVisiblePending).map(form => (
                            <div key={form.id} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 flex-1 truncate">
                                    {form.title}
                                </span>
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                    Pendente
                                </span>
                            </div>
                        ))}
                        {pendingCount > maxVisiblePending && (
                            <p className="text-xs text-[#86868B] dark:text-k-text-quaternary pl-3">
                                e mais {pendingCount - maxVisiblePending}...
                            </p>
                        )}
                    </div>
                )}

                {/* Recurring schedules */}
                {formSchedules.length > 0 && (
                    <ActiveSchedulesList schedules={formSchedules} />
                )}

                {/* Last submission */}
                {lastSubmission && (
                    <div className="flex items-start gap-2 hover:bg-[#F5F5F7] dark:hover:bg-white/5 rounded-lg -mx-2 px-2 py-1.5 transition-colors cursor-default">
                        <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-sm text-[#1C1C1E] dark:text-k-text-secondary">
                                {categoryLabels[lastSubmission.templateCategory] || lastSubmission.templateCategory}
                                <span className="text-[#86868B] dark:text-k-text-quaternary ml-1">
                                    — {new Date(lastSubmission.submittedAt).toLocaleDateString('pt-BR')}
                                </span>
                            </p>
                            <p className="text-xs text-[#86868B] dark:text-k-text-quaternary mt-0.5 truncate">
                                {lastSubmission.templateTitle}
                            </p>
                        </div>
                    </div>
                )}

                {/* Body metrics — com trend quando há histórico, estático caso contrário */}
                {(bodyMetrics?.weight || bodyMetrics?.bodyFat) && (() => {
                    const hasTrend = bodyMetricsHistory.length >= 2
                    if (hasTrend) {
                        return (
                            <BodyMetricsTrend
                                history={bodyMetricsHistory}
                                currentWeight={bodyMetrics?.weight ?? null}
                                currentBodyFat={bodyMetrics?.bodyFat ?? null}
                            />
                        )
                    }
                    return (
                        <div className="rounded-lg bg-[#F5F5F7] dark:bg-white/5 p-3">
                            <div className="grid grid-cols-2 gap-3">
                                {bodyMetrics?.weight && (
                                    <div>
                                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Peso</p>
                                        <p className="text-base font-semibold text-[#1C1C1E] dark:text-white mt-0.5">{bodyMetrics.weight} kg</p>
                                    </div>
                                )}
                                {bodyMetrics?.bodyFat && (
                                    <div>
                                        <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Gordura corporal</p>
                                        <p className="text-base font-semibold text-[#1C1C1E] dark:text-white mt-0.5">{bodyMetrics.bodyFat}%</p>
                                    </div>
                                )}
                            </div>
                            {bodyMetrics?.updatedAt && (
                                <p className="text-[11px] text-[#AEAEB2] dark:text-k-text-quaternary mt-2">
                                    Atualizado em {new Date(bodyMetrics.updatedAt).toLocaleDateString('pt-BR')}
                                </p>
                            )}
                        </div>
                    )
                })()}
            </div>

        </div>
    )
}

// --- Internal dropdown trigger (icon button in header, like Próximos Programas action buttons) ---

function SendButton({
    formTemplates,
    dropdownOpen,
    setDropdownOpen,
    sending,
    onSend,
}: {
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
                {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Send className="w-3 h-3" />
                )}
                {sending ? 'Enviando...' : 'Enviar'}
                <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-sidebar" onClick={() => setDropdownOpen(false)} />
                    {/* Dropdown menu */}
                    <div className="absolute right-0 mt-1 z-dropdown min-w-[220px] bg-white dark:bg-surface-card border border-[#E5E5EA] dark:border-k-border-primary rounded-xl shadow-lg overflow-hidden">
                        {formTemplates.map(template => (
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

// ─── M4: In-person assessment block ────────────────────────────────

const TIMEZONE = 'America/Sao_Paulo'

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
                onClick={() => onPush('/forms?tab=assessments')}
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
            onClick={() =>
                onPush(`/students/${studentId}/avaliacoes/${session.id}/result`)
            }
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
                        <span className="text-[#86868B] dark:text-k-text-quaternary">
                            sem métricas
                        </span>
                    )}
                </div>
                {bmiLabel && (
                    <div className="text-[11px] text-[#86868B] dark:text-k-text-tertiary">
                        {bmiLabel}
                    </div>
                )}
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#86868B] transition-colors group-hover:text-violet-500 dark:text-k-text-quaternary dark:group-hover:text-violet-400" />
        </button>
    )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, FileCheck, Clock, Loader2, Send, ChevronDown } from 'lucide-react'
import { assignFormToStudents } from '@/actions/forms/assign-form'

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

interface AssessmentSidebarCardProps {
    studentId: string
    lastSubmission: LastSubmission | null
    pendingForms: PendingForm[]
    bodyMetrics: BodyMetrics | null
    formTemplates: FormTemplate[]
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
    formTemplates,
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
    const hasData = lastSubmission || pendingCount > 0 || (bodyMetrics?.weight || bodyMetrics?.bodyFat)
    const maxVisiblePending = 3

    // Empty state — follows "Próximos Programas" empty pattern
    if (!hasData) {
        return (
            <div className={`bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-[#E5E5EA] dark:border-k-border-primary p-6 ${dropdownOpen ? 'relative z-30' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        Avaliações
                    </h3>
                </div>
                <div className="text-center py-4">
                    <p className="text-sm text-[#86868B] dark:text-k-text-quaternary mb-3">Nenhuma avaliação enviada</p>
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
        <div className={`bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-[#E5E5EA] dark:border-k-border-primary p-6 ${dropdownOpen ? 'relative z-30' : ''}`}>
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

                {/* Body metrics */}
                {(bodyMetrics?.weight || bodyMetrics?.bodyFat) && (
                    <div className="rounded-lg bg-[#F5F5F7] dark:bg-white/5 p-3">
                        <div className="grid grid-cols-2 gap-3">
                            {bodyMetrics.weight && (
                                <div>
                                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Peso</p>
                                    <p className="text-base font-semibold text-[#1C1C1E] dark:text-white mt-0.5">{bodyMetrics.weight} kg</p>
                                </div>
                            )}
                            {bodyMetrics.bodyFat && (
                                <div>
                                    <p className="text-xs text-[#86868B] dark:text-k-text-quaternary">Gordura corporal</p>
                                    <p className="text-base font-semibold text-[#1C1C1E] dark:text-white mt-0.5">{bodyMetrics.bodyFat}%</p>
                                </div>
                            )}
                        </div>
                        {bodyMetrics.updatedAt && (
                            <p className="text-[11px] text-[#AEAEB2] dark:text-k-text-quaternary mt-2">
                                Atualizado em {new Date(bodyMetrics.updatedAt).toLocaleDateString('pt-BR')}
                            </p>
                        )}
                    </div>
                )}
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
                    <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                    {/* Dropdown menu */}
                    <div className="absolute right-0 mt-1 z-40 min-w-[220px] bg-white dark:bg-surface-card border border-[#E5E5EA] dark:border-k-border-primary rounded-xl shadow-lg overflow-hidden">
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

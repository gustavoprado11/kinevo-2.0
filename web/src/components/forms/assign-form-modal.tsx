'use client'

import { useState } from 'react'
import { Send, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { createFormSchedules, type ScheduleFrequency } from '@/actions/forms/form-schedules'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { ModalShell } from '@/components/shared/modal-shell'
import { StudentPicker, type StudentPickerOption } from '@/components/shared/student-picker'
import { TemplatePicker } from '@/components/shared/template-picker'

interface FormTemplate {
    id: string
    title: string
    version: number
}

interface AssignFormModalProps {
    isOpen: boolean
    onClose: () => void
    templates: FormTemplate[]
    students: StudentPickerOption[]
    preselectedTemplateId?: string | null
}

const frequencyLabels: Record<ScheduleFrequency, string> = {
    daily: 'diária',
    weekly: 'semanal',
    biweekly: 'quinzenal',
    monthly: 'mensal',
}

export function AssignFormModal({
    isOpen,
    onClose,
    templates,
    students,
    preselectedTemplateId,
}: AssignFormModalProps) {
    const [templateId, setTemplateId] = useState(preselectedTemplateId || '')
    const [deadlineDays, setDeadlineDays] = useState<number | null>(null)
    const [customDate, setCustomDate] = useState('')
    const [showDatePicker, setShowDatePicker] = useState(false)
    const [message, setMessage] = useState('')
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
    const [isRecurring, setIsRecurring] = useState(false)
    const [frequency, setFrequency] = useState<ScheduleFrequency>('weekly')
    const [isAssigning, setIsAssigning] = useState(false)
    const [result, setResult] = useState<{ message: string; isError: boolean } | null>(null)

    const computeDueAt = (): string | null => {
        if (showDatePicker && customDate) {
            return new Date(customDate).toISOString()
        }
        if (deadlineDays) {
            const d = new Date()
            d.setDate(d.getDate() + deadlineDays)
            return d.toISOString()
        }
        return null
    }

    const handleAssign = async () => {
        if (!templateId || selectedStudentIds.length === 0) return

        setIsAssigning(true)
        setResult(null)

        const res = await assignFormToStudents({
            formTemplateId: templateId,
            studentIds: selectedStudentIds,
            dueAt: computeDueAt(),
            message: message || undefined,
        })

        let scheduleResult: { success: boolean; count?: number; error?: string } | null = null
        if (isRecurring && res.success) {
            scheduleResult = await createFormSchedules({
                formTemplateId: templateId,
                studentIds: selectedStudentIds,
                frequency,
            })
        }

        if (res.success) {
            useOnboardingStore.getState().completeMilestone('first_form_sent')
            const parts: string[] = []
            parts.push(`Formulário enviado para ${res.assignedCount} aluno${res.assignedCount !== 1 ? 's' : ''}`)
            if (res.skippedCount) {
                parts.push(` (${res.skippedCount} já ${res.skippedCount === 1 ? 'tinha' : 'tinham'})`)
            }
            if (scheduleResult?.success) {
                const freqLabel = frequencyLabels[frequency]
                parts.push(`. Recorrência ${freqLabel} ativada`)
            }
            setResult({ message: parts.join('') + '.', isError: false })
            setTimeout(() => {
                resetAndClose()
            }, 2000)
        } else {
            setResult({ message: res.error || 'Erro ao enviar formulário.', isError: true })
        }

        setIsAssigning(false)
    }

    const resetAndClose = () => {
        setTemplateId(preselectedTemplateId || '')
        setDeadlineDays(null)
        setCustomDate('')
        setShowDatePicker(false)
        setMessage('')
        setSelectedStudentIds([])
        setIsRecurring(false)
        setFrequency('weekly')
        setResult(null)
        onClose()
    }

    const selectDeadline = (days: number) => {
        setShowDatePicker(false)
        setCustomDate('')
        setDeadlineDays(prev => prev === days ? null : days)
    }

    const selectCustomDate = () => {
        setDeadlineDays(null)
        setShowDatePicker(true)
    }

    const canSubmit = !!templateId && selectedStudentIds.length > 0

    const footer = (
        <button
            onClick={handleAssign}
            disabled={isAssigning || !canSubmit}
            className={`w-full h-11 font-bold rounded-full transition-all flex items-center justify-center gap-2 dark:rounded-xl ${
                canSubmit
                    ? 'bg-primary hover:opacity-90 text-primary-foreground dark:bg-violet-600 dark:hover:bg-violet-500 dark:shadow-lg dark:shadow-violet-600/20'
                    : 'text-[#AEAEB2] cursor-not-allowed dark:bg-surface-elevated dark:text-k-text-quaternary'
            }`}
        >
            {isAssigning ? (
                <>
                    <Loader2 size={16} className="animate-spin" />
                    Enviando...
                </>
            ) : canSubmit ? (
                <>
                    <Send size={16} />
                    Enviar para {selectedStudentIds.length} aluno{selectedStudentIds.length !== 1 ? 's' : ''}
                </>
            ) : (
                'Selecione template e alunos'
            )}
        </button>
    )

    return (
        <ModalShell
            open={isOpen}
            onClose={resetAndClose}
            title="Enviar Formulário"
            size="lg"
            footer={footer}
        >
            <div className="px-5 py-5 space-y-5">
                {/* Template */}
                <div>
                    <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5 dark:text-k-text-tertiary">
                        Template
                    </label>
                    <TemplatePicker
                        category="form"
                        templates={templates}
                        value={templateId}
                        onChange={setTemplateId}
                    />
                </div>

                {/* Deadline Chips */}
                <div>
                    <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5 dark:text-k-text-tertiary">
                        Prazo <span className="text-[#86868B] font-normal dark:text-k-text-quaternary">(opcional)</span>
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                        {[
                            { label: '3 dias', value: 3 },
                            { label: '1 semana', value: 7 },
                            { label: '2 semanas', value: 14 },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => selectDeadline(opt.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    deadlineDays === opt.value && !showDatePicker
                                        ? 'bg-[#7C3AED] text-white dark:bg-violet-500/10 dark:text-violet-400 dark:border dark:border-violet-500/30'
                                        : 'bg-white text-[#6E6E73] border border-[#D2D2D7] hover:bg-[#F5F5F7] dark:bg-glass-bg dark:text-k-text-quaternary dark:border-k-border-subtle dark:hover:text-k-text-secondary'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={selectCustomDate}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                showDatePicker
                                    ? 'bg-[#7C3AED] text-white dark:bg-violet-500/10 dark:text-violet-400 dark:border dark:border-violet-500/30'
                                    : 'bg-white text-[#6E6E73] border border-[#D2D2D7] hover:bg-[#F5F5F7] dark:bg-glass-bg dark:text-k-text-quaternary dark:border-k-border-subtle dark:hover:text-k-text-secondary'
                            }`}
                        >
                            Personalizar
                        </button>
                    </div>
                    {showDatePicker && (
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                        />
                    )}
                </div>

                {/* Recurring */}
                <div>
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-[#1D1D1F] dark:text-k-text-tertiary cursor-pointer">
                            <RefreshCw size={14} className={isRecurring ? 'text-violet-500' : 'text-[#86868B] dark:text-k-text-quaternary'} />
                            Envio recorrente
                        </label>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isRecurring}
                            onClick={() => setIsRecurring(!isRecurring)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isRecurring
                                    ? 'bg-violet-600'
                                    : 'bg-[#D2D2D7] dark:bg-k-border-subtle'
                            }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                                    isRecurring ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                    {isRecurring && (
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                            {(Object.entries(frequencyLabels) as [ScheduleFrequency, string][]).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFrequency(key)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                                        frequency === key
                                            ? 'bg-violet-600 text-white dark:bg-violet-500/10 dark:text-violet-400 dark:border dark:border-violet-500/30'
                                            : 'bg-white text-[#6E6E73] border border-[#D2D2D7] hover:bg-[#F5F5F7] dark:bg-glass-bg dark:text-k-text-quaternary dark:border-k-border-subtle dark:hover:text-k-text-secondary'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Message */}
                <div>
                    <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5 dark:text-k-text-tertiary">
                        Mensagem pessoal <span className="text-[#86868B] font-normal dark:text-k-text-quaternary">(opcional)</span>
                    </label>
                    <textarea
                        placeholder="Adicione uma nota pessoal para os alunos..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[80px] w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none transition-all focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 resize-none dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                    />
                </div>

                {/* Students */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-[#1D1D1F] dark:text-k-text-tertiary">
                        Alunos
                    </label>
                    <StudentPicker
                        mode="multi"
                        students={students}
                        value={selectedStudentIds}
                        onChange={setSelectedStudentIds}
                    />
                </div>

                {/* Result */}
                {result && (
                    <div className={`flex items-start gap-2 rounded-xl p-3 text-xs font-medium border ${
                        result.isError
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }`}>
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        <p>{result.message}</p>
                    </div>
                )}
            </div>
        </ModalShell>
    )
}

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
            className={`w-full h-11 font-semibold rounded-control transition-opacity flex items-center justify-center gap-2 ${
                canSubmit
                    ? 'bg-primary hover:opacity-90 text-primary-foreground'
                    : 'bg-surface-inset text-k-text-quaternary cursor-not-allowed'
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
                    <label className="block text-sm font-medium text-k-text-primary mb-1.5">
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
                    <label className="block text-sm font-medium text-k-text-primary mb-1.5">
                        Prazo <span className="text-k-text-tertiary font-normal">(opcional)</span>
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
                                className={`px-3 py-1.5 rounded-control border text-xs font-medium transition-colors ${
                                    deadlineDays === opt.value && !showDatePicker
                                        ? 'bg-surface-inset text-k-text-primary border-k-border-primary font-semibold'
                                        : 'bg-surface-card text-k-text-secondary border-k-border-primary hover:text-k-text-primary hover:bg-surface-inset'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={selectCustomDate}
                            className={`px-3 py-1.5 rounded-control border text-xs font-medium transition-colors ${
                                showDatePicker
                                    ? 'bg-surface-inset text-k-text-primary border-k-border-primary font-semibold'
                                    : 'bg-surface-card text-k-text-secondary border-k-border-primary hover:text-k-text-primary hover:bg-surface-inset'
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
                            className="mt-2 w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-2.5 text-sm text-k-text-primary font-mono tabular-nums focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
                        />
                    )}
                </div>

                {/* Recurring */}
                <div>
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-k-text-primary cursor-pointer">
                            <RefreshCw size={14} className={isRecurring ? 'text-k-text-secondary' : 'text-k-text-tertiary'} />
                            Envio recorrente
                        </label>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isRecurring}
                            onClick={() => setIsRecurring(!isRecurring)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isRecurring
                                    ? 'bg-primary'
                                    : 'bg-k-border-primary'
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
                                    className={`px-3 py-1.5 rounded-control border text-xs font-medium transition-colors capitalize ${
                                        frequency === key
                                            ? 'bg-surface-inset text-k-text-primary border-k-border-primary font-semibold'
                                            : 'bg-surface-card text-k-text-secondary border-k-border-primary hover:text-k-text-primary hover:bg-surface-inset'
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
                    <label className="block text-sm font-medium text-k-text-primary mb-1.5">
                        Mensagem pessoal <span className="text-k-text-tertiary font-normal">(opcional)</span>
                    </label>
                    <textarea
                        placeholder="Adicione uma nota pessoal para os alunos..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[80px] w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary resize-none focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
                    />
                </div>

                {/* Students */}
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-k-text-primary">
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
                    <div className={`flex items-start gap-2 rounded-control p-3 text-xs font-medium border ${
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

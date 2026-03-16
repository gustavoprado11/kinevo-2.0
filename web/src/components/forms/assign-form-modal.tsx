'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { createFormSchedules, type ScheduleFrequency } from '@/actions/forms/form-schedules'
import { useOnboardingStore } from '@/stores/onboarding-store'

interface Student {
    id: string
    name: string
    avatar_url?: string | null
}

interface FormTemplate {
    id: string
    title: string
    version: number
}

interface AssignFormModalProps {
    isOpen: boolean
    onClose: () => void
    templates: FormTemplate[]
    students: Student[]
    preselectedTemplateId?: string | null
}

const frequencyLabels: Record<ScheduleFrequency, string> = {
    daily: 'diária',
    weekly: 'semanal',
    biweekly: 'quinzenal',
    monthly: 'mensal',
}

function cleanTemplateName(name: string): string {
    const parts = name.split(' - ')
    if (parts.length === 2 && parts[1].toLowerCase().includes(parts[0].toLowerCase())) {
        return parts[1]
    }
    return name
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

    const toggleStudent = (id: string) => {
        setSelectedStudentIds((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        )
    }

    const toggleAll = () => {
        if (selectedStudentIds.length === students.length) {
            setSelectedStudentIds([])
        } else {
            setSelectedStudentIds(students.map((s) => s.id))
        }
    }

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

        // Always send the form immediately
        const res = await assignFormToStudents({
            formTemplateId: templateId,
            studentIds: selectedStudentIds,
            dueAt: computeDueAt(),
            message: message || undefined,
        })

        // If recurring, also create the schedule
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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-dropdown bg-black/40 backdrop-blur-sm"
                        onClick={resetAndClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-modal flex items-center justify-center p-4"
                    >
                        <div className="w-full max-w-lg rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden dark:border dark:border-k-border-primary dark:bg-surface-card dark:shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-[#E8E8ED] px-6 py-4 dark:border-k-border-subtle">
                                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-k-text-primary">Enviar Formulário</h2>
                                <button
                                    onClick={resetAndClose}
                                    className="rounded-full p-2 text-[#AEAEB2] hover:text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors dark:text-k-text-secondary dark:hover:bg-glass-bg dark:hover:text-k-text-primary"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                                {/* Template Select */}
                                <div>
                                    <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5 dark:text-k-text-tertiary">
                                        Template
                                    </label>
                                    <select
                                        value={templateId}
                                        onChange={(e) => setTemplateId(e.target.value)}
                                        className="w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] outline-none transition-all focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50 dark:focus:ring-violet-500/10"
                                    >
                                        <option value="">Selecione um template...</option>
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {cleanTemplateName(t.title)} (v{t.version})
                                            </option>
                                        ))}
                                    </select>
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
                                                        ? 'bg-[#007AFF] text-white dark:bg-violet-500/10 dark:text-violet-400 dark:border dark:border-violet-500/30'
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
                                                    ? 'bg-[#007AFF] text-white dark:bg-violet-500/10 dark:text-violet-400 dark:border dark:border-violet-500/30'
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
                                            className="mt-2 w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                                        />
                                    )}
                                </div>

                                {/* Recurring toggle */}
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
                                        className="min-h-[80px] w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none transition-all focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 resize-none dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                                    />
                                </div>

                                {/* Students */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-medium text-[#1D1D1F] dark:text-k-text-tertiary">
                                            Alunos
                                        </label>
                                        {students.length > 0 && (
                                            <button
                                                onClick={toggleAll}
                                                className="text-[11px] font-semibold text-[#007AFF] hover:text-[#0056B3] transition-colors dark:text-violet-400 dark:hover:text-violet-300"
                                            >
                                                {selectedStudentIds.length === students.length ? 'Desmarcar todos' : 'Selecionar todos'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-48 overflow-y-auto rounded-lg border border-[#E8E8ED] bg-white p-2 dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg">
                                        {students.length === 0 ? (
                                            <p className="px-2 py-4 text-center text-xs text-k-text-secondary">
                                                Nenhum aluno ativo encontrado.
                                            </p>
                                        ) : (
                                            <div className="space-y-0.5">
                                                {students.map((student) => {
                                                    const isSelected = selectedStudentIds.includes(student.id)
                                                    return (
                                                        <label
                                                            key={student.id}
                                                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all border-b border-[#E8E8ED] last:border-b-0 dark:border-b-0 ${
                                                                isSelected
                                                                    ? 'bg-[#007AFF]/5 dark:bg-violet-500/10'
                                                                    : 'hover:bg-[#F5F5F7] dark:hover:bg-surface-elevated'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleStudent(student.id)}
                                                                className="h-4 w-4 rounded border-[#D2D2D7] text-[#007AFF] focus:ring-[#007AFF] accent-[#007AFF] dark:border-k-border-subtle dark:text-violet-600 dark:focus:ring-violet-500 dark:accent-violet-600"
                                                            />
                                                            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden shrink-0">
                                                                {student.avatar_url ? (
                                                                    <Image src={student.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized />
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-k-text-secondary">
                                                                        {student.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className={`text-sm font-medium ${
                                                                isSelected
                                                                    ? 'text-[#1D1D1F] dark:text-violet-400'
                                                                    : 'text-[#1D1D1F] dark:text-k-text-primary'
                                                            }`}>
                                                                {student.name}
                                                            </span>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
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

                            {/* Footer */}
                            <div className="border-t border-[#E8E8ED] px-6 py-4 dark:border-k-border-subtle">
                                <button
                                    onClick={handleAssign}
                                    disabled={isAssigning || !canSubmit}
                                    className={`w-full h-11 font-bold rounded-full transition-all flex items-center justify-center gap-2 dark:rounded-xl ${
                                        canSubmit
                                            ? 'bg-[#007AFF] hover:bg-[#0066D6] text-white dark:bg-violet-600 dark:hover:bg-violet-500 dark:shadow-lg dark:shadow-violet-600/20'
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
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

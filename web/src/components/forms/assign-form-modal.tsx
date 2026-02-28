'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, CheckCircle2, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { assignFormToStudents } from '@/actions/forms/assign-form'
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
    const [isAssigning, setIsAssigning] = useState(false)
    const [result, setResult] = useState<string | null>(null)

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

        const res = await assignFormToStudents({
            formTemplateId: templateId,
            studentIds: selectedStudentIds,
            dueAt: computeDueAt(),
            message: message || undefined,
        })

        if (res.success) {
            useOnboardingStore.getState().completeMilestone('first_form_sent')
            setResult(`Formulário enviado para ${res.assignedCount} aluno${res.assignedCount !== 1 ? 's' : ''}${res.skippedCount ? ` (${res.skippedCount} já ${res.skippedCount === 1 ? 'tinha' : 'tinham'})` : ''}.`)
            setTimeout(() => {
                resetAndClose()
            }, 2000)
        } else {
            setResult(res.error || 'Erro ao enviar formulário.')
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
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                        onClick={resetAndClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="w-full max-w-lg rounded-2xl border border-k-border-primary bg-surface-card shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-k-border-subtle px-6 py-4">
                                <h2 className="text-lg font-bold text-k-text-primary">Enviar Formulário</h2>
                                <button
                                    onClick={resetAndClose}
                                    className="rounded-full p-2 text-k-text-secondary hover:bg-glass-bg hover:text-k-text-primary transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                                {/* Template Select */}
                                <div>
                                    <label className="block text-xs font-medium text-k-text-tertiary mb-1.5">
                                        Template
                                    </label>
                                    <select
                                        value={templateId}
                                        onChange={(e) => setTemplateId(e.target.value)}
                                        className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
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
                                    <label className="block text-xs font-medium text-k-text-tertiary mb-1.5">
                                        Prazo (opcional)
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
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                    deadlineDays === opt.value && !showDatePicker
                                                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                                                        : 'bg-glass-bg text-k-text-quaternary border border-k-border-subtle hover:text-k-text-secondary'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={selectCustomDate}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                showDatePicker
                                                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                                                    : 'bg-glass-bg text-k-text-quaternary border border-k-border-subtle hover:text-k-text-secondary'
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
                                            className="mt-2 w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-2.5 text-sm text-k-text-primary outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
                                        />
                                    )}
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-xs font-medium text-k-text-tertiary mb-1.5">
                                        Mensagem pessoal (opcional)
                                    </label>
                                    <textarea
                                        placeholder="Adicione uma nota pessoal para os alunos..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="min-h-[80px] w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 resize-none"
                                    />
                                </div>

                                {/* Students */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-medium text-k-text-tertiary">
                                            Alunos
                                        </label>
                                        {students.length > 0 && (
                                            <button
                                                onClick={toggleAll}
                                                className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                                            >
                                                {selectedStudentIds.length === students.length ? 'Desmarcar todos' : 'Selecionar todos'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-48 overflow-y-auto rounded-xl border border-k-border-subtle bg-glass-bg p-2">
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
                                                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                                                                isSelected
                                                                    ? 'bg-violet-500/10'
                                                                    : 'hover:bg-surface-elevated'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleStudent(student.id)}
                                                                className="h-4 w-4 rounded border-k-border-subtle text-violet-600 focus:ring-violet-500 accent-violet-600"
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
                                                                    ? 'text-violet-400'
                                                                    : 'text-k-text-primary'
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
                                    <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                                        <p>{result}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="border-t border-k-border-subtle px-6 py-4">
                                <button
                                    onClick={handleAssign}
                                    disabled={isAssigning || !canSubmit}
                                    className={`w-full h-11 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                        canSubmit
                                            ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20'
                                            : 'bg-surface-elevated text-k-text-quaternary cursor-not-allowed'
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

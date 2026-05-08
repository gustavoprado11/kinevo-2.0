'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, Loader2, X } from 'lucide-react'
import { createAssessmentSession } from '@/actions/assessments/create-session'
import { useToast } from '@/components/ui/toast'
import { Z } from '@/lib/z-index'

interface StudentOption {
    id: string
    name: string
    avatar_url?: string | null
}

interface AssessmentTemplateOption {
    id: string
    title: string
}

interface CreateSessionModalProps {
    open: boolean
    onClose: () => void
    students: StudentOption[]
    templates: AssessmentTemplateOption[]
    /** Optional: pre-select a student (e.g. opened from /students/[id]). */
    presetStudentId?: string
    /** Called with the new session id on successful creation. */
    onCreated?: (sessionId: string) => void
}

export function CreateSessionModal({
    open,
    onClose,
    students,
    templates,
    presetStudentId,
    onCreated,
}: CreateSessionModalProps) {
    const { toast } = useToast()

    const [studentId, setStudentId] = useState<string>(presetStudentId ?? '')
    const [templateId, setTemplateId] = useState<string>('')
    const [scheduledAt, setScheduledAt] = useState<string>('')
    const [sex, setSex] = useState<'male' | 'female' | ''>('')
    const [age, setAge] = useState<string>('')
    const [notes, setNotes] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset on open
    useEffect(() => {
        if (open) {
            setStudentId(presetStudentId ?? '')
            setTemplateId(templates[0]?.id ?? '')
            setScheduledAt('')
            setSex('')
            setAge('')
            setNotes('')
            setError(null)
        }
    }, [open, presetStudentId, templates])

    const ageNumber = age ? parseInt(age, 10) : null
    const ageValid = ageNumber == null || (Number.isFinite(ageNumber) && ageNumber >= 5 && ageNumber <= 120)

    const canSubmit =
        !submitting
        && studentId.length > 0
        && templateId.length > 0
        && sex.length > 0
        && ageValid

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return
        setSubmitting(true)
        setError(null)
        try {
            const result = await createAssessmentSession({
                studentId,
                templateId,
                scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
                notes: notes.trim() || null,
                subjectSex: sex || null,
                subjectAgeYears: ageNumber,
            })
            if (!result.success || !result.sessionId) {
                // Heuristic: action returns a "Sessão criada mas contexto..."
                // message when create succeeded but the subject_sex/age save
                // failed. Surface a friendly toast and still close, since the
                // session exists and the user can fix it later.
                if (result.error?.startsWith('Sessão criada mas contexto')) {
                    toast({
                        type: 'error',
                        message:
                            'Sessão criada, mas dados do aluno não foram salvos. Abra a sessão e tente novamente.',
                    })
                    onClose()
                    return
                }
                setError(result.error ?? 'Erro ao criar avaliação')
                return
            }
            toast({ type: 'success', message: 'Avaliação criada' })
            onCreated?.(result.sessionId)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro inesperado')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/40"
                        style={{ zIndex: Z.MODAL }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="fixed inset-0 flex items-center justify-center p-4"
                        style={{ zIndex: Z.MODAL + 1 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className="w-full max-w-md overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <header className="flex items-center justify-between border-b border-k-border-subtle px-5 py-4">
                                <div>
                                    <h2 className="text-base font-semibold text-k-text-primary">Nova avaliação</h2>
                                    <p className="text-xs text-k-text-tertiary">Avaliação presencial</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Fechar"
                                    className="rounded-md p-1 text-k-text-tertiary hover:bg-surface-inset hover:text-k-text-primary"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </header>

                            <form onSubmit={handleSubmit} className="space-y-4 p-5">
                                <Field label="Aluno" required>
                                    <select
                                        value={studentId}
                                        onChange={e => setStudentId(e.target.value)}
                                        disabled={!!presetStudentId}
                                        className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none disabled:opacity-60"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Template" required>
                                    <select
                                        value={templateId}
                                        onChange={e => setTemplateId(e.target.value)}
                                        className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.title}</option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Quando" hint="Deixe em branco para começar agora.">
                                    <div className="relative">
                                        <input
                                            type="datetime-local"
                                            value={scheduledAt}
                                            onChange={e => setScheduledAt(e.target.value)}
                                            className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 pr-9 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                                        />
                                        <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-k-text-quaternary" />
                                    </div>
                                </Field>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Sexo biológico" required hint="Necessário p/ cálculos">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <SexButton active={sex === 'male'} onClick={() => setSex('male')}>
                                                Masculino
                                            </SexButton>
                                            <SexButton active={sex === 'female'} onClick={() => setSex('female')}>
                                                Feminino
                                            </SexButton>
                                        </div>
                                    </Field>
                                    <Field
                                        label="Idade (anos)"
                                        required
                                        error={age.length > 0 && !ageValid ? 'Entre 5 e 120' : undefined}
                                    >
                                        <input
                                            type="number"
                                            min={5}
                                            max={120}
                                            value={age}
                                            onChange={e => setAge(e.target.value)}
                                            placeholder="ex: 32"
                                            className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                                            required
                                        />
                                    </Field>
                                </div>

                                <Field label="Observações (opcional)">
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        rows={2}
                                        placeholder="Notas sobre a avaliação..."
                                        className="w-full resize-none rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                                    />
                                </Field>

                                {error && (
                                    <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                                        {error}
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!canSubmit}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Criar avaliação
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

function Field({
    label,
    hint,
    error,
    required,
    children,
}: {
    label: string
    hint?: string
    error?: string
    required?: boolean
    children: React.ReactNode
}) {
    return (
        <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                {label} {required && <span className="text-violet-500 dark:text-violet-400">*</span>}
            </label>
            {children}
            {hint && !error && (
                <div className="mt-1 text-[11px] text-k-text-quaternary">{hint}</div>
            )}
            {error && (
                <div className="mt-1 text-[11px] text-red-500">{error}</div>
            )}
        </div>
    )
}

function SexButton({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                active
                    ? 'border-violet-500 bg-violet-500/10 text-violet-500 dark:text-violet-400'
                    : 'border-k-border-subtle bg-surface-inset text-k-text-secondary hover:border-violet-500/40'
            }`}
        >
            {children}
        </button>
    )
}

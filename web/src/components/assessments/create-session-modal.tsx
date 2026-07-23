'use client'

import { useEffect, useState } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import { createAssessmentSession } from '@/actions/assessments/create-session'
import { useToast } from '@/components/ui/toast'
import { ModalShell } from '@/components/shared/modal-shell'
import { StudentPicker, type StudentPickerOption } from '@/components/shared/student-picker'
import { TemplatePicker } from '@/components/shared/template-picker'

interface AssessmentTemplateOption {
    id: string
    title: string
}

interface CreateSessionModalProps {
    open: boolean
    onClose: () => void
    students: StudentPickerOption[]
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

    const footer = (
        <div className="flex items-center justify-end gap-2">
            <button
                type="button"
                onClick={onClose}
                className="rounded-control px-3 py-1.5 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
            >
                Cancelar
            </button>
            <button
                type="submit"
                form="create-session-form"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar avaliação
            </button>
        </div>
    )

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Nova avaliação"
            description="Avaliação presencial"
            footer={footer}
        >
            <form id="create-session-form" onSubmit={handleSubmit} className="space-y-4 p-5">
                <Field label="Aluno" required>
                    <StudentPicker
                        mode="single"
                        students={students}
                        value={studentId}
                        onChange={setStudentId}
                        lockedStudentId={presetStudentId}
                    />
                </Field>

                <Field label="Template" required>
                    <TemplatePicker
                        category="assessment"
                        templates={templates}
                        value={templateId}
                        onChange={setTemplateId}
                    />
                </Field>

                <Field label="Quando" hint="Deixe em branco para começar agora.">
                    <div className="relative">
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                            className="w-full rounded-control border border-k-border-subtle bg-surface-inset px-2.5 py-2 pr-9 text-sm text-k-text-primary font-mono tabular-nums focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
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
                            className="w-full rounded-control border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary font-mono tabular-nums focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
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
                        className="w-full resize-none rounded-control border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
                    />
                </Field>

                {error && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                        {error}
                    </div>
                )}
            </form>
        </ModalShell>
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
            <label className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-k-text-tertiary">
                {label} {required && <span className="text-k-text-tertiary">*</span>}
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
            className={`rounded-control border px-2 py-2 text-xs font-medium transition-colors ${
                active
                    ? 'border-k-border-primary bg-surface-inset text-k-text-primary font-semibold'
                    : 'border-k-border-primary bg-surface-card text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset'
            }`}
        >
            {children}
        </button>
    )
}

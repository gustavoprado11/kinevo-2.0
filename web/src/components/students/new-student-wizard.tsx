'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Loader2, Send } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { WizardShell } from '@/components/shared/wizard-shell'
import { TemplatePicker } from '@/components/shared/template-picker'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { createAssessmentSession } from '@/actions/assessments/create-session'

export interface WizardStudent {
    id: string
    name: string
    avatar_url?: string | null
}

export interface WizardTemplate {
    id: string
    title: string
    /** Categoria usada pra filtrar e ajustar copy. */
    category: 'anamnese' | 'checkin' | 'survey' | 'assessment' | string
}

interface NewStudentWizardProps {
    open: boolean
    onClose: () => void
    student: WizardStudent | null
    /** Templates de anamnese (filtrados pelo caller, category='anamnese'). */
    anamneseTemplates: WizardTemplate[]
    /** Templates de avaliação (category='assessment'). */
    assessmentTemplates: WizardTemplate[]
    /**
     * Form que o trainer já enviou via dropdown atalho do StudentModal
     * (decisão B do M9). Quando provido, Step 1 mostra "já enviada" e
     * pode ser pulado automaticamente. */
    preassignedAnamnese?: { id: string; title: string } | null
}

type StepNumber = 1 | 2

// M9 — wizard de 2 steps que abre após criar aluno novo.
// Step 1: anamnese. Step 2: primeira avaliação. Cada um pulável.
export function NewStudentWizard({
    open,
    onClose,
    student,
    anamneseTemplates,
    assessmentTemplates,
    preassignedAnamnese,
}: NewStudentWizardProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [currentStep, setCurrentStep] = useState<StepNumber>(1)

    // Step 1 state
    const [anamneseTemplateId, setAnamneseTemplateId] = useState('')
    const [anamneseMessage, setAnamneseMessage] = useState('')
    const [anamneseAssigning, setAnamneseAssigning] = useState(false)
    const [anamneseSent, setAnamneseSent] = useState<{ id: string; title: string } | null>(null)
    const [anamneseSkipped, setAnamneseSkipped] = useState(false)

    // Step 2 state
    const [assessmentTemplateId, setAssessmentTemplateId] = useState('')
    const [sex, setSex] = useState<'male' | 'female' | ''>('')
    const [age, setAge] = useState('')
    const [scheduledAt, setScheduledAt] = useState('')
    const [assessmentNotes, setAssessmentNotes] = useState('')
    const [assessmentSubmitting, setAssessmentSubmitting] = useState(false)
    const [assessmentScheduled, setAssessmentScheduled] = useState<{ scheduledAt: string | null } | null>(null)

    // Reset on open
    useEffect(() => {
        if (open) {
            setCurrentStep(1)
            setAnamneseTemplateId('')
            setAnamneseMessage('')
            setAnamneseAssigning(false)
            setAnamneseSent(preassignedAnamnese ?? null)
            setAnamneseSkipped(false)
            setAssessmentTemplateId(assessmentTemplates[0]?.id ?? '')
            setSex('')
            setAge('')
            setScheduledAt('')
            setAssessmentNotes('')
            setAssessmentSubmitting(false)
            setAssessmentScheduled(null)
        }
    }, [open, preassignedAnamnese, assessmentTemplates])

    const ageNumber = age ? parseInt(age, 10) : null
    const ageValid =
        ageNumber == null
        || (Number.isFinite(ageNumber) && ageNumber >= 5 && ageNumber <= 120)

    const canSubmitAssessment =
        !assessmentSubmitting
        && assessmentTemplateId.length > 0
        && sex.length > 0
        && age.length > 0
        && ageValid

    // Dirty: tem coisa não submetida que perderia ao fechar?
    const dirty = useMemo(() => {
        if (anamneseAssigning || assessmentSubmitting) return true
        // Step 1 com dados ainda não enviados nem pulados
        if (!anamneseSent && !anamneseSkipped && (anamneseTemplateId.length > 0 || anamneseMessage.length > 0)) return true
        // Step 2 com dados ainda não enviados
        if (!assessmentScheduled && (assessmentTemplateId.length > 0 || sex.length > 0 || age.length > 0 || scheduledAt.length > 0 || assessmentNotes.length > 0)) {
            // Não conta o template default que vem pre-selecionado
            const hasUserInput =
                sex.length > 0
                || age.length > 0
                || scheduledAt.length > 0
                || assessmentNotes.length > 0
            if (hasUserInput) return true
        }
        return false
    }, [
        anamneseAssigning, assessmentSubmitting,
        anamneseSent, anamneseSkipped, anamneseTemplateId, anamneseMessage,
        assessmentScheduled, assessmentTemplateId, sex, age, scheduledAt, assessmentNotes,
    ])

    const handleRequestClose = () => {
        if (anamneseAssigning || assessmentSubmitting) return // não fecha durante action
        if (dirty) {
            const ok = window.confirm(
                'Você tem dados não enviados neste wizard. Fechar agora vai descartá-los. Continuar?',
            )
            if (!ok) return
        }
        emitDoneToasts()
        finishAndClose({ navigate: !!student })
    }

    // Ordem cronológica (anamnese antes de avaliação) e só do que foi feito.
    // Aceita override explícito do scheduled state pra contornar setState batching
    // quando chamado imediatamente após `setAssessmentScheduled(...)`.
    const emitDoneToasts = (
        overrideAssessment?: { scheduledAt: string | null } | null,
    ) => {
        if (!student) return
        if (anamneseSent) {
            toast({ type: 'success', message: `Anamnese enviada para ${student.name}` })
        }
        const scheduled = overrideAssessment ?? assessmentScheduled
        if (scheduled) {
            if (scheduled.scheduledAt) {
                const formatted = new Date(scheduled.scheduledAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                })
                toast({ type: 'success', message: `Avaliação agendada para ${formatted}` })
            } else {
                toast({ type: 'success', message: 'Avaliação criada e em andamento' })
            }
        }
    }

    const finishAndClose = ({ navigate }: { navigate: boolean }) => {
        if (navigate && student) {
            router.push(`/students/${student.id}`)
        }
        onClose()
    }

    const handleSubmitAnamnese = async () => {
        if (!student || !anamneseTemplateId) return
        setAnamneseAssigning(true)
        try {
            const res = await assignFormToStudents({
                formTemplateId: anamneseTemplateId,
                studentIds: [student.id],
                message: anamneseMessage.trim() || undefined,
            })
            if (!res.success) {
                toast({ type: 'error', message: res.error ?? 'Erro ao enviar anamnese' })
                return
            }
            const sentTemplate = anamneseTemplates.find(t => t.id === anamneseTemplateId)
            setAnamneseSent({ id: anamneseTemplateId, title: sentTemplate?.title ?? 'Anamnese' })
            setCurrentStep(2)
        } finally {
            setAnamneseAssigning(false)
        }
    }

    const handleSkipAnamnese = () => {
        setAnamneseSkipped(true)
        setCurrentStep(2)
    }

    const handleSubmitAssessment = async () => {
        if (!student || !canSubmitAssessment) return
        setAssessmentSubmitting(true)
        try {
            const result = await createAssessmentSession({
                studentId: student.id,
                templateId: assessmentTemplateId,
                scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
                notes: assessmentNotes.trim() || null,
                subjectSex: (sex || null) as 'male' | 'female' | null,
                subjectAgeYears: ageNumber,
            })
            if (!result.success || !result.sessionId) {
                if (result.error?.startsWith('Sessão criada mas contexto')) {
                    toast({
                        type: 'error',
                        message: 'Avaliação criada, mas dados do aluno não foram salvos. Abra a sessão e tente novamente.',
                    })
                    const scheduled = { scheduledAt: scheduledAt || null }
                    setAssessmentScheduled(scheduled)
                    finishWizardSuccess(scheduled)
                    return
                }
                toast({ type: 'error', message: result.error ?? 'Erro ao criar avaliação' })
                return
            }
            const scheduled = { scheduledAt: scheduledAt || null }
            setAssessmentScheduled(scheduled)
            finishWizardSuccess(scheduled)
        } finally {
            setAssessmentSubmitting(false)
        }
    }

    const finishWizardSuccess = (
        scheduledOverride?: { scheduledAt: string | null } | null,
    ) => {
        // Emite toasts com override do scheduled state (acabou de ser setado,
        // não é seguro confiar no closure neste tick) e navega pro aluno.
        emitDoneToasts(scheduledOverride)
        finishAndClose({ navigate: true })
    }

    const handleSkipAssessment = () => {
        // Sem dados de step 2 — só finaliza com toasts do que foi feito.
        emitDoneToasts()
        finishAndClose({ navigate: true })
    }

    if (!student) return null

    const step1Footer = anamneseSent ? (
        <div className="flex justify-end">
            <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
            >
                Continuar
            </button>
        </div>
    ) : (
        <div className="flex items-center justify-between gap-3">
            <button
                type="button"
                data-onboarding="wizard-skip"
                onClick={handleSkipAnamnese}
                disabled={anamneseAssigning}
                className="rounded-lg px-3 py-2 text-sm font-medium text-k-text-secondary hover:bg-surface-inset disabled:opacity-50"
            >
                Pular
            </button>
            <button
                type="button"
                onClick={handleSubmitAnamnese}
                disabled={anamneseAssigning || !anamneseTemplateId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {anamneseAssigning ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando…
                    </>
                ) : (
                    <>
                        <Send className="h-4 w-4" />
                        Enviar e continuar
                    </>
                )}
            </button>
        </div>
    )

    const step2Footer = (
        <div className="flex items-center justify-between gap-3">
            <button
                type="button"
                onClick={() => setCurrentStep(1)}
                disabled={assessmentSubmitting}
                className="rounded-lg px-3 py-2 text-sm font-medium text-k-text-secondary hover:bg-surface-inset disabled:opacity-50"
            >
                Voltar
            </button>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleSkipAssessment}
                    disabled={assessmentSubmitting}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-k-text-secondary hover:bg-surface-inset disabled:opacity-50"
                >
                    Pular
                </button>
                <button
                    type="button"
                    onClick={handleSubmitAssessment}
                    disabled={!canSubmitAssessment}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {assessmentSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Agendando…
                        </>
                    ) : (
                        'Agendar e finalizar'
                    )}
                </button>
            </div>
        </div>
    )

    return (
        <WizardShell
            open={open}
            onRequestClose={handleRequestClose}
            studentName={student.name}
            studentAvatar={student.avatar_url}
            currentStep={currentStep}
            totalSteps={2}
            footer={currentStep === 1 ? step1Footer : step2Footer}
        >
            {currentStep === 1 && (
                <Step1Anamnese
                    studentName={student.name}
                    templates={anamneseTemplates}
                    templateId={anamneseTemplateId}
                    onTemplateChange={setAnamneseTemplateId}
                    message={anamneseMessage}
                    onMessageChange={setAnamneseMessage}
                    sent={anamneseSent}
                />
            )}
            {currentStep === 2 && (
                <Step2Assessment
                    studentName={student.name}
                    templates={assessmentTemplates}
                    templateId={assessmentTemplateId}
                    onTemplateChange={setAssessmentTemplateId}
                    sex={sex}
                    onSexChange={setSex}
                    age={age}
                    onAgeChange={setAge}
                    ageValid={ageValid}
                    scheduledAt={scheduledAt}
                    onScheduledAtChange={setScheduledAt}
                    notes={assessmentNotes}
                    onNotesChange={setAssessmentNotes}
                />
            )}
        </WizardShell>
    )
}

function Step1Anamnese({
    studentName,
    templates,
    templateId,
    onTemplateChange,
    message,
    onMessageChange,
    sent,
}: {
    studentName: string
    templates: WizardTemplate[]
    templateId: string
    onTemplateChange: (id: string) => void
    message: string
    onMessageChange: (m: string) => void
    sent: { id: string; title: string } | null
}) {
    const firstName = studentName.split(' ')[0] || studentName

    return (
        <div data-onboarding="wizard-step-1" className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-k-text-primary">
                    Envie uma anamnese para começar
                </h2>
                <p className="mt-1 text-sm text-k-text-tertiary">
                    A anamnese ajuda você a conhecer {firstName} antes da primeira sessão.
                    Pule se preferir capturar tudo presencialmente.
                </p>
            </div>

            {sent ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Anamnese enviada
                    </div>
                    <div className="mt-0.5 text-xs text-k-text-tertiary">
                        {sent.title}
                    </div>
                </div>
            ) : (
                <>
                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                            Template de anamnese
                        </label>
                        <TemplatePicker
                            category="form"
                            templates={templates.map(t => ({ id: t.id, title: t.title }))}
                            value={templateId}
                            onChange={onTemplateChange}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                            Mensagem pessoal{' '}
                            <span className="font-normal normal-case text-k-text-quaternary">(opcional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={e => onMessageChange(e.target.value)}
                            rows={3}
                            placeholder={`Deixe uma nota pra ${firstName}...`}
                            className="w-full resize-none rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:border-violet-500 focus:outline-none"
                        />
                    </div>
                </>
            )}
        </div>
    )
}

function Step2Assessment({
    studentName,
    templates,
    templateId,
    onTemplateChange,
    sex,
    onSexChange,
    age,
    onAgeChange,
    ageValid,
    scheduledAt,
    onScheduledAtChange,
    notes,
    onNotesChange,
}: {
    studentName: string
    templates: WizardTemplate[]
    templateId: string
    onTemplateChange: (id: string) => void
    sex: 'male' | 'female' | ''
    onSexChange: (s: 'male' | 'female' | '') => void
    age: string
    onAgeChange: (a: string) => void
    ageValid: boolean
    scheduledAt: string
    onScheduledAtChange: (s: string) => void
    notes: string
    onNotesChange: (n: string) => void
}) {
    const firstName = studentName.split(' ')[0] || studentName

    return (
        <div data-onboarding="wizard-step-2" className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-k-text-primary">
                    Agende a primeira avaliação presencial
                </h2>
                <p className="mt-1 text-sm text-k-text-tertiary">
                    Agende a captura de medições com {firstName}. Pode ser hoje ou daqui umas semanas.
                </p>
            </div>

            <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                    Template de avaliação <span className="text-violet-500">*</span>
                </label>
                <TemplatePicker
                    category="assessment"
                    templates={templates.map(t => ({ id: t.id, title: t.title }))}
                    value={templateId}
                    onChange={onTemplateChange}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                        Sexo biológico <span className="text-violet-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                        <SexButton active={sex === 'male'} onClick={() => onSexChange('male')}>
                            Masculino
                        </SexButton>
                        <SexButton active={sex === 'female'} onClick={() => onSexChange('female')}>
                            Feminino
                        </SexButton>
                    </div>
                    <div className="mt-1 text-[11px] text-k-text-quaternary">
                        Necessário p/ cálculos
                    </div>
                </div>
                <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                        Idade (anos) <span className="text-violet-500">*</span>
                    </label>
                    <input
                        type="number"
                        min={5}
                        max={120}
                        value={age}
                        onChange={e => onAgeChange(e.target.value)}
                        placeholder="ex: 32"
                        className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                    />
                    {age.length > 0 && !ageValid && (
                        <div className="mt-1 text-[11px] text-red-500">Entre 5 e 120</div>
                    )}
                </div>
            </div>

            <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                    Quando
                </label>
                <div className="relative">
                    <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={e => onScheduledAtChange(e.target.value)}
                        className="w-full rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 pr-9 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                    />
                    <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-k-text-quaternary" />
                </div>
                <div className="mt-1 text-[11px] text-k-text-quaternary">
                    Deixe em branco para começar agora.
                </div>
            </div>

            <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-k-text-tertiary">
                    Observações{' '}
                    <span className="font-normal normal-case text-k-text-quaternary">(opcional)</span>
                </label>
                <textarea
                    value={notes}
                    onChange={e => onNotesChange(e.target.value)}
                    rows={2}
                    placeholder="Notas sobre a avaliação..."
                    className="w-full resize-none rounded-md border border-k-border-subtle bg-surface-inset px-2.5 py-2 text-sm text-k-text-primary focus:border-violet-500 focus:outline-none"
                />
            </div>
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

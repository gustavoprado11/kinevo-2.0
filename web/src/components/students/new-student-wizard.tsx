'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { WizardShell } from '@/components/shared/wizard-shell'
import { TemplatePicker } from '@/components/shared/template-picker'
import { assignFormToStudents } from '@/actions/forms/assign-form'

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
    assessmentTemplates: _assessmentTemplates, // usado em B2
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

    // Reset on open
    useEffect(() => {
        if (open) {
            setCurrentStep(1)
            setAnamneseTemplateId('')
            setAnamneseMessage('')
            setAnamneseAssigning(false)
            setAnamneseSent(preassignedAnamnese ?? null)
            setAnamneseSkipped(false)
        }
    }, [open, preassignedAnamnese])

    // Dirty: tem coisa não submetida que perderia ao fechar?
    const dirty = useMemo(() => {
        if (anamneseAssigning) return true
        if (currentStep === 1 && !anamneseSent && (anamneseTemplateId.length > 0 || anamneseMessage.length > 0)) return true
        // Step 2 dirty calc adicionado em B2
        return false
    }, [currentStep, anamneseTemplateId, anamneseMessage, anamneseSent, anamneseAssigning])

    const handleRequestClose = () => {
        if (anamneseAssigning) return // não fecha durante action
        if (dirty) {
            const ok = window.confirm(
                'Você tem dados não enviados neste wizard. Fechar agora vai descartá-los. Continuar?',
            )
            if (!ok) return
        }
        finishAndClose({ navigate: false })
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

    // Placeholder Step 2 (real implementation em B2)
    const step2Footer = (
        <div className="flex items-center justify-between gap-3">
            <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
            >
                Voltar
            </button>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => finishAndClose({ navigate: true })}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-k-text-secondary hover:bg-surface-inset"
                >
                    Pular
                </button>
                <button
                    type="button"
                    onClick={() => finishAndClose({ navigate: true })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
                >
                    Finalizar
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
                    skipped={anamneseSkipped}
                />
            )}
            {currentStep === 2 && (
                <Step2Placeholder studentName={student.name} />
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
    skipped: boolean
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

// Placeholder em B1; substituído por implementação real em B2.
function Step2Placeholder({ studentName }: { studentName: string }) {
    const firstName = studentName.split(' ')[0] || studentName
    return (
        <div data-onboarding="wizard-step-2" className="space-y-3">
            <h2 className="text-lg font-semibold text-k-text-primary">
                Agende a primeira avaliação presencial
            </h2>
            <p className="text-sm text-k-text-tertiary">
                Agende a captura de medições com {firstName}. Pode ser hoje ou daqui a algumas semanas.
            </p>
            <div className="rounded-xl border border-dashed border-k-border-subtle bg-surface-inset px-4 py-6 text-center text-xs text-k-text-quaternary">
                Step 2 — implementação completa em B2.
            </div>
        </div>
    )
}

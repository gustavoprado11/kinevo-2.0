'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, FileText } from 'lucide-react'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'
import {
    createAssessmentTemplate,
    updateAssessmentTemplate,
} from '@/actions/assessments/update-template'
import { useToast } from '@/components/ui/toast'
import { AssessmentBuilderCanvas } from '@/components/assessments/builder/assessment-builder-canvas'
import { BuilderWizardShell } from '@/components/shared/builder-wizard-shell'
import { ModalShell } from '@/components/shared/modal-shell'

interface KinevoTemplateOption {
    id: string
    title: string
    description: string | null
    schema: AssessmentTemplateSchema
}

interface AssessmentBuilderPageClientProps {
    templateId: string | null
    initialTitle: string
    initialDescription: string | null
    initialSchema: AssessmentTemplateSchema
    kinevoTemplates: KinevoTemplateOption[]
}

const EMPTY_SCHEMA: AssessmentTemplateSchema = {
    schema_version: '1.0',
    sections: [],
}

export function AssessmentBuilderPageClient({
    templateId,
    initialTitle,
    initialDescription,
    initialSchema,
    kinevoTemplates,
}: AssessmentBuilderPageClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const isEditing = templateId !== null

    // Step (1: Tipo, 2: Configurar, 3: Editor)
    const [step, setStep] = useState<1 | 2 | 3>(isEditing ? 3 : 1)

    // Wizard state
    const [title, setTitle] = useState(initialTitle)
    const [description, setDescription] = useState(initialDescription ?? '')
    const [schemaSeed, setSchemaSeed] = useState<AssessmentTemplateSchema>(initialSchema)
    const [kinevoModalOpen, setKinevoModalOpen] = useState(false)

    const [saving, setSaving] = useState(false)
    // Estado vivo do canvas, propagado via onStateChange (Step 3 only).
    const [shellState, setShellState] = useState({
        title: initialTitle,
        isDirty: false,
        canSave: false,
        save: async () => { /* placeholder até canvas montar */ },
    })

    const handleStateChange = useCallback((s: {
        title: string
        isDirty: boolean
        canSave: boolean
        save: () => Promise<void>
    }) => {
        setShellState(s)
    }, [])

    const startBlank = () => {
        setSchemaSeed(EMPTY_SCHEMA)
        setStep(2)
    }

    const startFromKinevo = (template: KinevoTemplateOption) => {
        // Clona schema do Kinevo (deep clone via JSON pra evitar mutação no original).
        const cloned = JSON.parse(JSON.stringify(template.schema)) as AssessmentTemplateSchema
        setSchemaSeed(cloned)
        // Pré-popula nome com sugestão "[Kinevo title] (cópia)" — trainer pode editar.
        if (!title) {
            setTitle(`${template.title} (cópia)`)
        }
        setKinevoModalOpen(false)
        setStep(2)
    }

    // Wizard chrome state — Step 3 delega ao canvas; Steps 1+2 usam estado local.
    // No Step 3 o nome/descrição vivem (editáveis) no topo do canvas, então o
    // header fica genérico pra não duplicar o título na tela.
    const wizardTitle = step === 3
        ? (isEditing ? 'Editar avaliação' : 'Nova avaliação')
        : isEditing
            ? `Editar template${title ? ` — ${title}` : ''}`
            : title || 'Novo template de avaliação'

    const wizardSubtitle = isEditing && step !== 3 ? 'Editando template' : null

    const isDirtyForShell = step === 3 ? shellState.isDirty : (title.trim().length > 0 || schemaSeed.sections.length > 0)
    const canSaveForShell = step === 3 ? (shellState.canSave && !saving) : false

    return (
        <BuilderWizardShell
            title={wizardTitle}
            subtitle={wizardSubtitle}
            currentStep={step}
            hideStepIndicator={isEditing}
            onExit={() => router.push('/avaliacoes')}
            onAdvance={() => {
                if (step === 1) setStep(2)
                else if (step === 2) setStep(3)
            }}
            onBack={() => {
                if (step === 3) setStep(2)
                else if (step === 2) setStep(1)
            }}
            canAdvance={
                step === 1 ? false /* avança via card click */
                : step === 2 ? title.trim().length > 0
                : false
            }
            hideAdvance={step === 1}
            canSave={canSaveForShell}
            onSave={() => shellState.save()}
            isDirty={isDirtyForShell}
            isSaving={saving}
        >
            {/* ════════════════════════════════════════════════
                STEP 1: TIPO — 2 cards (Em branco / Partir de Kinevo)
            ════════════════════════════════════════════════ */}
            {step === 1 && (
                <div className="flex min-h-[62vh] items-center justify-center bg-surface-primary p-4 font-sans">
                    <div className="w-full max-w-3xl mx-auto">
                        <p className="text-center text-lg font-semibold text-k-text-primary mb-2">
                            Como deseja começar sua avaliação?
                        </p>
                        <p className="text-center text-sm text-k-text-tertiary mb-6">
                            Crie do zero ou parta de um template Kinevo pronto.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Card: Em branco */}
                            <button
                                onClick={startBlank}
                                className="group text-left rounded-panel border border-k-border-subtle bg-surface-card p-5 hover:bg-surface-inset hover:border-k-border-primary cursor-pointer transition-colors"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset mb-3">
                                    <FileText size={20} className="text-k-text-tertiary" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm font-semibold text-k-text-primary mb-1">
                                    Em branco
                                </h3>
                                <p className="text-xs text-k-text-tertiary leading-relaxed">
                                    Comece do zero — você escolhe seções e testes.
                                </p>
                            </button>

                            {/* Card: Partir de Kinevo */}
                            <button
                                onClick={() => setKinevoModalOpen(true)}
                                disabled={kinevoTemplates.length === 0}
                                className="group text-left rounded-panel border border-k-border-subtle bg-surface-card p-5 hover:bg-surface-inset hover:border-k-border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset mb-3">
                                    <Activity size={20} className="text-k-text-tertiary" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm font-semibold text-k-text-primary mb-1">
                                    Partir de template Kinevo
                                </h3>
                                <p className="text-xs text-k-text-tertiary leading-relaxed">
                                    Antropometria, J&amp;P, Petroski, Avaliação Inicial — clone e adapte.
                                </p>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════
                STEP 2: CONFIGURAR — nome + descrição
            ════════════════════════════════════════════════ */}
            {step === 2 && (
                <div className="flex min-h-[62vh] items-center justify-center bg-surface-primary p-4 font-sans">
                    <div className="w-full max-w-xl mx-auto">
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card p-8 space-y-6">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-k-text-primary">
                                    Nome do template <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Avaliação inicial completa"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-k-text-primary">
                                    Descrição <span className="font-normal text-k-text-tertiary">(opcional)</span>
                                </label>
                                <textarea
                                    placeholder="Descrição breve do propósito desta avaliação"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-[80px] w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 resize-none transition-colors"
                                />
                            </div>

                            {schemaSeed.sections.length > 0 && (
                                <div className="rounded-control border border-k-border-subtle bg-surface-inset px-3 py-2 text-xs text-k-text-secondary">
                                    Schema pré-preenchido com {schemaSeed.sections.length} {schemaSeed.sections.length === 1 ? 'seção' : 'seções'} do template Kinevo. Você poderá ajustar no próximo passo.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════
                STEP 3: EDITOR — canvas drag-drop
            ════════════════════════════════════════════════ */}
            {step === 3 && (
                <div className="min-h-0 flex-1">
                    <AssessmentBuilderCanvas
                        templateId={templateId}
                        initialTitle={title || initialTitle}
                        initialDescription={description || initialDescription}
                        initialSchema={schemaSeed}
                        saving={saving}
                        renderTopbar={false}
                        onStateChange={handleStateChange}
                        onSave={async ({ title: t, description: d, schema }) => {
                            setSaving(true)
                            try {
                                const result = templateId
                                    ? await updateAssessmentTemplate({
                                        templateId,
                                        title: t,
                                        description: d,
                                        schema,
                                    })
                                    : await createAssessmentTemplate({
                                        title: t,
                                        description: d,
                                        schema,
                                    })

                                if (!result.success) {
                                    toast({ type: 'error', message: result.error ?? 'Erro ao salvar' })
                                    return { success: false, error: result.error }
                                }

                                toast({ type: 'success', message: 'Template salvo' })
                                router.push('/avaliacoes')
                                router.refresh()
                                return { success: true }
                            } finally {
                                setSaving(false)
                            }
                        }}
                    />
                </div>
            )}

            {/* Modal Kinevo templates */}
            <ModalShell
                open={kinevoModalOpen}
                onClose={() => setKinevoModalOpen(false)}
                title="Templates Kinevo"
                description="Escolha um template pré-configurado. Você poderá ajustar tudo depois."
                size="lg"
            >
                <div className="space-y-2 p-5">
                    {kinevoTemplates.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => startFromKinevo(t)}
                            className="group w-full text-left rounded-control border border-k-border-subtle bg-surface-card p-4 hover:bg-surface-inset hover:border-k-border-primary transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset">
                                    <Activity size={14} className="text-k-text-tertiary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-k-text-primary">
                                        {t.title}
                                    </p>
                                    {t.description && (
                                        <p className="mt-0.5 text-xs text-k-text-tertiary line-clamp-2">
                                            {t.description}
                                        </p>
                                    )}
                                    <p className="mt-1 font-mono text-[11px] tabular-nums text-k-text-quaternary">
                                        {t.schema.sections.length} {t.schema.sections.length === 1 ? 'seção' : 'seções'}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </ModalShell>
        </BuilderWizardShell>
    )
}

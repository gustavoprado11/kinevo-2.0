'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, FileText, X } from 'lucide-react'
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments'
import {
    createAssessmentTemplate,
    updateAssessmentTemplate,
} from '@/actions/assessments/update-template'
import { useToast } from '@/components/ui/toast'
import { AssessmentBuilderCanvas } from '@/components/assessments/builder/assessment-builder-canvas'
import { BuilderWizardShell } from '@/components/shared/builder-wizard-shell'
import { Z } from '@/lib/z-index'

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
    const wizardTitle = isEditing
        ? `Editar template${title ? ` — ${title}` : ''}`
        : title || 'Novo template de avaliação'

    const wizardSubtitle = isEditing ? 'Editando template' : null

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
            canSave={canSaveForShell}
            onSave={() => shellState.save()}
            isDirty={isDirtyForShell}
            isSaving={saving}
        >
            {/* ════════════════════════════════════════════════
                STEP 1: TIPO — 2 cards (Em branco / Partir de Kinevo)
            ════════════════════════════════════════════════ */}
            {step === 1 && (
                <div className="bg-surface-primary p-4 font-sans">
                    <div className="max-w-3xl mx-auto">
                        <p className="text-center text-lg font-semibold text-[#1D1D1F] mb-2 dark:text-k-text-primary">
                            Como deseja começar sua avaliação?
                        </p>
                        <p className="text-center text-sm text-[#86868B] mb-6 dark:text-k-text-tertiary">
                            Crie do zero ou parta de um template Kinevo pronto.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Card: Em branco */}
                            <button
                                onClick={startBlank}
                                className="group text-left rounded-xl border border-[#D2D2D7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:border-[#007AFF] cursor-pointer transition-all duration-200 dark:border-k-border-primary dark:bg-surface-card dark:shadow-none dark:hover:border-violet-500/30 dark:hover:bg-glass-bg"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] group-hover:bg-[#007AFF]/10 mb-3 transition-colors dark:bg-surface-elevated dark:group-hover:bg-violet-500/10">
                                    <FileText size={20} className="text-[#AEAEB2] group-hover:text-[#007AFF] dark:text-violet-400" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1 dark:text-k-text-primary dark:group-hover:text-violet-300 transition-colors">
                                    Em branco
                                </h3>
                                <p className="text-xs text-[#86868B] leading-relaxed dark:text-k-text-quaternary">
                                    Comece do zero — você escolhe seções e testes.
                                </p>
                            </button>

                            {/* Card: Partir de Kinevo */}
                            <button
                                onClick={() => setKinevoModalOpen(true)}
                                disabled={kinevoTemplates.length === 0}
                                className="group text-left rounded-xl border border-[#D2D2D7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:border-[#007AFF] cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed dark:border-k-border-primary dark:bg-surface-card dark:shadow-none dark:hover:border-violet-500/30 dark:hover:bg-glass-bg"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] group-hover:bg-[#007AFF]/10 mb-3 transition-colors dark:bg-surface-elevated dark:group-hover:bg-violet-500/10">
                                    <Activity size={20} className="text-[#AEAEB2] group-hover:text-[#007AFF] dark:text-violet-400" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1 dark:text-k-text-primary dark:group-hover:text-violet-300 transition-colors">
                                    Partir de template Kinevo
                                </h3>
                                <p className="text-xs text-[#86868B] leading-relaxed dark:text-k-text-quaternary">
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
                <div className="bg-surface-primary p-4 font-sans">
                    <div className="max-w-xl mx-auto">
                        <div className="rounded-2xl border border-[#D2D2D7] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-6 dark:border-k-border-primary dark:bg-surface-card dark:shadow-xl">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-[#1D1D1F] dark:text-xs dark:text-k-text-tertiary">
                                    Nome do template <span className="text-[#FF3B30] dark:text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Avaliação inicial completa"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 transition-all dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:placeholder:text-k-text-quaternary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-[#1D1D1F] dark:text-xs dark:text-k-text-tertiary">
                                    Descrição <span className="font-normal text-[#86868B] dark:text-k-text-quaternary">(opcional)</span>
                                </label>
                                <textarea
                                    placeholder="Descrição breve do propósito desta avaliação"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-[80px] w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 resize-none transition-all dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:placeholder:text-k-text-quaternary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                                />
                            </div>

                            {schemaSeed.sections.length > 0 && (
                                <div className="rounded-lg bg-[#007AFF]/5 border border-[#007AFF]/15 px-3 py-2 text-xs text-[#007AFF] dark:bg-violet-500/5 dark:border-violet-500/20 dark:text-violet-400">
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
            {kinevoModalOpen && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    style={{ zIndex: Z.MODAL }}
                    onClick={() => setKinevoModalOpen(false)}
                >
                    <div
                        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-k-border-subtle bg-surface-card p-6 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-semibold text-k-text-primary">Templates Kinevo</h3>
                                <p className="mt-1 text-xs text-k-text-tertiary">
                                    Escolha um template pré-configurado. Você poderá ajustar tudo depois.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setKinevoModalOpen(false)}
                                aria-label="Fechar"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-k-text-tertiary hover:bg-surface-inset"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {kinevoTemplates.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => startFromKinevo(t)}
                                    className="group w-full text-left rounded-xl border border-k-border-subtle bg-surface-card p-4 hover:border-[#007AFF] hover:bg-[#F5F5F7] transition-all dark:hover:border-violet-500/30 dark:hover:bg-glass-bg"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#007AFF]/10 dark:bg-violet-500/10">
                                            <Activity size={14} className="text-[#007AFF] dark:text-violet-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-k-text-primary group-hover:text-[#007AFF] dark:group-hover:text-violet-300 transition-colors">
                                                {t.title}
                                            </p>
                                            {t.description && (
                                                <p className="mt-0.5 text-xs text-k-text-tertiary line-clamp-2">
                                                    {t.description}
                                                </p>
                                            )}
                                            <p className="mt-1 text-[11px] text-k-text-quaternary">
                                                {t.schema.sections.length} {t.schema.sections.length === 1 ? 'seção' : 'seções'}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </BuilderWizardShell>
    )
}

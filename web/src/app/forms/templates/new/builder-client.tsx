'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Json } from '@kinevo/shared/types/database'
import { motion, AnimatePresence } from 'framer-motion'
import { AppLayout } from '@/components/layout'
import { BuilderWizardShell } from '@/components/shared/builder-wizard-shell'
import { createFormTemplate } from '@/actions/forms/create-form-template'
import { updateFormTemplate } from '@/actions/forms/update-form-template'
import { generateFormDraftWithAI } from '@/actions/forms/generate-form-with-ai'
import { auditFormQualityWithAI } from '@/actions/forms/audit-form-quality-ai'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2, AlertTriangle, GripVertical, Loader2, Type, AlignLeft, SlidersHorizontal, CircleDot, Camera, MessageSquarePlus, Smartphone, ClipboardList, CheckCircle2, MessageSquare, ThumbsUp } from 'lucide-react'
import { EvaluationPreview } from '@/components/previews/evaluation-preview/evaluation-preview'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { TourHelpButton } from '@/components/onboarding/widgets/tour-help-button'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { arrayMove } from '@dnd-kit/sortable'
import { Z } from '@/lib/z-index'
import { AssistantMark } from '@/components/assistant/assistant-mark'

// ─── Types ──────────────────────────────────────────────────────

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
    onboarding_state?: import('@kinevo/shared/types/onboarding').OnboardingState | null
}

interface ExistingTemplate {
    id: string
    title: string
    description: string | null
    category: string
    version: number
    is_active: boolean
    created_source: string
    schema_json?: Json
    created_at: string
    updated_at: string
    trainer_id: string | null
}

interface Question {
    id: string
    type: string
    label: string
    required?: boolean
    options?: { value: string; label: string }[]
    scale?: { min: number; max: number; min_label?: string; max_label?: string }
}

interface QualityReport {
    risk_flags: string[]
    missing_areas?: string[]
    redundant_questions?: string[]
    reading_complexity?: string
    coach_review_checklist?: string[]
}

interface BuilderClientProps {
    trainer: Trainer
    existingTemplate: ExistingTemplate | null
}

type FormCategory = 'anamnese' | 'checkin' | 'survey' | 'feedback'

// ─── Constants ──────────────────────────────────────────────────

const QUESTION_TYPES = [
    { value: 'short_text', label: 'Texto curto', desc: 'Resposta em uma linha', icon: Type },
    { value: 'long_text', label: 'Texto longo', desc: 'Resposta em parágrafo', icon: AlignLeft },
    { value: 'single_choice', label: 'Escolha única', desc: 'Uma opção entre várias', icon: CircleDot },
    { value: 'scale', label: 'Escala', desc: 'Nota de 1 a 5', icon: SlidersHorizontal },
    { value: 'photo', label: 'Upload de foto', desc: 'Imagem do aluno', icon: Camera },
]

// M16 — 4 cards de tipo no Step 1.
const CATEGORY_CARDS: Array<{
    value: FormCategory
    label: string
    description: string
    example: string
    icon: typeof ClipboardList
}> = [
    {
        value: 'anamnese',
        label: 'Anamnese',
        description: 'Conheça o aluno antes de prescrever',
        example: 'Histórico de saúde, lesões, objetivos',
        icon: ClipboardList,
    },
    {
        value: 'checkin',
        label: 'Check-in',
        description: 'Acompanhe periodicamente como o aluno está',
        example: 'Sono, energia, dor, motivação',
        icon: CheckCircle2,
    },
    {
        value: 'survey',
        label: 'Pesquisa',
        description: 'Recolha opiniões e dados pontuais',
        example: 'NPS, satisfação, feedback rápido',
        icon: MessageSquare,
    },
    {
        value: 'feedback',
        label: 'Feedback do programa',
        description: 'Avalie o programa concluído',
        example: 'Avaliação geral, pontos fortes/fracos',
        icon: ThumbsUp,
    },
]

const stepAnimation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: 'easeOut' as const },
}

// ─── Helpers ────────────────────────────────────────────────────

function generateQuestionId() {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function parseQuestionsFromSchema(schema: Json | undefined): Question[] {
    if (!schema) return []
    const questions = (schema as any).questions
    if (!Array.isArray(questions)) return []
    return questions.map((q: any) => ({
        id: q.id || generateQuestionId(),
        type: q.type || 'short_text',
        label: q.label || '',
        required: q.required ?? true,
        options: q.options
            ? q.options.map((opt: any, i: number) =>
                typeof opt === 'string'
                    ? { value: `opt_${i + 1}`, label: opt }
                    : opt
            )
            : undefined,
        scale: q.scale
            ? {
                min: q.scale.min,
                max: q.scale.max,
                min_label: q.scale.min_label || q.scale.minLabel,
                max_label: q.scale.max_label || q.scale.maxLabel,
            }
            : undefined,
    }))
}

function questionsToSchema(questions: Question[]): Record<string, unknown> {
    return {
        schema_version: '1.0',
        layout: { estimated_minutes: Math.max(2, Math.ceil(questions.length * 1.5)), progress_mode: 'per_question' },
        questions: questions.map((q) => {
            const base: any = { id: q.id, type: q.type, label: q.label, required: q.required ?? true }
            if (q.type === 'single_choice' && q.options) base.options = q.options
            if (q.type === 'scale' && q.scale) base.scale = q.scale
            return base
        }),
    }
}

// ─── Main Component ─────────────────────────────────────────────

// ─── Sortable wrapper for question cards ─────────────────────
function SortableQuestionWrapper({ id, children }: { id: string; children: (props: { dragHandleProps: Record<string, unknown>; isDragging: boolean; style: React.CSSProperties; ref: (node: HTMLElement | null) => void }) => React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? Z.MODAL : 'auto',
        position: 'relative',
    }

    return <>{children({ dragHandleProps: { ...attributes, ...listeners }, isDragging, style, ref: setNodeRef })}</>
}

export function BuilderClient({ trainer, existingTemplate }: BuilderClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const isEditing = !!existingTemplate

    // Step (1: Tipo, 2: Configurar, 3: Editor)
    const [step, setStep] = useState<1 | 2 | 3>(isEditing ? 3 : 1)

    // Template fields
    const [title, setTitle] = useState(existingTemplate?.title || '')
    const [description, setDescription] = useState(existingTemplate?.description || '')
    const [category, setCategory] = useState<FormCategory>(
        (existingTemplate?.category as FormCategory) || 'checkin'
    )
    const [questions, setQuestions] = useState<Question[]>(
        parseQuestionsFromSchema(existingTemplate?.schema_json)
    )
    const [draftSource, setDraftSource] = useState<'manual' | 'ai_assisted'>(
        (existingTemplate?.created_source as 'manual' | 'ai_assisted') || 'manual'
    )

    // M16 — toggle "Criar com IA" no Step 2 (default off).
    // Quando ON, Step 3 começa com prompt textual em vez do editor manual.
    const [aiEnabled, setAiEnabled] = useState(false)
    // Step 3 sub-mode: prompt visível enquanto trainer configura IA; some
    // após "Gerar Draft" bem-sucedido (mostra editor com perguntas geradas).
    const [aiPromptVisible, setAiPromptVisible] = useState(false)

    // Save state
    const [isSaving, setIsSaving] = useState(false)

    // AI state
    const [aiGoal, setAiGoal] = useState('')
    const [aiStudentContext, setAiStudentContext] = useState('')
    const [aiMaxMinutes, setAiMaxMinutes] = useState(6)
    const [isGeneratingAI, setIsGeneratingAI] = useState(false)
    const [isAuditingAI, setIsAuditingAI] = useState(false)
    const [aiProviderSource, setAiProviderSource] = useState<'llm' | 'heuristic' | null>(null)
    const [aiRuntimeNote, setAiRuntimeNote] = useState<string | null>(null)
    const [aiQualityReport, setAiQualityReport] = useState<QualityReport | null>(null)
    const [aiChecklist, setAiChecklist] = useState<string[]>([])

    // Add question dropdown
    const [showAddMenu, setShowAddMenu] = useState(false)

    // Preview
    const [showPreview, setShowPreview] = useState(true)

    // Track unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        if (isEditing) {
            return title !== (existingTemplate?.title || '') ||
                description !== (existingTemplate?.description || '') ||
                questions.length !== parseQuestionsFromSchema(existingTemplate?.schema_json).length
        }
        return title.trim().length > 0 || questions.length > 0
    }, [title, description, questions, isEditing, existingTemplate])

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [step])

    // Build schema for saving
    const schema = useMemo(() => questionsToSchema(questions), [questions])

    // ─── Question handlers ──────────────────────────────────────

    const addQuestion = useCallback((type: string) => {
        const newQ: Question = {
            id: generateQuestionId(),
            type,
            label: '',
            required: true,
            ...(type === 'single_choice' ? { options: [{ value: 'opt_1', label: '' }, { value: 'opt_2', label: '' }] } : {}),
            ...(type === 'scale' ? { scale: { min: 1, max: 5, min_label: 'Muito baixo', max_label: 'Muito alto' } } : {}),
        }
        setQuestions((prev) => [...prev, newQ])
        setShowAddMenu(false)
    }, [])

    const updateQuestion = useCallback((index: number, updates: Partial<Question>) => {
        setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)))
    }, [])

    const removeQuestion = useCallback((index: number) => {
        setQuestions((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const addOption = useCallback((qIndex: number) => {
        setQuestions((prev) => prev.map((q, i) => {
            if (i !== qIndex) return q
            const opts = [...(q.options || [])]
            opts.push({ value: `opt_${opts.length + 1}`, label: '' })
            return { ...q, options: opts }
        }))
    }, [])

    const updateOption = useCallback((qIndex: number, optIndex: number, label: string) => {
        setQuestions((prev) => prev.map((q, i) => {
            if (i !== qIndex) return q
            const opts = [...(q.options || [])]
            opts[optIndex] = { ...opts[optIndex], label }
            return { ...q, options: opts }
        }))
    }, [])

    const removeOption = useCallback((qIndex: number, optIndex: number) => {
        setQuestions((prev) => prev.map((q, i) => {
            if (i !== qIndex) return q
            const opts = (q.options || []).filter((_, oi) => oi !== optIndex)
            return { ...q, options: opts }
        }))
    }, [])

    // ─── Drag-and-drop for question reordering ───────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    )

    const handleQuestionDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setQuestions((prev) => {
            const oldIndex = prev.findIndex((q) => q.id === active.id)
            const newIndex = prev.findIndex((q) => q.id === over.id)
            if (oldIndex === -1 || newIndex === -1) return prev
            return arrayMove(prev, oldIndex, newIndex)
        })
    }, [])

    // ─── Save handler ───────────────────────────────────────────

    const handleSave = async () => {
        if (!title.trim()) {
            toast({ message: 'Título é obrigatório.', type: 'error' })
            return
        }
        if (questions.length === 0) {
            toast({ message: 'Adicione ao menos uma pergunta.', type: 'error' })
            return
        }

        // Toda pergunta precisa de enunciado — sem isso o aluno recebe perguntas
        // em branco (o submit valida por id, não por label, então passariam).
        const emptyLabelIdx = questions.findIndex((q) => !q.label.trim())
        if (emptyLabelIdx !== -1) {
            toast({ message: `A pergunta ${emptyLabelIdx + 1} está sem enunciado.`, type: 'error' })
            return
        }

        // Validação por tipo: escolha precisa de opções com texto; escala precisa
        // de mínimo < máximo (senão a RPC nunca aceita e o aluno não submete).
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i]
            if (q.type === 'single_choice') {
                const opts = q.options ?? []
                if (opts.length === 0) {
                    toast({ message: `A pergunta ${i + 1} (escolha única) precisa de ao menos uma opção.`, type: 'error' })
                    return
                }
                if (opts.some((o) => !o.label.trim())) {
                    toast({ message: `A pergunta ${i + 1} tem uma opção sem texto.`, type: 'error' })
                    return
                }
            }
            if (q.type === 'scale' && q.scale) {
                const { min, max } = q.scale
                if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
                    toast({ message: `A pergunta ${i + 1} (escala) precisa de um mínimo menor que o máximo.`, type: 'error' })
                    return
                }
            }
        }

        setIsSaving(true)
        try {
            const schemaJson = JSON.stringify(schema)

            if (isEditing && existingTemplate) {
                const result = await updateFormTemplate({
                    templateId: existingTemplate.id,
                    title,
                    description,
                    category,
                    schemaJson,
                })
                if (!result.success) {
                    toast({ message: result.error || 'Erro ao atualizar template.', type: 'error' })
                    return
                }
            } else {
                const result = await createFormTemplate({
                    title,
                    description,
                    category,
                    schemaJson,
                    createdSource: draftSource,
                })
                if (!result.success) {
                    toast({ message: result.error || 'Erro ao criar template.', type: 'error' })
                    return
                }
            }

            router.push('/forms')
            router.refresh()
        } finally {
            setIsSaving(false)
        }
    }

    // ─── AI handlers ────────────────────────────────────────────

    const handleGenerateAI = async () => {
        setIsGeneratingAI(true)
        try {
            const result = await generateFormDraftWithAI({
                category,
                goal: aiGoal,
                studentContext: aiStudentContext,
                maxMinutes: aiMaxMinutes,
            })

            if (!result.success || !result.templateDraft) {
                toast({ message: result.error || 'Erro ao gerar draft com IA.', type: 'error' })
                return
            }

            // Mantém title/description que o trainer pode ter digitado no Step 2;
            // se vazios, aceita os do draft.
            if (!title) setTitle(result.templateDraft.title)
            if (!description) setDescription(result.templateDraft.description)
            setCategory(result.templateDraft.category as FormCategory)
            setQuestions(parseQuestionsFromSchema(result.templateDraft.schema as unknown as Json))
            setDraftSource('ai_assisted')
            setAiProviderSource(result.source === 'llm' ? 'llm' : 'heuristic')
            setAiRuntimeNote(result.runtimeNote || null)
            setAiQualityReport(result.qualityReport || null)
            setAiChecklist(result.reviewChecklist || [])

            // M16 — esconde prompt e mostra editor com perguntas geradas.
            setAiPromptVisible(false)
        } finally {
            setIsGeneratingAI(false)
        }
    }

    const handleAuditAI = async () => {
        setIsAuditingAI(true)
        try {
            const result = await auditFormQualityWithAI({ schemaJson: JSON.stringify(schema) })
            if (!result.success || !result.audit) {
                toast({ message: result.error || 'Erro na auditoria.', type: 'error' })
                return
            }
            setAiProviderSource(result.source === 'llm' ? 'llm' : 'heuristic')
            setAiRuntimeNote('Auditoria executada.')
            setAiQualityReport(result.audit)
            setAiChecklist(result.audit.coach_review_checklist || [])
        } finally {
            setIsAuditingAI(false)
        }
    }

    // ─── Render ─────────────────────────────────────────────────

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={trainer.onboarding_state ?? null}
        >
            <BuilderWizardShell
                title={
                    isEditing
                        ? `Editar template${title ? ` — ${title}` : ''}`
                        : title || 'Novo template'
                }
                subtitle={
                    isEditing
                        ? (existingTemplate?.trainer_id === null
                            ? 'Template Kinevo — ao salvar, uma cópia editável será criada'
                            : `v${existingTemplate?.version ?? 1}`)
                        : null
                }
                headerExtra={<TourHelpButton tourId="form_builder" />}
                currentStep={step}
                hideStepIndicator={isEditing}
                onExit={() => router.push('/forms/templates')}
                onAdvance={() => {
                    if (step === 1) {
                        setStep(2)
                    } else if (step === 2) {
                        // M16 — toggle IA decide o sub-mode do Step 3.
                        if (aiEnabled) {
                            setDraftSource('ai_assisted')
                            setAiPromptVisible(true)
                        } else {
                            setDraftSource('manual')
                            setAiPromptVisible(false)
                        }
                        setStep(3)
                    }
                }}
                onBack={() => {
                    if (step === 3) {
                        // Volta pra Step 2 mas mantém aiPromptVisible reseteado.
                        setAiPromptVisible(false)
                        setStep(2)
                    } else if (step === 2) {
                        setStep(1)
                    }
                }}
                canAdvance={
                    step === 1 ? true /* card click já avança */
                    : step === 2 ? title.trim().length > 0
                    : false
                }
                hideAdvance={step === 1}
                canSave={questions.length > 0 && title.trim().length > 0 && !isSaving && !aiPromptVisible}
                onSave={handleSave}
                isDirty={hasUnsavedChanges}
                isSaving={isSaving}
            >
            <div className="bg-surface-primary p-4 font-sans">
                <div className="max-w-7xl mx-auto">

                    {/* Step content */}
                    <div>

                        {/* ════════════════════════════════════════════════
                            STEP 1: TIPO — 4 cards explicativos
                        ════════════════════════════════════════════════ */}
                        {step === 1 && (
                            <div key="step1" className="flex min-h-[62vh] items-center justify-center">
                                <div className="w-full max-w-3xl mx-auto">
                                    <p className="text-center text-lg font-semibold text-k-text-primary mb-2">
                                        Que tipo de formulário você quer criar?
                                    </p>
                                    <p className="text-center text-sm text-k-text-tertiary mb-6">
                                        Escolha o propósito — você poderá ajustar tudo depois.
                                    </p>

                                    <div data-onboarding="form-choose-method" className="grid grid-cols-2 gap-4">
                                        {CATEGORY_CARDS.map(card => {
                                            const Icon = card.icon
                                            return (
                                                <button
                                                    key={card.value}
                                                    onClick={() => {
                                                        setCategory(card.value)
                                                        setStep(2)
                                                    }}
                                                    className="group text-left rounded-panel border border-k-border-subtle bg-surface-card p-5 cursor-pointer transition-colors hover:border-k-border-primary hover:bg-surface-inset"
                                                >
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset mb-3">
                                                        <Icon size={20} className="text-k-text-tertiary" strokeWidth={1.5} />
                                                    </div>
                                                    <h3 className="text-sm font-semibold text-k-text-primary mb-1">
                                                        {card.label}
                                                    </h3>
                                                    <p className="text-xs text-k-text-tertiary leading-relaxed mb-2">
                                                        {card.description}
                                                    </p>
                                                    <p className="text-[11px] text-k-text-quaternary italic">
                                                        Ex: {card.example}
                                                    </p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════════════════
                            STEP 2: CONFIGURAR — nome + descrição + toggle IA
                        ════════════════════════════════════════════════ */}
                        {step === 2 && (
                            <div key="step2" className="flex min-h-[62vh] items-center justify-center">
                                <div className="w-full max-w-xl mx-auto">
                                    <div className="rounded-panel border border-k-border-subtle bg-surface-card p-8 space-y-6">
                                        {/* Title */}
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-k-text-secondary">
                                                Nome do template <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={
                                                    category === 'anamnese' ? 'Ex: Anamnese inicial completa'
                                                    : category === 'checkin' ? 'Ex: Check-in semanal'
                                                    : category === 'survey' ? 'Ex: Pesquisa de satisfação'
                                                    : 'Ex: Feedback do programa concluído'
                                                }
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                className="w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 transition-all"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-k-text-secondary">
                                                Descrição <span className="font-normal text-k-text-tertiary">(opcional)</span>
                                            </label>
                                            <textarea
                                                placeholder="Descrição breve para o aluno"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="min-h-[80px] w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 resize-none transition-all"
                                            />
                                        </div>

                                        {/* Toggle IA */}
                                        <div>
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={aiEnabled}
                                                    onChange={(e) => setAiEnabled(e.target.checked)}
                                                    className="mt-0.5 h-4 w-4 rounded border-k-border-primary accent-[var(--primary)]"
                                                />
                                                <span className="flex-1">
                                                    <span className="flex items-center gap-1.5 text-sm font-medium text-k-text-primary">
                                                        <AssistantMark size={14} className="text-k-text-tertiary" />
                                                        Criar com IA
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-k-text-tertiary">
                                                        A IA gera as perguntas a partir do seu objetivo. Você revisa e ajusta antes de salvar.
                                                    </span>
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════════════════
                            STEP 3: EDITOR — manual ou prompt IA
                        ════════════════════════════════════════════════ */}
                        {step === 3 && aiPromptVisible && (
                            <div key="step3-ai-prompt" className="flex min-h-[62vh] items-center justify-center">
                                <div className="w-full max-w-xl mx-auto">
                                    <div className="rounded-panel border border-k-border-subtle bg-surface-card p-8 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-control border border-k-border-subtle bg-surface-inset">
                                                <AssistantMark size={20} className="text-k-text-tertiary" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-semibold text-k-text-primary">Assistente IA</h2>
                                                <p className="text-xs text-k-text-tertiary">Descreva o objetivo e a IA gera as perguntas</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-k-text-secondary">
                                                Objetivo <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={
                                                    category === 'anamnese' ? 'Ex: coleta completa de dados do novo aluno'
                                                    : category === 'checkin' ? 'Ex: acompanhamento semanal do aluno'
                                                    : category === 'survey' ? 'Ex: questionário de satisfação com o treino'
                                                    : 'Ex: avaliação geral ao fim do programa'
                                                }
                                                value={aiGoal}
                                                onChange={(e) => setAiGoal(e.target.value)}
                                                className="w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-k-text-secondary">
                                                Contexto adicional <span className="font-normal text-k-text-tertiary">(opcional)</span>
                                            </label>
                                            <textarea
                                                placeholder="Descreva o perfil dos alunos, restrições, foco do treinamento..."
                                                value={aiStudentContext}
                                                onChange={(e) => setAiStudentContext(e.target.value)}
                                                className="min-h-[100px] w-full rounded-control border border-k-border-primary bg-surface-card px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 resize-none transition-all"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <button
                                                onClick={() => setAiPromptVisible(false)}
                                                className="text-sm font-medium text-k-text-secondary hover:text-k-text-primary transition-colors"
                                            >
                                                Pular e editar manualmente
                                            </button>
                                            <button
                                                onClick={handleGenerateAI}
                                                disabled={isGeneratingAI || !aiGoal.trim()}
                                                className="h-11 px-8 bg-primary hover:opacity-90 text-primary-foreground rounded-control font-medium text-sm transition-opacity disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isGeneratingAI ? (
                                                    <>
                                                        <Loader2 size={16} className="animate-spin" />
                                                        Gerando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <AssistantMark size={16} />
                                                        Gerar Draft
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && !aiPromptVisible && (
                            <div key="step3-editor">
                                <div className={`pb-8 ${showPreview ? 'flex gap-8 items-start' : 'max-w-3xl mx-auto'}`}>

                                    {/* Left Column — Form */}
                                    <div className={`space-y-6 ${showPreview ? 'flex-1 min-w-0' : ''}`}>

                                        {/* Breadcrumb resumo (categoria + IA badge) */}
                                        <div className="flex items-center gap-2 text-xs text-k-text-tertiary">
                                            <span className="rounded border border-k-border-subtle bg-surface-inset px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-k-text-tertiary">
                                                {CATEGORY_CARDS.find(c => c.value === category)?.label ?? category}
                                            </span>
                                            {draftSource === 'ai_assisted' && (
                                                <span className="flex items-center gap-1 rounded border border-k-border-subtle bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-k-text-tertiary">
                                                    <AssistantMark size={10} strokeWidth={2} className="text-k-text-tertiary" />
                                                    IA
                                                </span>
                                            )}
                                        </div>

                                        {/* Card: Perguntas */}
                                        <div className="rounded-panel border border-k-border-subtle bg-surface-card p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-k-text-primary">
                                                    Perguntas <span className="font-mono tabular-nums text-k-text-tertiary">({questions.length})</span>
                                                </h2>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setShowPreview(!showPreview)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control border transition-colors ${
                                                            showPreview
                                                                ? 'border-k-border-primary bg-surface-inset text-k-text-primary'
                                                                : 'border-k-border-primary bg-surface-card text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary'
                                                        }`}
                                                    >
                                                        <Smartphone size={12} />
                                                        {showPreview ? 'Preview' : 'Abrir Preview'}
                                                    </button>
                                                    <button
                                                        onClick={handleAuditAI}
                                                        disabled={isAuditingAI || questions.length === 0}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control border border-k-border-primary bg-surface-card hover:bg-surface-inset text-k-text-secondary hover:text-k-text-primary transition-colors disabled:opacity-40"
                                                    >
                                                        <AssistantMark size={12} />
                                                        {isAuditingAI ? 'Auditando...' : 'Auditar Qualidade'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quality Alerts — inline */}
                                            <AnimatePresence>
                                                {aiQualityReport?.risk_flags?.length ? (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="rounded-control border border-amber-500/20 bg-amber-500/5 p-4 mb-2">
                                                            <div className="mb-2 flex items-center gap-2 text-amber-500">
                                                                <AlertTriangle size={14} strokeWidth={2} />
                                                                <p className="text-[11px] font-bold">Atenção</p>
                                                            </div>
                                                            <ul className="space-y-1 pl-1">
                                                                {aiQualityReport.risk_flags.map((risk) => (
                                                                    <li key={risk} className="flex items-start gap-2 text-xs text-k-text-secondary">
                                                                        <span className="mt-1 block h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                                                                        {risk}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </motion.div>
                                                ) : null}
                                            </AnimatePresence>

                                            {/* AI Checklist — inline */}
                                            <AnimatePresence>
                                                {aiChecklist.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="rounded-control border border-k-border-subtle bg-surface-inset p-4 mb-2">
                                                            <p className="mb-2 text-[11px] font-bold text-k-text-secondary">Sugestões de Revisão</p>
                                                            <ul className="space-y-1">
                                                                {aiChecklist.map((item) => (
                                                                    <li key={item} className="flex items-start gap-2 text-xs text-k-text-secondary">
                                                                        <span className="mt-1.5 block h-1 w-1 rounded-full bg-k-text-quaternary shrink-0" />
                                                                        {item}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* AI runtime note (no model name exposed) */}
                                            {aiRuntimeNote && (
                                                <div className="rounded-control bg-surface-inset px-3 py-2 text-[11px] text-k-text-secondary">
                                                    <span className="block opacity-75">{aiRuntimeNote}</span>
                                                </div>
                                            )}

                                            {/* Empty state */}
                                            {questions.length === 0 && (
                                                <div className="text-center py-8">
                                                    <div className="w-12 h-12 rounded-control border border-k-border-subtle bg-surface-inset flex items-center justify-center mx-auto mb-3">
                                                        <MessageSquarePlus size={24} className="text-k-text-quaternary" />
                                                    </div>
                                                    <p className="text-sm text-k-text-secondary mb-1">Comece adicionando perguntas</p>
                                                    <p className="text-xs text-k-text-quaternary">
                                                        Escolha entre texto, escala, múltipla escolha ou foto
                                                    </p>
                                                </div>
                                            )}

                                            {/* Question Cards */}
                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
                                            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                                            {questions.map((q, index) => {
                                                const typeLabel = QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type

                                                return (
                                                    <SortableQuestionWrapper key={q.id} id={q.id}>
                                                        {({ dragHandleProps, style, ref }) => (
                                                    <div ref={ref} style={style} className="rounded-control border border-k-border-subtle bg-surface-card p-4 space-y-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex items-center gap-1 pt-1 cursor-grab active:cursor-grabbing" {...dragHandleProps}>
                                                                <GripVertical size={14} className="text-k-text-secondary opacity-60 hover:opacity-100 transition-opacity" />
                                                                <span className="font-mono tabular-nums text-[10px] font-semibold text-k-text-secondary bg-surface-inset px-1.5 py-0.5 rounded">
                                                                    {index + 1}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 space-y-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Texto da pergunta..."
                                                                    value={q.label}
                                                                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                                                                    className="w-full rounded-control border border-k-border-primary bg-surface-inset px-3 py-2 text-sm text-k-text-primary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 transition-all"
                                                                />
                                                                <div className="flex items-center gap-3">
                                                                    <span className="rounded border border-k-border-subtle bg-surface-inset px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-k-text-tertiary">
                                                                        {typeLabel}
                                                                    </span>
                                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={q.required ?? true}
                                                                            onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                                                                            className="h-3.5 w-3.5 rounded border-k-border-primary accent-[var(--primary)]"
                                                                        />
                                                                        <span className="text-[11px] text-k-text-secondary">Obrigatório</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => removeQuestion(index)}
                                                                className="text-k-text-quaternary hover:text-red-500 p-1.5 rounded-control hover:bg-surface-inset transition-colors shrink-0"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>

                                                        {/* Single choice options */}
                                                        {q.type === 'single_choice' && (
                                                            <div className="pl-8 space-y-2">
                                                                {(q.options || []).map((opt, optIdx) => (
                                                                    <div key={`${q.id}-opt-${optIdx}`} className="flex items-center gap-2">
                                                                        <div className="h-4 w-4 rounded-full border-2 border-k-border-subtle shrink-0" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder={`Opção ${optIdx + 1}`}
                                                                            value={opt.label}
                                                                            onChange={(e) => updateOption(index, optIdx, e.target.value)}
                                                                            className="flex-1 rounded-control border border-k-border-primary bg-surface-inset px-3 py-1.5 text-xs text-k-text-primary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 transition-all"
                                                                        />
                                                                        {(q.options || []).length > 2 && (
                                                                            <button
                                                                                onClick={() => removeOption(index, optIdx)}
                                                                                className="text-k-text-secondary hover:text-red-500 p-1 rounded transition-colors"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => addOption(index)}
                                                                    className="text-[11px] font-semibold text-k-text-secondary hover:text-k-text-primary transition-colors pl-6"
                                                                >
                                                                    + Adicionar opção
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Scale editor */}
                                                        {q.type === 'scale' && (
                                                            <div className="pl-8 flex items-center gap-4">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[11px] text-k-text-secondary">Min:</label>
                                                                    <input
                                                                        type="number"
                                                                        value={q.scale?.min ?? 1}
                                                                        onChange={(e) => updateQuestion(index, { scale: { ...q.scale!, min: Number(e.target.value) } })}
                                                                        className="w-12 rounded-control border border-k-border-primary bg-surface-inset px-2 py-1 text-center text-xs font-mono tabular-nums text-k-text-primary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[11px] text-k-text-secondary">Max:</label>
                                                                    <input
                                                                        type="number"
                                                                        value={q.scale?.max ?? 5}
                                                                        onChange={(e) => updateQuestion(index, { scale: { ...q.scale!, max: Number(e.target.value) } })}
                                                                        className="w-12 rounded-control border border-k-border-primary bg-surface-inset px-2 py-1 text-center text-xs font-mono tabular-nums text-k-text-primary focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/25"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                        )}
                                                    </SortableQuestionWrapper>
                                                )
                                            })}
                                            </SortableContext>
                                            </DndContext>

                                            {/* Add Question Button */}
                                            <div data-onboarding="form-question-types" className="relative">
                                                <button
                                                    onClick={() => setShowAddMenu(!showAddMenu)}
                                                    className="w-full h-11 border-2 border-dashed border-k-border-primary hover:border-k-text-quaternary rounded-control text-sm font-semibold text-k-text-secondary hover:text-k-text-primary transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Plus size={16} />
                                                    Adicionar Pergunta
                                                </button>

                                                {showAddMenu && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 rounded-control border border-k-border-subtle bg-surface-card shadow-lg z-sticky overflow-hidden p-1">
                                                        {QUESTION_TYPES.map((qt) => {
                                                            const Icon = qt.icon
                                                            return (
                                                                <button
                                                                    key={qt.value}
                                                                    onClick={() => addQuestion(qt.value)}
                                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-left hover:bg-surface-inset transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded-control border border-k-border-subtle bg-surface-inset flex items-center justify-center shrink-0">
                                                                        <Icon size={14} className="text-k-text-tertiary" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-sm text-k-text-primary block">{qt.label}</span>
                                                                        <span className="text-[10px] text-k-text-quaternary">{qt.desc}</span>
                                                                    </div>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column — Mobile Preview */}
                                    {showPreview && (
                                        <div className="w-[390px] shrink-0 sticky top-8">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-medium text-k-text-tertiary">Como o aluno verá no app</span>
                                                <button
                                                    onClick={() => setShowPreview(false)}
                                                    className="text-xs text-k-text-tertiary hover:text-k-text-primary transition-colors"
                                                >
                                                    Ocultar
                                                </button>
                                            </div>
                                            <div className="flex justify-center bg-surface-inset rounded-panel pt-4 pb-6 border border-k-border-subtle">
                                                <EvaluationPreview
                                                    title={title}
                                                    description={description}
                                                    questions={questions}
                                                />
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            </BuilderWizardShell>

            {/* Tour: Form Builder (sob demanda via TourHelpButton no header) */}
            <TourRunner tourId="form_builder" steps={TOUR_STEPS.form_builder} />
        </AppLayout>
    )
}

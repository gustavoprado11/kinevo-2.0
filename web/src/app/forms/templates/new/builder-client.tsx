'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AppLayout } from '@/components/layout'
import { createFormTemplate } from '@/actions/forms/create-form-template'
import { updateFormTemplate } from '@/actions/forms/update-form-template'
import { generateFormDraftWithAI } from '@/actions/forms/generate-form-with-ai'
import { auditFormQualityWithAI } from '@/actions/forms/audit-form-quality-ai'
import {
    ArrowLeft,
    Plus,
    Trash2,
    Sparkles,
    AlertTriangle,
    GripVertical,
    Loader2,
    ChevronLeft,
    Pencil,
    Check,
    Type,
    AlignLeft,
    SlidersHorizontal,
    CircleDot,
    Camera,
    MessageSquarePlus,
} from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
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

// ─── Types ──────────────────────────────────────────────────────

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface ExistingTemplate {
    id: string
    title: string
    description: string | null
    category: string
    version: number
    is_active: boolean
    created_source: string
    schema_json?: Record<string, unknown> | null
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

type BuilderStep = 'choose' | 'ai_setup' | 'editor'

// ─── Constants ──────────────────────────────────────────────────

const QUESTION_TYPES = [
    { value: 'short_text', label: 'Texto curto', desc: 'Resposta em uma linha', icon: Type },
    { value: 'long_text', label: 'Texto longo', desc: 'Resposta em parágrafo', icon: AlignLeft },
    { value: 'single_choice', label: 'Escolha única', desc: 'Uma opção entre várias', icon: CircleDot },
    { value: 'scale', label: 'Escala', desc: 'Nota de 1 a 5', icon: SlidersHorizontal },
    { value: 'photo', label: 'Upload de foto', desc: 'Imagem do aluno', icon: Camera },
]

const CATEGORY_OPTIONS = [
    { value: 'anamnese', label: 'Anamnese' },
    { value: 'checkin', label: 'Check-in' },
    { value: 'survey', label: 'Pesquisa' },
] as const

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

function parseQuestionsFromSchema(schema: Record<string, unknown> | null | undefined): Question[] {
    if (!schema) return []
    const questions = (schema as any).questions
    if (!Array.isArray(questions)) return []
    return questions.map((q: any) => ({
        id: q.id || generateQuestionId(),
        type: q.type || 'short_text',
        label: q.label || '',
        required: q.required ?? true,
        options: q.options || undefined,
        scale: q.scale || undefined,
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

// ─── Step Indicator ─────────────────────────────────────────────

const STEP_LABELS: { key: BuilderStep; label: string }[] = [
    { key: 'choose', label: 'Método' },
    { key: 'ai_setup', label: 'Configurar' },
    { key: 'editor', label: 'Editor' },
]

function StepIndicator({ step, isEditing }: { step: BuilderStep; isEditing: boolean }) {
    if (isEditing) return null
    const currentIndex = STEP_LABELS.findIndex((s) => s.key === step)

    return (
        <div className="flex items-center justify-center gap-3 mb-8">
            {STEP_LABELS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                    <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                            i < currentIndex
                                ? 'bg-[#34C759] text-white dark:bg-emerald-500'
                                : i === currentIndex
                                    ? 'bg-[#007AFF] text-white dark:bg-violet-600'
                                    : 'bg-[#E8E8ED] text-[#AEAEB2] dark:bg-surface-elevated dark:text-k-text-quaternary'
                        }`}
                    >
                        {i < currentIndex ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium transition-colors ${
                        i <= currentIndex ? 'text-[#1D1D1F] dark:text-k-text-primary' : 'text-[#AEAEB2] dark:text-k-text-quaternary'
                    }`}>
                        {s.label}
                    </span>
                    {i < STEP_LABELS.length - 1 && (
                        <div className={`w-8 h-px ml-1 ${i < currentIndex ? 'bg-[#007AFF] dark:bg-emerald-500' : 'bg-[#E8E8ED] dark:bg-surface-elevated'}`} />
                    )}
                </div>
            ))}
        </div>
    )
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
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative',
    }

    return <>{children({ dragHandleProps: { ...attributes, ...listeners }, isDragging, style, ref: setNodeRef })}</>
}

export function BuilderClient({ trainer, existingTemplate }: BuilderClientProps) {
    const router = useRouter()
    const isEditing = !!existingTemplate

    // Step
    const [step, setStep] = useState<BuilderStep>(isEditing ? 'editor' : 'choose')

    // Template fields
    const [title, setTitle] = useState(existingTemplate?.title || '')
    const [description, setDescription] = useState(existingTemplate?.description || '')
    const [category, setCategory] = useState<'anamnese' | 'checkin' | 'survey'>(
        (existingTemplate?.category as any) || 'checkin'
    )
    const [questions, setQuestions] = useState<Question[]>(
        parseQuestionsFromSchema(existingTemplate?.schema_json)
    )
    const [draftSource, setDraftSource] = useState<'manual' | 'ai_assisted'>(
        (existingTemplate?.created_source as any) || 'manual'
    )

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
            alert('Título é obrigatório.')
            return
        }
        if (questions.length === 0) {
            alert('Adicione ao menos uma pergunta.')
            return
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
                    alert(result.error || 'Erro ao atualizar template.')
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
                    alert(result.error || 'Erro ao criar template.')
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
                alert(result.error || 'Erro ao gerar draft com IA.')
                return
            }

            setTitle(result.templateDraft.title)
            setDescription(result.templateDraft.description)
            setCategory(result.templateDraft.category)
            setQuestions(parseQuestionsFromSchema(result.templateDraft.schema as any))
            setDraftSource('ai_assisted')
            setAiProviderSource(result.source === 'llm' ? 'llm' : 'heuristic')
            setAiRuntimeNote(result.runtimeNote || null)
            setAiQualityReport(result.qualityReport || null)
            setAiChecklist(result.reviewChecklist || [])

            // Transition to editor after successful generation
            setStep('editor')
        } finally {
            setIsGeneratingAI(false)
        }
    }

    const handleAuditAI = async () => {
        setIsAuditingAI(true)
        try {
            const result = await auditFormQualityWithAI({ schemaJson: JSON.stringify(schema) })
            if (!result.success || !result.audit) {
                alert(result.error || 'Erro na auditoria.')
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
        >
            <div className="min-h-screen bg-surface-primary p-8 font-sans">
                <div className="max-w-7xl mx-auto">

                    {/* Header — always visible */}
                    <div className="mb-8">
                        <Link
                            href="/forms/templates"
                            className="inline-flex items-center gap-1.5 text-xs text-[#007AFF] hover:text-[#0056B3] transition-colors mb-3 dark:text-k-text-secondary dark:hover:text-violet-400"
                        >
                            <ArrowLeft size={14} />
                            Voltar para Templates
                        </Link>
                        <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] dark:text-3xl dark:tracking-tighter dark:bg-gradient-to-br dark:from-[var(--gradient-text-from)] dark:to-[var(--gradient-text-to)] dark:bg-clip-text dark:text-transparent">
                            {isEditing ? 'Editar Template' : 'Criar Template'}
                        </h1>
                        {isEditing && (
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                {existingTemplate?.trainer_id === null
                                    ? <>Template Kinevo &mdash; ao salvar, uma cópia editável será criada para você</>
                                    : <>Editando &quot;{existingTemplate?.title}&quot; (v{existingTemplate?.version})</>
                                }
                            </p>
                        )}
                    </div>

                    {/* Step indicator */}
                    <StepIndicator step={step} isEditing={isEditing} />

                    {/* Step content */}
                    <AnimatePresence mode="wait">

                        {/* ════════════════════════════════════════════════
                            STEP 1: CHOOSE — IA or Manual
                        ════════════════════════════════════════════════ */}
                        {step === 'choose' && (
                            <motion.div key="choose" {...stepAnimation}>
                                <div className="max-w-2xl mx-auto">
                                    <p className="text-center text-lg font-semibold text-[#1D1D1F] mb-6 dark:text-k-text-primary">
                                        Como deseja criar seu template?
                                    </p>

                                    <div data-onboarding="form-choose-method" className="grid grid-cols-2 gap-4">
                                        {/* Card: AI */}
                                        <button
                                            onClick={() => {
                                                setDraftSource('ai_assisted')
                                                setStep('ai_setup')
                                            }}
                                            className="group text-left rounded-xl border border-[#D2D2D7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:border-[#007AFF] cursor-pointer transition-all duration-200 dark:border-k-border-primary dark:bg-surface-card dark:shadow-none dark:hover:border-violet-500/30 dark:hover:bg-glass-bg"
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] group-hover:bg-[#007AFF]/10 mb-3 transition-colors dark:bg-surface-elevated dark:group-hover:bg-violet-500/10">
                                                <Sparkles size={20} className="text-[#AEAEB2] group-hover:text-[#007AFF] dark:text-violet-400" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1 dark:text-k-text-primary dark:group-hover:text-violet-300 transition-colors">
                                                Criar com IA
                                            </h3>
                                            <p className="text-xs text-[#86868B] leading-relaxed dark:text-k-text-quaternary">
                                                Descreva o objetivo e a IA gera as perguntas para revisar.
                                            </p>
                                        </button>

                                        {/* Card: Manual */}
                                        <button
                                            onClick={() => {
                                                setDraftSource('manual')
                                                setStep('editor')
                                            }}
                                            className="group text-left rounded-xl border border-[#D2D2D7] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:border-[#007AFF] cursor-pointer transition-all duration-200 dark:border-k-border-primary dark:bg-surface-card dark:shadow-none dark:hover:border-blue-500/30 dark:hover:bg-glass-bg"
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F7] group-hover:bg-[#007AFF]/10 mb-3 transition-colors dark:bg-surface-elevated dark:group-hover:bg-blue-500/10">
                                                <Pencil size={20} className="text-[#AEAEB2] group-hover:text-[#007AFF] dark:text-blue-400" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1 dark:text-k-text-primary dark:group-hover:text-blue-300 transition-colors">
                                                Criar Manualmente
                                            </h3>
                                            <p className="text-xs text-[#86868B] leading-relaxed dark:text-k-text-quaternary">
                                                Monte do zero, escolhendo cada tipo de pergunta.
                                            </p>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ════════════════════════════════════════════════
                            STEP 2: AI SETUP
                        ════════════════════════════════════════════════ */}
                        {step === 'ai_setup' && (
                            <motion.div key="ai_setup" {...stepAnimation}>
                                <div className="max-w-xl mx-auto">
                                    <div className="rounded-2xl border border-[#D2D2D7] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-6 dark:border-k-border-primary dark:bg-surface-card dark:shadow-xl">
                                        {/* Header */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007AFF]/10 dark:bg-violet-500/10">
                                                <Sparkles size={20} className="text-[#007AFF] dark:text-violet-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-semibold text-[#1D1D1F] dark:font-bold dark:text-k-text-primary">Assistente IA</h2>
                                                <p className="text-xs text-[#86868B] dark:text-k-text-secondary">Configure e gere seu formulário automaticamente</p>
                                            </div>
                                        </div>

                                        {/* Category — Segmented Control */}
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-[#1D1D1F] dark:text-xs dark:text-k-text-tertiary">
                                                Categoria
                                            </label>
                                            <div className="grid grid-cols-3 gap-1 bg-[#F5F5F7] p-1 rounded-lg dark:bg-surface-inset dark:rounded-xl">
                                                {CATEGORY_OPTIONS.map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className={`
                                                            flex items-center justify-center rounded-md px-3 py-2.5 cursor-pointer transition-all duration-200
                                                            ${category === opt.value
                                                                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-glass-bg-active dark:text-k-text-primary dark:shadow-sm dark:ring-1 dark:ring-k-border-subtle'
                                                                : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:text-k-text-tertiary dark:hover:text-k-text-secondary dark:hover:bg-glass-bg'}
                                                        `}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="category"
                                                            value={opt.value}
                                                            checked={category === opt.value}
                                                            onChange={() => setCategory(opt.value)}
                                                            className="sr-only"
                                                        />
                                                        <span className="font-semibold text-xs tracking-wide">{opt.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Goal */}
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-[#1D1D1F] dark:text-xs dark:text-k-text-tertiary">
                                                Objetivo <span className="text-[#FF3B30] dark:text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={category === 'anamnese' ? 'Ex: coleta completa de dados do novo aluno' : category === 'checkin' ? 'Ex: acompanhamento semanal do aluno' : 'Ex: questionário de satisfação com o treino'}
                                                value={aiGoal}
                                                onChange={(e) => setAiGoal(e.target.value)}
                                                className="w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 transition-all dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:placeholder:text-k-text-quaternary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                                            />
                                        </div>

                                        {/* Context */}
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-[#1D1D1F] dark:text-xs dark:text-k-text-tertiary">
                                                Contexto adicional <span className="font-normal text-[#86868B] dark:text-k-text-quaternary">(opcional)</span>
                                            </label>
                                            <textarea
                                                placeholder="Descreva o perfil dos alunos, restrições, foco do treinamento..."
                                                value={aiStudentContext}
                                                onChange={(e) => setAiStudentContext(e.target.value)}
                                                className="min-h-[100px] w-full rounded-lg border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/20 resize-none transition-all dark:rounded-xl dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:placeholder:text-k-text-quaternary dark:focus:border-violet-500/50 dark:focus:ring-2 dark:focus:ring-violet-500/10"
                                            />
                                        </div>

                                    </div>

                                    {/* Navigation */}
                                    <div className="flex items-center justify-between mt-6">
                                        <button
                                            onClick={() => setStep('choose')}
                                            className="flex items-center gap-1.5 text-sm font-medium text-[#007AFF] hover:text-[#0056B3] transition-colors px-4 py-2.5 rounded-xl dark:text-k-text-secondary dark:hover:text-k-text-primary dark:hover:bg-glass-bg"
                                        >
                                            <ChevronLeft size={16} />
                                            Voltar
                                        </button>
                                        <button
                                            onClick={handleGenerateAI}
                                            disabled={isGeneratingAI || !aiGoal.trim()}
                                            className="h-11 px-8 bg-[#007AFF] hover:bg-[#0066D6] text-white rounded-full font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2 dark:bg-violet-600 dark:hover:bg-violet-500 dark:rounded-xl dark:font-semibold dark:shadow-lg dark:shadow-violet-600/20"
                                        >
                                            {isGeneratingAI ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Gerando...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} />
                                                    Gerar Draft
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ════════════════════════════════════════════════
                            STEP 3: EDITOR
                        ════════════════════════════════════════════════ */}
                        {step === 'editor' && (
                            <motion.div key="editor" {...stepAnimation}>
                                <div className="max-w-3xl mx-auto pb-24">

                                    {/* Left Column — Form */}
                                    <div className="space-y-6">

                                        {/* Card: Configuração */}
                                        <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:border-k-border-subtle dark:bg-surface-card dark:shadow-none">
                                            <div className="flex items-start gap-4">
                                                <input
                                                    type="text"
                                                    placeholder="Título do Formulário"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    className="flex-1 bg-transparent text-base font-semibold text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none border-b border-transparent focus:border-[#007AFF]/50 pb-1 transition-all dark:text-k-text-primary dark:placeholder:text-k-text-quaternary dark:focus:border-violet-500/50"
                                                />
                                                <div className="flex bg-[#F5F5F7] rounded-lg p-0.5 shrink-0 dark:bg-surface-elevated">
                                                    {CATEGORY_OPTIONS.map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setCategory(opt.value)}
                                                            className={`px-3 py-1 text-xs rounded-md transition-all ${
                                                                category === opt.value
                                                                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:bg-glass-bg-active dark:text-k-text-primary dark:shadow-sm'
                                                                    : 'text-[#AEAEB2] hover:text-[#1D1D1F] dark:text-k-text-quaternary dark:hover:text-k-text-secondary'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {draftSource === 'ai_assisted' && (
                                                    <span className="flex items-center gap-1 rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[10px] font-bold text-[#007AFF] border border-[#007AFF]/20 shrink-0 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
                                                        <Sparkles size={10} strokeWidth={2} />
                                                        IA
                                                    </span>
                                                )}
                                            </div>
                                            <textarea
                                                placeholder="Descrição breve para o aluno (opcional)"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="w-full bg-transparent text-sm text-k-text-secondary placeholder:text-k-text-quaternary outline-none resize-none min-h-[40px]"
                                            />
                                        </div>

                                        {/* Card: Perguntas */}
                                        <div className="rounded-2xl border border-[#D2D2D7] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4 dark:border-k-border-primary dark:bg-surface-card dark:shadow-xl">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-k-text-secondary">
                                                    Perguntas ({questions.length})
                                                </h2>
                                                <button
                                                    onClick={handleAuditAI}
                                                    disabled={isAuditingAI || questions.length === 0}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-[#D2D2D7] bg-transparent hover:bg-[#F5F5F7] text-[#007AFF] transition-all disabled:opacity-40 dark:rounded-lg dark:border-k-border-subtle dark:hover:bg-glass-bg dark:text-k-text-secondary dark:hover:text-violet-400"
                                                >
                                                    <Sparkles size={12} />
                                                    {isAuditingAI ? 'Auditando...' : 'Auditar Qualidade'}
                                                </button>
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
                                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-2">
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
                                                        <div className="rounded-lg border border-[#E8E8ED] bg-[#F5F5F7] p-4 mb-2 dark:rounded-xl dark:border-k-border-subtle dark:bg-surface-elevated/50">
                                                            <p className="mb-2 text-[11px] font-bold text-[#1D1D1F] dark:text-k-text-secondary">Sugestões de Revisão</p>
                                                            <ul className="space-y-1">
                                                                {aiChecklist.map((item) => (
                                                                    <li key={item} className="flex items-start gap-2 text-xs text-[#6E6E73] dark:text-k-text-secondary">
                                                                        <span className="mt-1.5 block h-1 w-1 rounded-full bg-[#007AFF] dark:bg-violet-400 shrink-0" />
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
                                                <div className="rounded-xl bg-surface-elevated/50 px-3 py-2 text-[11px] text-k-text-secondary">
                                                    <span className="block opacity-75">{aiRuntimeNote}</span>
                                                </div>
                                            )}

                                            {/* Empty state */}
                                            {questions.length === 0 && (
                                                <div className="text-center py-8">
                                                    <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center mx-auto mb-3">
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
                                                    <div ref={ref} style={style} className="rounded-xl border border-[#E8E8ED] bg-white p-4 space-y-3 dark:border-k-border-subtle dark:bg-surface-elevated/50">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex items-center gap-1 pt-1 cursor-grab active:cursor-grabbing" {...dragHandleProps}>
                                                                <GripVertical size={14} className="text-k-text-secondary opacity-60 hover:opacity-100 transition-opacity" />
                                                                <span className="text-[10px] font-bold text-k-text-secondary bg-surface-elevated px-1.5 py-0.5 rounded">
                                                                    {index + 1}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 space-y-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Texto da pergunta..."
                                                                    value={q.label}
                                                                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                                                                    className="w-full rounded-lg border border-[#E8E8ED] bg-[#F5F5F7] px-3 py-2 text-sm text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50"
                                                                />
                                                                <div className="flex items-center gap-3">
                                                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#F5F5F7] text-[#6E6E73] dark:rounded-md dark:border dark:bg-surface-elevated dark:text-k-text-tertiary dark:border-k-border-subtle">
                                                                        {typeLabel}
                                                                    </span>
                                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={q.required ?? true}
                                                                            onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                                                                            className="h-3.5 w-3.5 rounded border-[#D2D2D7] text-[#007AFF] accent-[#007AFF] dark:border-k-border-subtle dark:text-violet-600 dark:accent-violet-600"
                                                                        />
                                                                        <span className="text-[11px] text-[#6E6E73] dark:text-k-text-secondary">Obrigatório</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => removeQuestion(index)}
                                                                className="text-[#AEAEB2] hover:text-[#FF3B30] p-1.5 rounded-lg hover:bg-[#F5F5F7] transition-all shrink-0 dark:text-k-text-secondary dark:hover:text-red-400 dark:hover:bg-glass-bg"
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
                                                                            className="flex-1 rounded-lg border border-[#E8E8ED] bg-[#F5F5F7] px-3 py-1.5 text-xs text-[#1D1D1F] outline-none focus:border-[#007AFF] focus:bg-white transition-all dark:border-k-border-subtle dark:bg-glass-bg dark:text-k-text-primary dark:focus:border-violet-500/50"
                                                                        />
                                                                        {(q.options || []).length > 2 && (
                                                                            <button
                                                                                onClick={() => removeOption(index, optIdx)}
                                                                                className="text-k-text-secondary hover:text-red-400 p-1 rounded transition-all"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => addOption(index)}
                                                                    className="text-[11px] font-semibold text-[#007AFF] hover:text-[#0056B3] transition-colors pl-6 dark:text-violet-400 dark:hover:text-violet-300"
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
                                                                        className="w-12 rounded-lg border border-k-border-subtle bg-glass-bg px-2 py-1 text-center text-xs text-k-text-primary outline-none"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-[11px] text-k-text-secondary">Max:</label>
                                                                    <input
                                                                        type="number"
                                                                        value={q.scale?.max ?? 5}
                                                                        onChange={(e) => updateQuestion(index, { scale: { ...q.scale!, max: Number(e.target.value) } })}
                                                                        className="w-12 rounded-lg border border-k-border-subtle bg-glass-bg px-2 py-1 text-center text-xs text-k-text-primary outline-none"
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
                                                    className="w-full h-11 border-2 border-dashed border-[#D2D2D7] hover:border-[#007AFF]/30 rounded-xl text-sm font-semibold text-[#6E6E73] hover:text-[#007AFF] transition-all flex items-center justify-center gap-2 dark:border-k-border-subtle dark:hover:border-violet-500/30 dark:text-k-text-secondary dark:hover:text-violet-400"
                                                >
                                                    <Plus size={16} />
                                                    Adicionar Pergunta
                                                </button>

                                                {showAddMenu && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-k-border-primary bg-surface-card shadow-2xl z-10 overflow-hidden p-1">
                                                        {QUESTION_TYPES.map((qt) => {
                                                            const Icon = qt.icon
                                                            return (
                                                                <button
                                                                    key={qt.value}
                                                                    onClick={() => addQuestion(qt.value)}
                                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-glass-bg transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
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

                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Sticky Save Footer — only on editor step */}
            {step === 'editor' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E8E8ED] bg-white/95 backdrop-blur-sm dark:border-k-border-subtle dark:bg-surface-card/95">
                    <div className="max-w-3xl mx-auto px-8 py-3 flex items-center justify-between">
                        <div className="text-xs text-[#86868B] flex items-center gap-2 dark:text-k-text-quaternary">
                            <span>{questions.length} pergunta{questions.length !== 1 ? 's' : ''}</span>
                            <span className="text-[#86868B]/50 dark:text-k-text-quaternary/50">&middot;</span>
                            <span>~{Math.max(1, Math.ceil(questions.length * 0.8))} min</span>
                            {hasUnsavedChanges && (
                                <>
                                    <span className="text-[#86868B]/50 dark:text-k-text-quaternary/50">&middot;</span>
                                    <span className="text-[#FF9500] dark:text-yellow-500">Alterações não salvas</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (hasUnsavedChanges) {
                                        if (!confirm('Você tem alterações não salvas. Deseja descartar?')) return
                                    }
                                    router.push('/forms/templates')
                                }}
                                className="text-sm text-[#6E6E73] hover:text-[#1D1D1F] font-medium transition-colors dark:text-k-text-quaternary dark:hover:text-k-text-primary"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || questions.length === 0 || !title.trim()}
                                className="px-5 py-2 bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-medium rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 dark:bg-violet-600 dark:hover:bg-violet-500 dark:rounded-xl"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    isEditing
                                        ? (existingTemplate?.trainer_id === null ? 'Salvar como Meu Template' : 'Salvar Alterações')
                                        : 'Salvar Template'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tour: Form Builder (auto-start on first visit) */}
            <TourRunner tourId="form_builder" steps={TOUR_STEPS.form_builder} autoStart />
        </AppLayout>
    )
}

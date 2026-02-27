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
    Save,
    Loader2,
    ChevronDown,
    ChevronLeft,
    Pencil,
} from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

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
    { value: 'short_text', label: 'Texto Curto' },
    { value: 'long_text', label: 'Texto Longo' },
    { value: 'single_choice', label: 'Escolha Única' },
    { value: 'scale', label: 'Escala' },
    { value: 'photo', label: 'Foto' },
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

function StepIndicator({ step, isEditing }: { step: BuilderStep; isEditing: boolean }) {
    if (isEditing) return null
    const steps: BuilderStep[] = ['choose', 'ai_setup', 'editor']
    const currentIndex = steps.indexOf(step)

    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentIndex
                            ? 'w-8 bg-violet-500'
                            : i < currentIndex
                                ? 'w-8 bg-violet-500/40'
                                : 'w-8 bg-glass-bg'
                    }`}
                />
            ))}
        </div>
    )
}

// ─── Mobile Preview ─────────────────────────────────────────────

function MobilePreview({ title, description, questions }: { title: string; description: string; questions: Question[] }) {
    return (
        <div data-onboarding="form-mobile-preview" className="hidden xl:block">
            <div className="sticky top-6">
                {/* Label */}
                <div className="mb-3 text-center">
                    <p className="text-xs font-bold text-k-text-secondary uppercase tracking-widest">
                        Prévia Mobile
                    </p>
                    <p className="text-[11px] text-k-text-quaternary mt-0.5">
                        Assim ficará no app do aluno
                    </p>
                </div>

                {/* Phone Frame */}
                <div className="overflow-hidden rounded-[2.5rem] border-[8px] border-surface-elevated bg-surface-card shadow-2xl ring-1 ring-black/5"
                     style={{ height: 'calc(100vh - 200px)' }}>
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-8 pt-3 pb-1 bg-surface-elevated">
                        <span className="text-[10px] font-semibold text-k-text-tertiary">9:41</span>
                        <div className="h-6 w-24 rounded-full bg-surface-card" />
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-end gap-[2px]">
                                <div className="h-[4px] w-[3px] rounded-sm bg-k-text-tertiary/50" />
                                <div className="h-[6px] w-[3px] rounded-sm bg-k-text-tertiary/50" />
                                <div className="h-[8px] w-[3px] rounded-sm bg-k-text-tertiary/50" />
                                <div className="h-[10px] w-[3px] rounded-sm bg-k-text-tertiary/30" />
                            </div>
                            <div className="h-[10px] w-[20px] rounded-[2px] border border-k-text-tertiary/40 relative">
                                <div className="absolute inset-[1.5px] right-[3px] rounded-[1px] bg-k-text-tertiary/50" />
                                <div className="absolute right-[-3px] top-1/2 -translate-y-1/2 h-[4px] w-[1.5px] rounded-r-sm bg-k-text-tertiary/40" />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="h-full overflow-y-auto bg-surface-elevated px-6 pb-8 pt-4">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-k-text-primary">{title || 'Novo Formulário'}</h3>
                            {description && <p className="mt-2 text-sm text-k-text-secondary">{description}</p>}
                        </div>

                        {questions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-k-border-subtle p-8 text-center">
                                <p className="text-sm text-k-text-secondary">Adicione perguntas ao formulário.</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {questions.map((question) => (
                                    <div key={question.id} className="rounded-2xl bg-surface-card p-4 shadow-sm">
                                        <div className="mb-3">
                                            <p className="font-medium text-k-text-primary">{question.label || 'Pergunta sem título'}</p>
                                            {question.required && (
                                                <span className="mt-1 block text-[10px] text-k-text-tertiary uppercase tracking-wider">Obrigatório</span>
                                            )}
                                        </div>
                                        {renderPreviewByType(question)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function renderPreviewByType(question: Question) {
    if (question.type === 'single_choice') {
        return (
            <div className="space-y-2">
                {(question.options || []).slice(0, 4).map((option) => (
                    <div key={`${question.id}-${option.value}`} className="rounded-lg border border-k-border-subtle bg-surface-inset px-3 py-2 text-xs text-k-text-secondary">
                        {option.label || 'Opção'}
                    </div>
                ))}
            </div>
        )
    }
    if (question.type === 'scale') {
        const min = question.scale?.min ?? 1
        const max = question.scale?.max ?? 5
        const values = Array.from({ length: Math.max(1, max - min + 1) }, (_, idx) => min + idx)
        return (
            <div className="flex gap-1.5">
                {values.map((value) => (
                    <div key={`${question.id}-${value}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-k-border-subtle bg-surface-inset text-xs text-k-text-secondary">
                        {value}
                    </div>
                ))}
            </div>
        )
    }
    if (question.type === 'photo') {
        return <div className="rounded-lg border border-dashed border-k-border-primary bg-surface-inset px-3 py-4 text-xs text-k-text-secondary">Upload de foto</div>
    }
    if (question.type === 'long_text') {
        return <div className="h-20 rounded-lg border border-k-border-subtle bg-surface-inset" />
    }
    return <div className="h-10 rounded-lg border border-k-border-subtle bg-surface-inset" />
}

// ─── Main Component ─────────────────────────────────────────────

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
    const [aiModelUsed, setAiModelUsed] = useState<string | null>(null)
    const [aiRuntimeNote, setAiRuntimeNote] = useState<string | null>(null)
    const [aiQualityReport, setAiQualityReport] = useState<QualityReport | null>(null)
    const [aiChecklist, setAiChecklist] = useState<string[]>([])

    // Add question dropdown
    const [showAddMenu, setShowAddMenu] = useState(false)

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
            setAiModelUsed(result.llmModel || null)
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
                            className="inline-flex items-center gap-1.5 text-xs text-k-text-secondary hover:text-violet-400 transition-colors mb-3"
                        >
                            <ArrowLeft size={14} />
                            Voltar para Templates
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                            {isEditing ? 'Editar Template' : 'Criar Template'}
                        </h1>
                        {isEditing && (
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Editando &quot;{existingTemplate?.title}&quot; (v{existingTemplate?.version})
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
                                    <p className="text-center text-lg font-semibold text-k-text-primary mb-8">
                                        Como deseja criar seu template?
                                    </p>

                                    <div data-onboarding="form-choose-method" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* Card: AI */}
                                        <button
                                            onClick={() => {
                                                setDraftSource('ai_assisted')
                                                setStep('ai_setup')
                                            }}
                                            className="group text-left rounded-2xl border border-k-border-primary bg-surface-card p-8 hover:border-violet-500/30 hover:bg-glass-bg cursor-pointer transition-all duration-200 hover:-translate-y-1"
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 mb-5">
                                                <Sparkles size={24} className="text-violet-400" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-base font-semibold text-k-text-primary mb-2 group-hover:text-violet-300 transition-colors">
                                                Criar com IA
                                            </h3>
                                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                                Descreva o objetivo e a IA gera um draft completo com perguntas, que você pode revisar e editar.
                                            </p>
                                        </button>

                                        {/* Card: Manual */}
                                        <button
                                            onClick={() => {
                                                setDraftSource('manual')
                                                setStep('editor')
                                            }}
                                            className="group text-left rounded-2xl border border-k-border-primary bg-surface-card p-8 hover:border-blue-500/30 hover:bg-glass-bg cursor-pointer transition-all duration-200 hover:-translate-y-1"
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 mb-5">
                                                <Pencil size={24} className="text-blue-400" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-base font-semibold text-k-text-primary mb-2 group-hover:text-blue-300 transition-colors">
                                                Criar Manualmente
                                            </h3>
                                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                                Monte o formulário do zero, escolhendo cada tipo de pergunta.
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
                                    <div className="rounded-2xl border border-k-border-primary bg-surface-card p-8 shadow-xl space-y-6">
                                        {/* Header */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                                                <Sparkles size={20} className="text-violet-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-k-text-primary">Assistente IA</h2>
                                                <p className="text-xs text-k-text-secondary">Configure e gere seu formulário automaticamente</p>
                                            </div>
                                        </div>

                                        {/* Category — Segmented Control */}
                                        <div>
                                            <label className="mb-2 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                                Categoria
                                            </label>
                                            <div className="grid grid-cols-3 gap-1 bg-surface-inset p-1 rounded-xl">
                                                {CATEGORY_OPTIONS.map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className={`
                                                            flex items-center justify-center rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200
                                                            ${category === opt.value
                                                                ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                                                : 'text-k-text-tertiary hover:text-k-text-secondary hover:bg-glass-bg'}
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
                                            <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                                Objetivo <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: anamnese completa para iniciantes em musculação"
                                                value={aiGoal}
                                                onChange={(e) => setAiGoal(e.target.value)}
                                                className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
                                            />
                                        </div>

                                        {/* Context */}
                                        <div>
                                            <label className="mb-1.5 block text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">
                                                Contexto Adicional <span className="font-medium text-k-text-quaternary ml-1">(opcional)</span>
                                            </label>
                                            <textarea
                                                placeholder="Descreva o perfil dos alunos, restrições, foco do treinamento..."
                                                value={aiStudentContext}
                                                onChange={(e) => setAiStudentContext(e.target.value)}
                                                className="min-h-[100px] w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 resize-none transition-all"
                                            />
                                        </div>

                                        {/* Duration */}
                                        <div className="flex items-center gap-3">
                                            <label className="text-[11px] font-bold text-k-text-tertiary uppercase tracking-wider">Duração estimada</label>
                                            <input
                                                type="number"
                                                min={2}
                                                max={20}
                                                value={aiMaxMinutes}
                                                onChange={(e) => setAiMaxMinutes(Number(e.target.value || 6))}
                                                className="w-16 rounded-lg border border-k-border-subtle bg-glass-bg px-2 py-1.5 text-center text-sm text-k-text-primary outline-none focus:border-violet-500/50"
                                            />
                                            <span className="text-xs text-k-text-secondary">minutos</span>
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex items-center justify-between mt-6">
                                        <button
                                            onClick={() => setStep('choose')}
                                            className="flex items-center gap-1.5 text-sm font-medium text-k-text-secondary hover:text-k-text-primary transition-colors px-4 py-2.5 rounded-xl hover:bg-glass-bg"
                                        >
                                            <ChevronLeft size={16} />
                                            Voltar
                                        </button>
                                        <button
                                            onClick={handleGenerateAI}
                                            disabled={isGeneratingAI || !aiGoal.trim()}
                                            className="h-11 px-8 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
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
                                <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8 pb-24">

                                    {/* Left Column — Form */}
                                    <div className="space-y-6">

                                        {/* Card: Configuração */}
                                        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-xl space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-k-text-secondary uppercase tracking-widest">Configuração</h2>
                                                {draftSource === 'ai_assisted' && (
                                                    <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-400 border border-violet-500/20">
                                                        <Sparkles size={10} strokeWidth={2} />
                                                        Draft IA
                                                    </span>
                                                )}
                                            </div>

                                            <input
                                                type="text"
                                                placeholder="Título do Formulário"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm font-medium text-k-text-primary outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
                                            />

                                            {/* Category — Segmented Control */}
                                            <div className="grid grid-cols-3 gap-1 bg-surface-inset p-1 rounded-xl">
                                                {CATEGORY_OPTIONS.map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className={`
                                                            flex items-center justify-center rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200
                                                            ${category === opt.value
                                                                ? 'bg-glass-bg-active text-k-text-primary shadow-sm ring-1 ring-k-border-subtle'
                                                                : 'text-k-text-tertiary hover:text-k-text-secondary hover:bg-glass-bg'}
                                                        `}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="editor_category"
                                                            value={opt.value}
                                                            checked={category === opt.value}
                                                            onChange={() => setCategory(opt.value)}
                                                            className="sr-only"
                                                        />
                                                        <span className="font-semibold text-xs tracking-wide">{opt.label}</span>
                                                    </label>
                                                ))}
                                            </div>

                                            <textarea
                                                placeholder="Descrição breve para o aluno (opcional)"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className="min-h-[80px] w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 resize-none transition-all"
                                            />
                                        </div>

                                        {/* Card: Perguntas */}
                                        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-xl space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-k-text-secondary uppercase tracking-widest">
                                                    Perguntas ({questions.length})
                                                </h2>
                                                <button
                                                    onClick={handleAuditAI}
                                                    disabled={isAuditingAI || questions.length === 0}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-k-border-subtle bg-transparent hover:bg-glass-bg text-k-text-secondary hover:text-violet-400 transition-all disabled:opacity-40"
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
                                                                <p className="text-[11px] font-bold uppercase tracking-widest">Atenção</p>
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
                                                        <div className="rounded-xl border border-k-border-subtle bg-surface-elevated/50 p-4 mb-2">
                                                            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-k-text-secondary">Sugestões de Revisão</p>
                                                            <ul className="space-y-1">
                                                                {aiChecklist.map((item) => (
                                                                    <li key={item} className="flex items-start gap-2 text-xs text-k-text-secondary">
                                                                        <span className="mt-1.5 block h-1 w-1 rounded-full bg-violet-400 shrink-0" />
                                                                        {item}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* AI runtime info */}
                                            {(aiModelUsed || aiRuntimeNote) && (
                                                <div className="rounded-xl bg-surface-elevated/50 px-3 py-2 text-[11px] text-k-text-secondary">
                                                    {aiModelUsed && <span className="block">Modelo: {aiModelUsed}</span>}
                                                    {aiRuntimeNote && <span className="block opacity-75">{aiRuntimeNote}</span>}
                                                </div>
                                            )}

                                            {/* Empty state */}
                                            {questions.length === 0 && (
                                                <div className="rounded-xl border border-dashed border-k-border-subtle p-8 text-center">
                                                    <p className="text-sm text-k-text-secondary">Nenhuma pergunta adicionada.</p>
                                                    <p className="text-xs text-k-text-quaternary mt-1">Use o botão abaixo para adicionar.</p>
                                                </div>
                                            )}

                                            {/* Question Cards */}
                                            {questions.map((q, index) => {
                                                const typeLabel = QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type

                                                return (
                                                    <div key={q.id} className="rounded-xl border border-k-border-subtle bg-surface-elevated/50 p-4 space-y-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex items-center gap-1 pt-1">
                                                                <GripVertical size={14} className="text-k-text-secondary opacity-40" />
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
                                                                    className="w-full rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-2 text-sm text-k-text-primary outline-none focus:border-violet-500/50 transition-all"
                                                                />
                                                                <div className="flex items-center gap-3">
                                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                                        {typeLabel}
                                                                    </span>
                                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={q.required ?? true}
                                                                            onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                                                                            className="h-3.5 w-3.5 rounded border-k-border-subtle text-violet-600 accent-violet-600"
                                                                        />
                                                                        <span className="text-[11px] text-k-text-secondary">Obrigatório</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => removeQuestion(index)}
                                                                className="text-k-text-secondary hover:text-red-400 p-1.5 rounded-lg hover:bg-glass-bg transition-all shrink-0"
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
                                                                            className="flex-1 rounded-lg border border-k-border-subtle bg-glass-bg px-3 py-1.5 text-xs text-k-text-primary outline-none focus:border-violet-500/50 transition-all"
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
                                                                    className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors pl-6"
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
                                                )
                                            })}

                                            {/* Add Question Button */}
                                            <div data-onboarding="form-question-types" className="relative">
                                                <button
                                                    onClick={() => setShowAddMenu(!showAddMenu)}
                                                    className="w-full h-11 border-2 border-dashed border-k-border-subtle hover:border-violet-500/30 rounded-xl text-sm font-semibold text-k-text-secondary hover:text-violet-400 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus size={16} />
                                                    Adicionar Pergunta
                                                    <ChevronDown size={14} className={`transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
                                                </button>

                                                {showAddMenu && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-k-border-primary bg-surface-card shadow-2xl z-10 overflow-hidden">
                                                        {QUESTION_TYPES.map((qt) => (
                                                            <button
                                                                key={qt.value}
                                                                onClick={() => addQuestion(qt.value)}
                                                                className="w-full px-4 py-3 text-left text-sm text-k-text-primary hover:bg-glass-bg transition-colors"
                                                            >
                                                                {qt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column — Mobile Preview */}
                                    <MobilePreview title={title} description={description} questions={questions} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Sticky Save Footer — only on editor step */}
            {step === 'editor' && (
                <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-k-border-subtle bg-surface-card/80 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
                        <div className="text-xs text-k-text-secondary flex items-center gap-3">
                            <span>{questions.length} {questions.length === 1 ? 'pergunta' : 'perguntas'}</span>
                            {draftSource === 'ai_assisted' && (
                                <span className="inline-flex items-center gap-1 text-violet-400">
                                    <Sparkles size={10} />
                                    Draft IA
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="h-11 px-8 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    {isEditing ? 'Salvar Alterações' : 'Salvar Template'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Tour: Form Builder (auto-start on first visit) */}
            <TourRunner tourId="form_builder" steps={TOUR_STEPS.form_builder} autoStart />
        </AppLayout>
    )
}

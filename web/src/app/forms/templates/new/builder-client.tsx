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
                                ? 'bg-emerald-500 text-white'
                                : i === currentIndex
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-surface-elevated text-k-text-quaternary'
                        }`}
                    >
                        {i < currentIndex ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium transition-colors ${
                        i <= currentIndex ? 'text-k-text-primary' : 'text-k-text-quaternary'
                    }`}>
                        {s.label}
                    </span>
                    {i < STEP_LABELS.length - 1 && (
                        <div className={`w-8 h-px ml-1 ${i < currentIndex ? 'bg-emerald-500' : 'bg-surface-elevated'}`} />
                    )}
                </div>
            ))}
        </div>
    )
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
                                    <p className="text-center text-lg font-semibold text-k-text-primary mb-6">
                                        Como deseja criar seu template?
                                    </p>

                                    <div data-onboarding="form-choose-method" className="grid grid-cols-2 gap-4">
                                        {/* Card: AI */}
                                        <button
                                            onClick={() => {
                                                setDraftSource('ai_assisted')
                                                setStep('ai_setup')
                                            }}
                                            className="group text-left rounded-xl border border-k-border-primary bg-surface-card p-5 hover:border-violet-500/30 hover:bg-glass-bg cursor-pointer transition-all duration-200"
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated group-hover:bg-violet-500/10 mb-3 transition-colors">
                                                <Sparkles size={20} className="text-violet-400" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-sm font-semibold text-k-text-primary mb-1 group-hover:text-violet-300 transition-colors">
                                                Criar com IA
                                            </h3>
                                            <p className="text-xs text-k-text-quaternary leading-relaxed">
                                                Descreva o objetivo e a IA gera as perguntas para revisar.
                                            </p>
                                        </button>

                                        {/* Card: Manual */}
                                        <button
                                            onClick={() => {
                                                setDraftSource('manual')
                                                setStep('editor')
                                            }}
                                            className="group text-left rounded-xl border border-k-border-primary bg-surface-card p-5 hover:border-blue-500/30 hover:bg-glass-bg cursor-pointer transition-all duration-200"
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated group-hover:bg-blue-500/10 mb-3 transition-colors">
                                                <Pencil size={20} className="text-blue-400" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-sm font-semibold text-k-text-primary mb-1 group-hover:text-blue-300 transition-colors">
                                                Criar Manualmente
                                            </h3>
                                            <p className="text-xs text-k-text-quaternary leading-relaxed">
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
                                            <label className="mb-2 block text-xs font-medium text-k-text-tertiary">
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
                                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                                Objetivo <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={category === 'anamnese' ? 'Ex: coleta completa de dados do novo aluno' : category === 'checkin' ? 'Ex: acompanhamento semanal do aluno' : 'Ex: questionário de satisfação com o treino'}
                                                value={aiGoal}
                                                onChange={(e) => setAiGoal(e.target.value)}
                                                className="w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
                                            />
                                        </div>

                                        {/* Context */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-k-text-tertiary">
                                                Contexto adicional <span className="font-normal text-k-text-quaternary">(opcional)</span>
                                            </label>
                                            <textarea
                                                placeholder="Descreva o perfil dos alunos, restrições, foco do treinamento..."
                                                value={aiStudentContext}
                                                onChange={(e) => setAiStudentContext(e.target.value)}
                                                className="min-h-[100px] w-full rounded-xl border border-k-border-subtle bg-glass-bg px-4 py-3 text-sm text-k-text-primary placeholder:text-k-text-quaternary outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 resize-none transition-all"
                                            />
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
                                <div className="max-w-3xl mx-auto pb-24">

                                    {/* Left Column — Form */}
                                    <div className="space-y-6">

                                        {/* Card: Configuração */}
                                        <div className="rounded-xl border border-k-border-subtle bg-surface-card p-4 space-y-3">
                                            <div className="flex items-start gap-4">
                                                <input
                                                    type="text"
                                                    placeholder="Título do Formulário"
                                                    value={title}
                                                    onChange={(e) => setTitle(e.target.value)}
                                                    className="flex-1 bg-transparent text-base font-semibold text-k-text-primary placeholder:text-k-text-quaternary outline-none border-b border-transparent focus:border-violet-500/50 pb-1 transition-all"
                                                />
                                                <div className="flex bg-surface-elevated rounded-lg p-0.5 shrink-0">
                                                    {CATEGORY_OPTIONS.map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setCategory(opt.value)}
                                                            className={`px-3 py-1 text-xs rounded-md transition-all ${
                                                                category === opt.value
                                                                    ? 'bg-glass-bg-active text-k-text-primary shadow-sm'
                                                                    : 'text-k-text-quaternary hover:text-k-text-secondary'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {draftSource === 'ai_assisted' && (
                                                    <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400 border border-violet-500/20 shrink-0">
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
                                        <div className="rounded-2xl border border-k-border-primary bg-surface-card p-6 shadow-xl space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-k-text-secondary">
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
                                                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-md border bg-surface-elevated text-k-text-tertiary border-k-border-subtle">
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
                <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-k-border-subtle bg-surface-card/95 backdrop-blur-sm">
                    <div className="max-w-3xl mx-auto px-8 py-3 flex items-center justify-between">
                        <div className="text-xs text-k-text-quaternary flex items-center gap-2">
                            <span>{questions.length} pergunta{questions.length !== 1 ? 's' : ''}</span>
                            <span className="text-k-text-quaternary/50">&middot;</span>
                            <span>~{Math.max(1, Math.ceil(questions.length * 0.8))} min</span>
                            {hasUnsavedChanges && (
                                <>
                                    <span className="text-k-text-quaternary/50">&middot;</span>
                                    <span className="text-yellow-500">Alterações não salvas</span>
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
                                className="text-sm text-k-text-quaternary hover:text-k-text-primary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || questions.length === 0 || !title.trim()}
                                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    isEditing ? 'Salvar Alterações' : 'Salvar Template'
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

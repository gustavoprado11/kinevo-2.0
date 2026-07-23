'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { AppLayout } from '@/components/layout'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import { AssignFormModal } from '@/components/forms/assign-form-modal'
import { SubmissionDetailSheet } from '@/components/forms/submission-detail-sheet'
import { sendFormFeedback } from '@/actions/forms/send-form-feedback'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import {
    Plus, Check, FileText, Send, ChevronRight,
    ClipboardList, CheckCircle2, MessageSquare, Loader2,
} from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'
import { TourHelpButton } from '@/components/onboarding/widgets/tour-help-button'
import { FormsAvaliacoesSegmented } from '@/components/forms/forms-avaliacoes-segmented'
import { KpiRuler } from '@/components/shared/kpi-ruler'

// --- Helpers ---
const TIMEZONE = 'America/Sao_Paulo'

function timeAgo(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const dateStr2 = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
    const today = new Date(todayStr)
    const target = new Date(dateStr2)
    const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffHours < 1) return 'Agora mesmo'
    if (diffHours < 24 && diffDays === 0) return `há ${diffHours}h`
    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `há ${diffDays} dias`
    const weeks = Math.floor(diffDays / 7)
    if (diffDays < 30) return `há ${weeks} sem.`
    const months = Math.floor(diffDays / 30)
    if (diffDays < 365) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
    return `há ${Math.floor(diffDays / 365)} anos`
}

function cleanTemplateName(name: string): string {
    const parts = name.split(' - ')
    if (parts.length === 2 && parts[1].toLowerCase().includes(parts[0].toLowerCase())) {
        return parts[1]
    }
    return name
}

function formatDateTime(value?: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('pt-BR')
}

function extractAnswersMap(answersJson: Record<string, unknown> | null): Record<string, unknown> {
    if (!answersJson || typeof answersJson !== 'object') return {}
    const answersNode = answersJson.answers
    if (answersNode && typeof answersNode === 'object' && !Array.isArray(answersNode)) {
        return answersNode as Record<string, unknown>
    }
    return answersJson
}

function resolveImageUrl(value: unknown): string | null {
    if (typeof value === 'string') {
        return value.startsWith('http://') || value.startsWith('https://') ? value : null
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const imageObj = value as Record<string, unknown>
    const preferred = imageObj.signed_url || imageObj.url || imageObj.public_url
    if (typeof preferred === 'string' && (preferred.startsWith('http://') || preferred.startsWith('https://'))) {
        return preferred
    }
    return null
}

function submissionStatusForSheet(submission: FullSubmission) {
    if (submission.status === 'reviewed' || submission.feedback_sent_at) {
        return { label: 'Feedback enviado', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20' }
    }
    if (submission.status === 'submitted' || submission.submitted_at) {
        return { label: 'Aguardando feedback', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20' }
    }
    return { label: 'Pendente', className: 'bg-surface-inset text-k-text-secondary ring-1 ring-k-border-subtle' }
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText }> = {
    anamnese: { label: 'Anamnese', icon: ClipboardList },
    checkin: { label: 'Check-in', icon: CheckCircle2 },
    survey: { label: 'Pesquisa', icon: MessageSquare },
    feedback: { label: 'Feedback do programa', icon: MessageSquare },
}

// Avatar neutro reutilizado nas linhas (tinta sobre inset — sem cor de categoria).
function RowAvatar({ name, url, size = 32 }: { name: string | null; url: string | null; size?: 28 | 32 }) {
    const dim = size === 28 ? 'h-7 w-7' : 'h-8 w-8'
    return (
        <div className={`flex ${dim} items-center justify-center rounded-full border border-k-border-subtle bg-surface-inset overflow-hidden shrink-0`}>
            {url ? (
                <Image src={url} alt="" width={size} height={size} className={`${dim} rounded-full object-cover`} unoptimized />
            ) : (
                <span className="text-[10px] font-semibold text-k-text-secondary">{(name || '?').charAt(0).toUpperCase()}</span>
            )}
        </div>
    )
}

// --- Types ---
interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface Submission {
    id: string
    status: 'submitted' | 'reviewed'
    submitted_at: string | null
    created_at: string
    feedback_sent_at: string | null
    student_name: string | null
    student_avatar: string | null
    template_title: string | null
}

interface FullSubmission {
    id: string
    form_template_id: string
    student_id: string
    status: 'draft' | 'submitted' | 'reviewed'
    submitted_at: string | null
    feedback_sent_at: string | null
    trainer_feedback: { message?: string } | null
    answers_json: Record<string, unknown> | null
    schema_snapshot_json: { questions?: any[] } | null
    created_at: string
}

interface TemplateInfo {
    id: string
    title: string
    category: string
    responseCount: number
    questionCount: number
    trainer_id: string | null
}

interface FormTemplate {
    id: string
    title: string
    version: number
}

interface Student {
    id: string
    name: string
    avatar_url?: string | null
}

type FilterType = 'all' | 'pending' | 'completed'

interface PendingSent {
    id: string
    created_at: string
    student_name: string | null
    student_avatar: string | null
    template_title: string | null
}

interface FormsDashboardClientProps {
    trainer: Trainer
    submissions: Submission[]
    pendingSent: PendingSent[]
    templates: TemplateInfo[]
    formTemplates: FormTemplate[]
    students: Student[]
    onboardingState: OnboardingState | null
}

// --- Component ---
export function FormsDashboardClient({
    trainer,
    submissions,
    pendingSent,
    templates,
    formTemplates,
    students,
    onboardingState,
}: FormsDashboardClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const [filter, setFilter] = useState<FilterType>('all')
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null)

    // Handle URL params (?assign=templateId)
    useEffect(() => {
        const assignParam = searchParams.get('assign')
        if (assignParam) {
            setPreselectedTemplateId(assignParam)
            setIsAssignOpen(true)
        }
    }, [searchParams])

    // Detail sheet state
    const [activeSubmission, setActiveSubmission] = useState<FullSubmission | null>(null)
    const [loadingSubmissionId, setLoadingSubmissionId] = useState<string | null>(null)
    const [feedbackMessage, setFeedbackMessage] = useState('')
    const [isSendingFeedback, setIsSendingFeedback] = useState(false)
    const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

    const pending = useMemo(() =>
        submissions.filter(s => s.status === 'submitted'), [submissions])
    const completed = useMemo(() =>
        submissions.filter(s => s.status === 'reviewed'), [submissions])

    const filteredSubmissions = useMemo(() => {
        if (filter === 'pending') return pending
        if (filter === 'completed') return completed
        return submissions
    }, [submissions, filter, pending, completed])

    // Students and templates maps for the detail sheet
    const studentsMap = useMemo(() => {
        const map = new Map<string, Student>()
        for (const s of students) map.set(s.id, s)
        return map
    }, [students])

    const templatesMap = useMemo(() => {
        const map = new Map<string, FormTemplate>()
        for (const t of formTemplates) map.set(t.id, t)
        return map
    }, [formTemplates])

    // Lazy-load full submission data
    const openSubmission = useCallback(async (id: string) => {
        setLoadingSubmissionId(id)
        try {
            const supabase = createBrowserClient()
            const { data, error } = await supabase
                .from('form_submissions')
                .select('id, form_template_id, student_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
                .eq('id', id)
                .single()

            if (error || !data) {
                console.error('Error fetching submission:', error)
                return
            }

            const submission = data as FullSubmission
            setActiveSubmission(submission)
            setFeedbackMessage(submission.trainer_feedback?.message || '')
        } finally {
            setLoadingSubmissionId(null)
        }
    }, [])

    const closeSubmission = useCallback(() => {
        setActiveSubmission(null)
        setFeedbackMessage('')
    }, [])

    const handleSendFeedback = useCallback(async () => {
        if (!activeSubmission) return
        const message = feedbackMessage.trim()
        if (!message) return

        setIsSendingFeedback(true)
        try {
            const result = await sendFormFeedback({ submissionId: activeSubmission.id, message })
            if (!result.success) {
                toast({ message: result.error || 'Erro ao enviar feedback.', type: 'error' })
                return
            }
            const supabase = createBrowserClient()
            const { data } = await supabase
                .from('form_submissions')
                .select('id, form_template_id, student_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
                .eq('id', activeSubmission.id)
                .single()

            if (data) {
                const submission = data as FullSubmission
                setActiveSubmission(submission)
                setFeedbackMessage(submission.trainer_feedback?.message || '')
            }
            router.refresh()
        } finally {
            setIsSendingFeedback(false)
        }
    }, [activeSubmission, feedbackMessage, router, toast])

    const activeQuestions = useMemo(
        () => Array.isArray(activeSubmission?.schema_snapshot_json?.questions)
            ? activeSubmission?.schema_snapshot_json?.questions
            : [],
        [activeSubmission]
    )

    const activeAnswers = useMemo(
        () => extractAnswersMap(activeSubmission?.answers_json || null),
        [activeSubmission]
    )

    const activeStudent = activeSubmission ? studentsMap.get(activeSubmission.student_id) : undefined
    const activeTemplate = activeSubmission ? templatesMap.get(activeSubmission.form_template_id) : undefined

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
            onboardingState={onboardingState}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-k-text-primary">Formulários</h1>
                        <TourHelpButton tourId="tour_forms_first_time" />
                    </div>
                    <p className="mt-1 text-sm text-k-text-tertiary">
                        Anamneses, check-ins e pesquisas que o aluno responde no app
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        data-onboarding="forms-send-cta"
                        onClick={() => setIsAssignOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold rounded-control transition-opacity"
                    >
                        <Send size={14} />
                        Enviar para aluno
                    </button>
                    <button
                        data-onboarding="forms-templates-card"
                        onClick={() => router.push('/forms/templates/new')}
                        className="flex items-center gap-2 px-4 py-2 rounded-control border border-k-border-primary bg-surface-card text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset text-sm font-medium transition-colors"
                    >
                        <Plus size={14} />
                        Novo template
                    </button>
                </div>
            </div>

            <FormsAvaliacoesSegmented active="formularios" />

            {/* Régua de métricas */}
            <div className="mb-6">
                <KpiRuler
                    ariaLabel="Indicadores de formulários"
                    cells={[
                        { key: 'total', label: 'Respostas', value: submissions.length, sub: 'recebidas no total' },
                        {
                            key: 'pending',
                            label: 'Aguardando feedback',
                            value: pending.length,
                            tone: pending.length > 0 ? 'amber' : 'neutral',
                            sub: 'a responder',
                        },
                        {
                            key: 'completed',
                            label: 'Concluídas',
                            value: completed.length,
                            sub: submissions.length > 0
                                ? `${Math.round((completed.length / submissions.length) * 100)}% com feedback`
                                : 'nenhuma ainda',
                        },
                        {
                            key: 'templates',
                            label: 'Templates',
                            value: templates.length,
                            sub: templates.length === 1 ? 'ativo' : 'ativos',
                        },
                    ]}
                />
            </div>

            {/* Proactive CTA — só aparece quando há pendência */}
            {pending.length > 0 && (
                <button
                    onClick={() => {
                        const first = pending[0]
                        if (first) openSubmission(first.id)
                    }}
                    className="mb-6 w-full rounded-panel border border-k-border-subtle bg-surface-card px-5 py-3 flex items-center justify-between hover:bg-surface-inset transition-colors"
                >
                    <span className="flex items-center gap-2.5 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="font-medium text-k-text-primary">
                            {pending.length} {pending.length === 1 ? 'feedback aguardando' : 'feedbacks aguardando'}
                        </span>
                        <span className="text-k-text-tertiary">— comece pelo mais antigo</span>
                    </span>
                    <ChevronRight size={16} className="text-k-text-tertiary" />
                </button>
            )}

            <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">

                <div className="space-y-6">
                    {/* Aguardando feedback */}
                    <div data-onboarding="forms-pending" className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                        {pending.length > 0 ? (
                            <>
                                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-k-border-subtle">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Aguardando feedback</h2>
                                    <span className="font-mono text-[11px] tabular-nums text-k-text-tertiary">{pending.length}</span>
                                </div>
                                <div className="divide-y divide-k-border-subtle">
                                    {pending.map(sub => (
                                        <div
                                            key={sub.id}
                                            className="group flex items-center justify-between px-5 py-3 hover:bg-surface-inset transition-colors cursor-pointer"
                                            onClick={() => openSubmission(sub.id)}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <RowAvatar name={sub.student_name} url={sub.student_avatar} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-k-text-primary truncate">{sub.student_name || 'Aluno'}</p>
                                                    <p className="text-xs text-k-text-tertiary truncate">
                                                        {cleanTemplateName(sub.template_title || 'Template')} · <span className="font-mono tabular-nums">recebido {timeAgo(sub.submitted_at || sub.created_at)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {loadingSubmissionId === sub.id ? (
                                                    <Loader2 size={14} className="animate-spin text-k-text-tertiary" />
                                                ) : (
                                                    <ChevronRight size={14} className="text-k-text-quaternary group-hover:text-k-text-tertiary transition-colors" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 px-5 py-4">
                                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-medium text-k-text-secondary">Todos os feedbacks em dia</span>
                            </div>
                        )}
                    </div>

                    {/* Enviados pendentes — forms atribuídos e ainda não respondidos */}
                    {pendingSent.length > 0 && (
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-k-border-subtle">
                                <Send size={13} className="text-k-text-tertiary" />
                                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Enviados pendentes</h2>
                                <span className="font-mono text-[11px] tabular-nums text-k-text-tertiary">{pendingSent.length}</span>
                            </div>
                            <div className="divide-y divide-k-border-subtle">
                                {pendingSent.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between px-5 py-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <RowAvatar name={item.student_name} url={item.student_avatar} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-k-text-primary truncate">{item.student_name || 'Aluno'}</p>
                                                <p className="text-xs text-k-text-tertiary truncate">
                                                    {cleanTemplateName(item.template_title || 'Template')} · <span className="font-mono tabular-nums">enviado {timeAgo(item.created_at)}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <span className="flex items-center gap-1.5 text-xs text-k-text-tertiary shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            Aguardando resposta
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Templates */}
                    <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-k-border-subtle">
                            <div className="flex items-center gap-2">
                                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Templates de formulário</h2>
                                {templates.length > 0 && (
                                    <span className="font-mono text-[11px] tabular-nums text-k-text-tertiary">{templates.length}</span>
                                )}
                            </div>
                            <button
                                onClick={() => router.push('/forms/templates')}
                                className="flex items-center gap-1 text-xs font-medium text-k-text-secondary hover:text-k-text-primary transition-colors"
                            >
                                Gerenciar
                                <ChevronRight size={13} />
                            </button>
                        </div>

                        {templates.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-6 h-6 text-k-text-quaternary mx-auto mb-2" strokeWidth={1.5} />
                                <p className="text-xs text-k-text-tertiary">Nenhum template criado</p>
                                <button
                                    onClick={() => router.push('/forms/templates/new')}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                                >
                                    <Plus size={13} />
                                    Criar primeiro template
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-k-border-subtle">
                                {templates.map(t => {
                                    const config = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.survey
                                    const Icon = config.icon
                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => router.push(`/forms/templates/new?edit=${t.id}`)}
                                            className="w-full flex items-center justify-between py-3 px-5 hover:bg-surface-inset transition-colors text-left group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon size={14} className="text-k-text-tertiary shrink-0" />
                                                <span className="text-sm text-k-text-primary truncate">
                                                    {cleanTemplateName(t.title)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-k-text-tertiary shrink-0">
                                                {t.questionCount > 0 && (
                                                    <span className="font-mono tabular-nums">{t.questionCount} {t.questionCount === 1 ? 'pergunta' : 'perguntas'}</span>
                                                )}
                                                <span className="text-k-text-quaternary">·</span>
                                                <span className="font-mono tabular-nums">{t.responseCount} {t.responseCount === 1 ? 'resposta' : 'respostas'}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPreselectedTemplateId(t.id); setIsAssignOpen(true) }}
                                                    className="flex items-center gap-0.5 text-k-text-secondary hover:text-k-text-primary opacity-0 group-hover:opacity-100 transition-all font-medium"
                                                >
                                                    Enviar
                                                    <ChevronRight size={12} />
                                                </button>
                                                <ChevronRight size={14} className="text-k-text-quaternary group-hover:text-k-text-tertiary transition-colors" />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6 lg:flex lg:flex-col lg:min-h-0">
                    {/* Todas as respostas */}
                    {submissions.length > 0 && (
                        <div className="rounded-panel border border-k-border-subtle bg-surface-card overflow-hidden lg:flex lg:flex-col lg:max-h-[calc(100vh-220px)]">
                            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-k-border-subtle lg:flex-shrink-0">
                                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-k-text-secondary">Todas as respostas</h2>
                                <div className="inline-flex rounded-control border border-k-border-primary bg-surface-card overflow-hidden">
                                    {([
                                        { key: 'all' as const, label: 'Todas', count: submissions.length },
                                        { key: 'pending' as const, label: 'Pendentes', count: pending.length },
                                        { key: 'completed' as const, label: 'Concluídas', count: completed.length },
                                    ]).map(f => (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilter(f.key)}
                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                filter === f.key
                                                    ? 'bg-surface-inset text-k-text-primary font-semibold'
                                                    : 'text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset/60'
                                            }`}
                                        >
                                            {f.label} <span className="font-mono tabular-nums text-k-text-tertiary">{f.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="divide-y divide-k-border-subtle lg:flex-1 lg:overflow-y-auto">
                                {filteredSubmissions.map(sub => {
                                    const isPending = sub.status === 'submitted'
                                    const isLoading = loadingSubmissionId === sub.id
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => openSubmission(sub.id)}
                                            className="w-full group flex items-center justify-between gap-3 py-2.5 px-5 hover:bg-surface-inset transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <RowAvatar name={sub.student_name} url={sub.student_avatar} size={28} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-k-text-primary truncate">
                                                            {sub.student_name || 'Aluno'}
                                                        </span>
                                                        <span className="text-xs text-k-text-tertiary truncate hidden sm:inline">
                                                            {cleanTemplateName(sub.template_title || '') || 'Formulário removido'}
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-[11.5px] tabular-nums text-k-text-quaternary">
                                                        {timeAgo(sub.submitted_at || sub.created_at)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2.5 shrink-0">
                                                {isLoading ? (
                                                    <Loader2 size={14} className="animate-spin text-k-text-quaternary" />
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-xs text-k-text-secondary">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                        {isPending ? 'Aguardando' : 'Feedback enviado'}
                                                    </span>
                                                )}
                                                <ChevronRight size={14} className="text-k-text-quaternary group-hover:text-k-text-tertiary transition-colors" />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                </div>

            </div>

            {submissions.length === 0 && templates.length === 0 && (
                <div className="text-center py-16 mt-4">
                    <ClipboardList className="w-10 h-10 text-k-text-quaternary mx-auto mb-3" strokeWidth={1} />
                    <p className="text-sm font-semibold text-k-text-primary mb-1">Comece criando um template</p>
                    <p className="text-xs text-k-text-quaternary max-w-sm mx-auto">
                        Templates são formulários que você envia para seus alunos. Crie anamneses, check-ins semanais ou pesquisas personalizadas.
                    </p>
                    <button
                        onClick={() => router.push('/forms/templates/new')}
                        className="mt-5 inline-flex items-center gap-1.5 rounded-control bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                        <Plus size={13} />
                        Criar primeiro template
                    </button>
                </div>
            )}

            {/* Submission Detail Sheet */}
            <AnimatePresence>
                {activeSubmission && (
                    <SubmissionDetailSheet
                        submission={activeSubmission}
                        onClose={closeSubmission}
                        student={activeStudent}
                        template={activeTemplate}
                        questions={activeQuestions || []}
                        answers={activeAnswers as any}
                        feedbackMessage={feedbackMessage}
                        setFeedbackMessage={setFeedbackMessage}
                        onSendFeedback={handleSendFeedback}
                        isSendingFeedback={isSendingFeedback}
                        formatDateTime={formatDateTime}
                        submissionStatus={submissionStatusForSheet as any}
                        resolveImageUrl={resolveImageUrl}
                        setZoomImageUrl={setZoomImageUrl}
                    />
                )}
            </AnimatePresence>

            {/* Zoom Image Overlay */}
            {zoomImageUrl && (
                <div
                    className="fixed inset-0 z-float flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setZoomImageUrl(null)}
                >
                    <img
                        src={zoomImageUrl}
                        alt="Zoom"
                        className="max-h-[90vh] max-w-[90vw] rounded-panel object-contain"
                    />
                </div>
            )}

            {/* Assign Form Modal */}
            <AssignFormModal
                isOpen={isAssignOpen}
                onClose={() => {
                    setIsAssignOpen(false)
                    setPreselectedTemplateId(null)
                }}
                templates={formTemplates}
                students={students}
                preselectedTemplateId={preselectedTemplateId}
            />

            {/* Tour: Formulários (M8/B4 — split do tour antigo `forms`) */}
            <TourRunner
                tourId="tour_forms_first_time"
                steps={TOUR_STEPS.tour_forms_first_time}
            />
        </AppLayout>
    )
}

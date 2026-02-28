'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { AppLayout } from '@/components/layout'
import { AssignFormModal } from '@/components/forms/assign-form-modal'
import { SubmissionDetailSheet } from '@/components/forms/submission-detail-sheet'
import { sendFormFeedback } from '@/actions/forms/send-form-feedback'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import {
    Plus, Check, FileText, Send, ChevronRight,
    ClipboardList, CheckCircle2, MessageSquare, Loader2,
} from 'lucide-react'
import { TourRunner } from '@/components/onboarding/tours/tour-runner'
import { TOUR_STEPS } from '@/components/onboarding/tours/tour-definitions'

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
        return { label: 'Feedback Enviado', className: 'bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20' }
    }
    if (submission.status === 'submitted' || submission.submitted_at) {
        return { label: 'Concluído', className: 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20' }
    }
    return { label: 'Pendente', className: 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20' }
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
    anamnese: { label: 'Anamnese', icon: ClipboardList, color: 'text-blue-400' },
    checkin: { label: 'Check-in', icon: CheckCircle2, color: 'text-emerald-400' },
    survey: { label: 'Pesquisa', icon: MessageSquare, color: 'text-amber-400' },
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

interface FormsDashboardClientProps {
    trainer: Trainer
    submissions: Submission[]
    templates: TemplateInfo[]
    formTemplates: FormTemplate[]
    students: Student[]
}

// --- Component ---
export function FormsDashboardClient({
    trainer,
    submissions,
    templates,
    formTemplates,
    students,
}: FormsDashboardClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
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

            setActiveSubmission(data as FullSubmission)
            setFeedbackMessage(data.trainer_feedback?.message || '')
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
                alert(result.error || 'Erro ao enviar feedback.')
                return
            }
            // Refresh the submission data to show "feedback sent" state
            const supabase = createBrowserClient()
            const { data } = await supabase
                .from('form_submissions')
                .select('id, form_template_id, student_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
                .eq('id', activeSubmission.id)
                .single()

            if (data) {
                setActiveSubmission(data as FullSubmission)
                setFeedbackMessage(data.trainer_feedback?.message || '')
            }
            router.refresh()
        } finally {
            setIsSendingFeedback(false)
        }
    }, [activeSubmission, feedbackMessage, router])

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
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-white">Avaliações</h1>
                    {submissions.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-glass-bg text-xs font-bold text-k-text-tertiary border border-k-border-subtle">
                            {submissions.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAssignOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all"
                    >
                        <Send size={14} />
                        Enviar para aluno
                    </button>
                    <button
                        data-onboarding="forms-templates-card"
                        onClick={() => router.push('/forms/templates/new')}
                        className="flex items-center gap-2 rounded-xl border border-k-border-primary text-k-text-tertiary hover:text-k-text-primary px-4 py-2 text-sm transition-all"
                    >
                        <Plus size={14} />
                        Novo Template
                    </button>
                </div>
            </div>

            {/* Pending Feedback Section */}
            <div data-onboarding="forms-pending" className="mb-6">
                {pending.length > 0 ? (
                    <>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            <h2 className="text-sm font-semibold text-white">Aguardando Feedback</h2>
                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-[10px] font-bold text-yellow-400 border border-yellow-500/20">
                                {pending.length}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {pending.map(sub => (
                                <div
                                    key={sub.id}
                                    className="flex items-center justify-between p-4 bg-yellow-500/5 border border-yellow-500/15 rounded-xl hover:border-yellow-500/30 transition-all cursor-pointer"
                                    onClick={() => openSubmission(sub.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden shrink-0">
                                            {sub.student_avatar ? (
                                                <Image src={sub.student_avatar} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                                            ) : (
                                                <span className="text-[10px] font-semibold text-k-text-primary">
                                                    {(sub.student_name || '?').charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{sub.student_name || 'Aluno'}</p>
                                            <p className="text-xs text-k-text-quaternary">
                                                {cleanTemplateName(sub.template_title || 'Template')} · Recebido {timeAgo(sub.submitted_at || sub.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {loadingSubmissionId === sub.id ? (
                                            <Loader2 size={14} className="animate-spin text-yellow-400" />
                                        ) : (
                                            <span className="text-xs px-3 py-1.5 bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 rounded-lg transition-colors font-medium">
                                                Dar Feedback →
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg w-fit">
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">Todos os feedbacks em dia</span>
                    </div>
                )}
            </div>

            {/* All Submissions */}
            {submissions.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-sm font-semibold text-white">Todas as Respostas</h2>
                    </div>

                    {/* Filter Chips */}
                    <div className="flex items-center gap-2 mb-4">
                        {([
                            { key: 'all' as const, label: 'Todas', count: submissions.length },
                            { key: 'pending' as const, label: 'Pendentes', count: pending.length },
                            { key: 'completed' as const, label: 'Concluídas', count: completed.length },
                        ]).map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                    filter === f.key
                                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                                        : 'bg-glass-bg text-k-text-quaternary border border-k-border-subtle hover:text-k-text-secondary'
                                }`}
                            >
                                {f.label} ({f.count})
                            </button>
                        ))}
                    </div>

                    {/* Submission Rows */}
                    <div className="space-y-1">
                        {filteredSubmissions.map(sub => {
                            const isPending = sub.status === 'submitted'
                            const isLoading = loadingSubmissionId === sub.id
                            return (
                                <button
                                    key={sub.id}
                                    onClick={() => openSubmission(sub.id)}
                                    className="w-full group flex items-center justify-between py-3 px-4 hover:bg-glass-bg rounded-xl transition-all text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden shrink-0">
                                            {sub.student_avatar ? (
                                                <Image src={sub.student_avatar} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                                            ) : (
                                                <span className="text-[10px] font-semibold text-k-text-primary">
                                                    {(sub.student_name || '?').charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-k-text-secondary group-hover:text-white transition-colors truncate">
                                                    {sub.student_name || 'Aluno'}
                                                </span>
                                                <span className="text-xs text-k-text-quaternary truncate hidden sm:inline">
                                                    {cleanTemplateName(sub.template_title || '')}
                                                </span>
                                            </div>
                                            <span className="text-xs text-k-text-quaternary">
                                                {timeAgo(sub.submitted_at || sub.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isLoading ? (
                                            <Loader2 size={14} className="animate-spin text-k-text-quaternary" />
                                        ) : isPending ? (
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                Aguardando
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                Concluído
                                            </span>
                                        )}
                                        <ChevronRight size={14} className="text-k-border-subtle group-hover:text-k-text-tertiary transition-all" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Templates Section */}
            <div className="mt-8 pt-6 border-t border-k-border-subtle">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-white">Templates de Avaliação</h2>
                        {templates.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-glass-bg text-[10px] font-bold text-k-text-quaternary border border-k-border-subtle">
                                {templates.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => router.push('/forms/templates')}
                        className="text-xs text-k-text-quaternary hover:text-k-text-secondary transition-colors font-medium"
                    >
                        Gerenciar →
                    </button>
                </div>

                {templates.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border border-dashed border-k-border-primary">
                        <FileText className="w-6 h-6 text-k-text-quaternary mx-auto mb-2" />
                        <p className="text-xs text-k-text-quaternary">Nenhum template criado</p>
                        <button
                            onClick={() => router.push('/forms/templates/new')}
                            className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Criar primeiro template
                        </button>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {templates.map(t => {
                            const config = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.survey
                            const Icon = config.icon
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => router.push(`/forms/templates/new?edit=${t.id}`)}
                                    className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-glass-bg rounded-xl transition-all text-left group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <Icon size={14} className={config.color} />
                                        <span className="text-sm text-k-text-secondary group-hover:text-white transition-colors truncate">
                                            {cleanTemplateName(t.title)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-k-text-quaternary shrink-0">
                                        {t.questionCount > 0 && (
                                            <span>{t.questionCount} {t.questionCount === 1 ? 'pergunta' : 'perguntas'}</span>
                                        )}
                                        <span className="text-k-text-quaternary">·</span>
                                        <span>{t.responseCount} {t.responseCount === 1 ? 'resposta' : 'respostas'}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setPreselectedTemplateId(t.id); setIsAssignOpen(true) }}
                                            className="text-violet-400 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-all font-medium"
                                        >
                                            Enviar →
                                        </button>
                                        <ChevronRight size={14} className="text-k-border-subtle group-hover:text-k-text-tertiary transition-all" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Empty state: no submissions AND no templates */}
            {submissions.length === 0 && templates.length === 0 && (
                <div className="text-center py-16 mt-4">
                    <ClipboardList className="w-10 h-10 text-k-text-quaternary mx-auto mb-3" strokeWidth={1} />
                    <p className="text-sm font-semibold text-white mb-1">Comece criando um template</p>
                    <p className="text-xs text-k-text-quaternary max-w-sm mx-auto">
                        Templates são formulários que você envia para seus alunos. Crie anamneses, check-ins semanais ou pesquisas personalizadas.
                    </p>
                    <button
                        onClick={() => router.push('/forms/templates/new')}
                        className="mt-5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        Criar primeiro template
                    </button>
                </div>
            )}

            {/* Submission Detail Sheet — inline, controlled by local state */}
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
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setZoomImageUrl(null)}
                >
                    <img
                        src={zoomImageUrl}
                        alt="Zoom"
                        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
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

            {/* Tour */}
            <TourRunner tourId="forms" steps={TOUR_STEPS.forms} autoStart />
        </AppLayout>
    )
}

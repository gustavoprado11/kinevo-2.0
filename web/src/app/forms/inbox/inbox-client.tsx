'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { AppLayout } from '@/components/layout'
import { EmptyState } from '@/components/financial/empty-state'
import { AssignFormModal } from '@/components/forms/assign-form-modal'
import { SubmissionDetailSheet } from '@/components/forms/submission-detail-sheet'
import { sendFormFeedback } from '@/actions/forms/send-form-feedback'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import {
    Search,
    Send,
    Inbox,
    ChevronRight,
    ArrowLeft,
} from 'lucide-react'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: string | null
}

interface Student {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    status: string
}

interface FormTemplate {
    id: string
    title: string
    version: number
    category: string
}

interface Submission {
    id: string
    form_template_id: string
    student_id: string
    trainer_id: string
    status: string
    submitted_at: string | null
    feedback_sent_at: string | null
    trainer_feedback: { message?: string } | null
    answers_json: Record<string, unknown> | null
    schema_snapshot_json: { questions?: any[] } | null
    created_at: string
}

interface InboxClientProps {
    trainer: Trainer
    submissions: Submission[]
    students: Student[]
    templates: FormTemplate[]
}

// Helpers
function formatDateTime(value?: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('pt-BR')
}

function getInitials(name?: string) {
    if (!name) return 'AL'
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
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

function submissionStatusBadge(status: string, feedbackSentAt: string | null) {
    if (status === 'reviewed' || feedbackSentAt) {
        return { label: 'Feedback Enviado', classes: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
    }
    if (status === 'submitted') {
        return { label: 'Aguardando', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    }
    return { label: 'Pendente', classes: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
}

function submissionStatusForSheet(submission: Submission) {
    if (submission.status === 'reviewed' || submission.feedback_sent_at) {
        return { label: 'Feedback Enviado', className: 'bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20' }
    }
    if (submission.status === 'submitted' || submission.submitted_at) {
        return { label: 'Concluído', className: 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20' }
    }
    return { label: 'Pendente', className: 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20' }
}

export function InboxClient({ trainer, submissions: initialSubmissions, students, templates }: InboxClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = useMemo(() => createBrowserClient(), [])

    const [submissionRows, setSubmissionRows] = useState(initialSubmissions)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null)
    const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
    const [assignModalOpen, setAssignModalOpen] = useState(false)
    const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null)

    // Feedback State
    const [sendingFeedbackId, setSendingFeedbackId] = useState<string | null>(null)
    const [feedbackBySubmissionId, setFeedbackBySubmissionId] = useState<Record<string, string>>(() => {
        const seed: Record<string, string> = {}
        for (const sub of initialSubmissions) {
            seed[sub.id] = sub.trainer_feedback?.message || ''
        }
        return seed
    })

    // Handle URL params (submission= or assign=)
    useEffect(() => {
        const submissionParam = searchParams.get('submission')
        if (submissionParam) {
            setActiveSubmissionId(submissionParam)
        }
        const assignParam = searchParams.get('assign')
        if (assignParam) {
            setPreselectedTemplateId(assignParam)
            setAssignModalOpen(true)
        }
    }, [searchParams])

    // Sync submissions from server
    useEffect(() => {
        setSubmissionRows(initialSubmissions)
    }, [initialSubmissions])

    // Realtime subscriptions
    useEffect(() => {
        const refreshSubmission = async (submissionId: string) => {
            if (!submissionId) return
            const { data, error } = await supabase
                .from('form_submissions')
                .select('id, form_template_id, student_id, trainer_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
                .eq('id', submissionId)
                .single()

            if (error || !data) return

            setSubmissionRows((prev) => {
                const nextRows = prev.filter((row) => row.id !== submissionId)
                return [data as Submission, ...nextRows].slice(0, 100)
            })
        }

        const channel = supabase
            .channel(`forms-submissions-${trainer.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'form_submissions', filter: `trainer_id=eq.${trainer.id}` },
                (payload) => {
                    const changedId = (payload.new as { id?: string } | null)?.id || (payload.old as { id?: string } | null)?.id
                    if (changedId) refreshSubmission(changedId)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, trainer.id])

    // Lookup maps
    const studentsById = useMemo(() => {
        const map = new Map<string, Student>()
        for (const s of students) map.set(s.id, s)
        return map
    }, [students])

    const templatesById = useMemo(() => {
        const map = new Map<string, FormTemplate>()
        for (const t of templates) map.set(t.id, t)
        return map
    }, [templates])

    const activeStudents = useMemo(
        () => students.filter((s) => s.status === 'active' || s.status === 'pending'),
        [students]
    )

    // Filtered submissions
    const filteredSubmissions = useMemo(() => {
        const search = searchQuery.trim().toLowerCase()
        if (!search) return submissionRows

        return submissionRows.filter((sub) => {
            const template = templatesById.get(sub.form_template_id)
            const student = studentsById.get(sub.student_id)
            return (
                template?.title?.toLowerCase().includes(search) ||
                student?.name?.toLowerCase().includes(search) ||
                student?.email?.toLowerCase().includes(search)
            )
        })
    }, [submissionRows, searchQuery, studentsById, templatesById])

    // Active submission detail
    const activeSubmission = useMemo(
        () => submissionRows.find((row) => row.id === activeSubmissionId) || null,
        [submissionRows, activeSubmissionId]
    )

    const activeSubmissionAnswers = useMemo(
        () => extractAnswersMap(activeSubmission?.answers_json || null),
        [activeSubmission]
    )

    const activeSubmissionQuestions = useMemo(
        () => (Array.isArray(activeSubmission?.schema_snapshot_json?.questions)
            ? activeSubmission?.schema_snapshot_json?.questions
            : []),
        [activeSubmission]
    )

    // Handlers
    const handleSendFeedback = async () => {
        if (!activeSubmissionId) return
        const message = (feedbackBySubmissionId[activeSubmissionId] || '').trim()
        if (!message) return

        setSendingFeedbackId(activeSubmissionId)
        try {
            const result = await sendFormFeedback({ submissionId: activeSubmissionId, message })
            if (!result.success) {
                alert(result.error || 'Erro ao enviar feedback.')
                return
            }
            router.refresh()
        } finally {
            setSendingFeedbackId(null)
        }
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            <div className="min-h-screen bg-surface-primary p-8 font-sans">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <Link
                                href="/forms"
                                className="inline-flex items-center gap-1.5 text-xs text-k-text-secondary hover:text-violet-400 transition-colors mb-3"
                            >
                                <ArrowLeft size={14} />
                                Voltar para Avaliações
                            </Link>
                            <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                                Inbox de Respostas
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground/60">
                                Visualize respostas e envie feedbacks aos alunos
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setPreselectedTemplateId(null)
                                setAssignModalOpen(true)
                            }}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center gap-2 w-fit"
                        >
                            <Send size={18} strokeWidth={2} />
                            Enviar Formulário
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-[18px] h-[18px] text-k-text-quaternary group-focus-within:text-violet-500 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por aluno ou template..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-glass-bg border border-k-border-primary rounded-2xl py-3.5 pl-11 pr-4 text-k-text-primary placeholder:text-k-text-quaternary focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500/50 backdrop-blur-md transition-all"
                        />
                    </div>

                    {/* Submissions Table */}
                    <div className="rounded-2xl border border-k-border-primary bg-surface-card shadow-xl overflow-hidden">
                        {/* Table Header */}
                        <div className="border-b border-k-border-subtle bg-surface-elevated/30 px-6 py-3">
                            <div className="grid grid-cols-[1.5fr_1.2fr_1fr_1fr_24px] gap-4">
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Aluno</span>
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Template</span>
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Data</span>
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Status</span>
                                <span />
                            </div>
                        </div>

                        {/* Table Body */}
                        {filteredSubmissions.length === 0 ? (
                            <EmptyState
                                icon={Inbox}
                                title="Nenhuma submissão"
                                description={searchQuery
                                    ? `Nenhuma submissão encontrada para "${searchQuery}"`
                                    : 'As respostas dos seus alunos aparecerão aqui.'
                                }
                            />
                        ) : (
                            <div className="divide-y divide-k-border-subtle">
                                {filteredSubmissions.map((sub) => {
                                    const student = studentsById.get(sub.student_id)
                                    const template = templatesById.get(sub.form_template_id)
                                    const badge = submissionStatusBadge(sub.status, sub.feedback_sent_at)
                                    const isActive = activeSubmissionId === sub.id

                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveSubmissionId(sub.id)}
                                            className={`grid w-full cursor-pointer grid-cols-[1.5fr_1.2fr_1fr_1fr_24px] items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-glass-bg ${
                                                isActive ? 'bg-violet-500/5' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden">
                                                    {student?.avatar_url ? (
                                                        <Image
                                                            src={student.avatar_url}
                                                            alt={student.name || ''}
                                                            width={32}
                                                            height={32}
                                                            className="h-8 w-8 rounded-full object-cover"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-k-text-secondary">
                                                            {getInitials(student?.name)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`truncate text-sm font-medium ${isActive ? 'text-violet-400' : 'text-k-text-primary'}`}>
                                                    {student?.name || 'Aluno'}
                                                </span>
                                            </div>

                                            <span className="truncate text-sm text-k-text-secondary">
                                                {template?.title || 'Template'}
                                            </span>

                                            <span className="text-xs text-k-text-secondary font-medium">
                                                {formatDateTime(sub.submitted_at || sub.created_at)}
                                            </span>

                                            <div>
                                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${badge.classes}`}>
                                                    {badge.label}
                                                </span>
                                            </div>

                                            <ChevronRight size={14} className="text-k-text-secondary opacity-50" />
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Submission Detail Sheet */}
            <AnimatePresence>
                {activeSubmission && (
                    <SubmissionDetailSheet
                        submission={activeSubmission as any}
                        onClose={() => setActiveSubmissionId(null)}
                        student={studentsById.get(activeSubmission.student_id) as any}
                        template={templatesById.get(activeSubmission.form_template_id) as any}
                        questions={activeSubmissionQuestions || []}
                        answers={activeSubmissionAnswers as any}
                        feedbackMessage={feedbackBySubmissionId[activeSubmission.id] || ''}
                        setFeedbackMessage={(msg) => setFeedbackBySubmissionId((prev) => ({ ...prev, [activeSubmission.id]: msg }))}
                        onSendFeedback={handleSendFeedback}
                        isSendingFeedback={sendingFeedbackId === activeSubmission.id}
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
                isOpen={assignModalOpen}
                onClose={() => {
                    setAssignModalOpen(false)
                    setPreselectedTemplateId(null)
                }}
                templates={templates}
                students={activeStudents}
                preselectedTemplateId={preselectedTemplateId}
            />
        </AppLayout>
    )
}

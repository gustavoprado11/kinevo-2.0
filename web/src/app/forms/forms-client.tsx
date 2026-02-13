'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AppLayout } from '@/components/layout'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { auditFormQualityWithAI } from '@/actions/forms/audit-form-quality-ai'
import { createFormTemplate } from '@/actions/forms/create-form-template'
import { generateFormDraftWithAI } from '@/actions/forms/generate-form-with-ai'
import { sendFormFeedback } from '@/actions/forms/send-form-feedback'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

// New Modular Components
import { FormsLibrary } from '@/components/forms/forms-library'
import { FormsBuilder } from '@/components/forms/forms-builder'
import { FormsCommandCenter } from '@/components/forms/forms-command-center'
import { SubmissionDetailSheet } from '@/components/forms/submission-detail-sheet'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
}

interface FormTemplate {
    id: string
    title: string
    description: string | null
    category: 'anamnese' | 'checkin' | 'survey'
    version: number
    is_active: boolean
    created_source: 'manual' | 'ai_assisted'
    schema_json?: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

interface Student {
    id: string
    name: string
    email: string
    status: 'active' | 'inactive' | 'pending'
}

interface Submission {
    id: string
    form_template_id: string
    student_id: string
    status: 'draft' | 'submitted' | 'reviewed'
    submitted_at: string | null
    feedback_sent_at: string | null
    trainer_feedback: { message?: string } | null
    answers_json: Record<string, unknown> | null
    schema_snapshot_json: {
        questions?: any[]
    } | null
    created_at: string
}

interface FormsClientProps {
    trainer: Trainer
    templates: FormTemplate[]
    students: Student[]
    submissions: Submission[]
}

interface QualityReport {
    missing_areas: string[]
    redundant_questions: string[]
    reading_complexity: 'low' | 'medium' | 'high'
    risk_flags: string[]
}

interface BuilderSchema {
    schema_version: string
    questions: any[]
}

const DEFAULT_SCHEMA = JSON.stringify(
    {
        schema_version: '1.0',
        layout: {
            estimated_minutes: 5,
            progress_mode: 'per_question',
        },
        questions: [
            {
                id: 'q_como_voce_esta',
                type: 'long_text',
                label: 'Como você está se sentindo hoje?',
                required: true,
            },
            {
                id: 'q_nivel_energia',
                type: 'scale',
                label: 'Qual seu nível de energia hoje?',
                required: true,
                scale: { min: 1, max: 5, min_label: 'Muito baixo', max_label: 'Muito alto' },
            },
        ],
    },
    null,
    2
)

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

function safeParseSchema(schemaJson: string): BuilderSchema | null {
    try {
        const parsed = JSON.parse(schemaJson) as BuilderSchema
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questions)) return null
        return parsed
    } catch {
        return null
    }
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

function submissionStatus(submission: Submission) {
    if (submission.status === 'reviewed' || submission.feedback_sent_at) {
        return {
            label: 'Feedback Enviado',
            className: 'bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20',
        }
    }

    if (submission.status === 'submitted' || submission.submitted_at) {
        return {
            label: 'Concluído',
            className: 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20',
        }
    }

    return {
        label: 'Pendente',
        className: 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20',
    }
}


export function FormsClient({ trainer, templates, students, submissions }: FormsClientProps) {
    const router = useRouter()
    const supabase = useMemo(() => createBrowserClient(), [])

    // View State
    const [viewMode, setViewMode] = useState<'library' | 'builder' | 'command_center'>('library')

    // Builder State
    const [templateTitle, setTemplateTitle] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')
    const [templateCategory, setTemplateCategory] = useState<'anamnese' | 'checkin' | 'survey'>('checkin')
    const [schemaJson, setSchemaJson] = useState(DEFAULT_SCHEMA)
    const [creatingTemplate, setCreatingTemplate] = useState(false)
    const [draftSource, setDraftSource] = useState<'manual' | 'ai_assisted'>('manual')

    // AI State
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

    // Command Center State
    const [selectedLibraryTemplateId, setSelectedLibraryTemplateId] = useState<string>(templates[0]?.id || '')
    const [assignmentTemplateId, setAssignmentTemplateId] = useState('')
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
    const [assignmentDueAt, setAssignmentDueAt] = useState('')
    const [assignmentMessage, setAssignmentMessage] = useState('')
    const [assigning, setAssigning] = useState(false)
    const [assignResult, setAssignResult] = useState<string | null>(null)

    // Inbox & Submission State
    const [submissionRows, setSubmissionRows] = useState<Submission[]>(submissions)
    const [unreadInboxCount, setUnreadInboxCount] = useState<number>(0)
    const [submissionSearch, setSubmissionSearch] = useState('')
    const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null)
    const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)

    // Feedback State
    const [sendingFeedbackId, setSendingFeedbackId] = useState<string | null>(null)
    const [feedbackBySubmissionId, setFeedbackBySubmissionId] = useState<Record<string, string>>(() => {
        const seed: Record<string, string> = {}
        for (const submission of submissions) {
            seed[submission.id] = submission.trainer_feedback?.message || ''
        }
        return seed
    })

    // Realtime Updates
    useEffect(() => {
        setSubmissionRows(submissions)
    }, [submissions])

    useEffect(() => {
        if (!selectedLibraryTemplateId && templates.length > 0) {
            setSelectedLibraryTemplateId(templates[0].id)
        }
    }, [selectedLibraryTemplateId, templates])

    useEffect(() => {
        const fetchUnreadCount = async () => {
            const { count, error } = await supabase
                .from('student_inbox_items')
                .select('id', { count: 'exact', head: true })
                .eq('trainer_id', trainer.id)
                .eq('status', 'unread')
            if (!error) setUnreadInboxCount(count || 0)
        }

        const refreshSubmission = async (submissionId: string) => {
            if (!submissionId) return
            const { data, error } = await supabase
                .from('form_submissions')
                .select('id, form_template_id, student_id, status, submitted_at, feedback_sent_at, trainer_feedback, answers_json, schema_snapshot_json, created_at')
                .eq('id', submissionId)
                .single()

            if (error || !data) return

            setSubmissionRows((prev) => {
                const nextRows = prev.filter((row) => row.id !== submissionId)
                return [data as Submission, ...nextRows].slice(0, 100)
            })
        }

        fetchUnreadCount()

        const inboxChannel = supabase
            .channel(`forms-inbox-${trainer.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'student_inbox_items', filter: `trainer_id=eq.${trainer.id}` },
                () => fetchUnreadCount()
            )
            .subscribe()

        const submissionChannel = supabase
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
            supabase.removeChannel(inboxChannel)
            supabase.removeChannel(submissionChannel)
        }
    }, [supabase, trainer.id])

    // Derived State
    const activeStudents = useMemo(
        () => students.filter((student) => student.status === 'active' || student.status === 'pending'),
        [students]
    )

    const templatesById = useMemo(() => {
        const map = new Map<string, FormTemplate>()
        for (const template of templates) map.set(template.id, template)
        return map
    }, [templates])

    const studentsById = useMemo(() => {
        const map = new Map<string, Student>()
        for (const student of students) map.set(student.id, student)
        return map
    }, [students])

    const parsedBuilderSchema = useMemo(() => safeParseSchema(schemaJson), [schemaJson])

    const filteredSubmissions = useMemo(() => {
        const search = submissionSearch.trim().toLowerCase()
        if (!search) return submissionRows

        return submissionRows.filter((submission) => {
            const template = templatesById.get(submission.form_template_id)
            const student = studentsById.get(submission.student_id)
            return (
                template?.title?.toLowerCase().includes(search) ||
                student?.name?.toLowerCase().includes(search) ||
                student?.email?.toLowerCase().includes(search)
            )
        })
    }, [submissionRows, submissionSearch, studentsById, templatesById])

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
    const handleCreateNewTemplate = () => {
        setTemplateTitle('')
        setTemplateDescription('')
        setTemplateCategory('checkin')
        setSchemaJson(DEFAULT_SCHEMA)
        setDraftSource('manual')
        setViewMode('builder')
    }

    const handleEditTemplate = (template: FormTemplate) => {
        setTemplateTitle(template.title)
        setTemplateDescription(template.description || '')
        setTemplateCategory(template.category)
        if (template.schema_json && typeof template.schema_json === 'object') {
            setSchemaJson(JSON.stringify(template.schema_json, null, 2))
        }
        setDraftSource('manual')
        setAiProviderSource(null)
        setAiModelUsed(null)
        setAiRuntimeNote('Template carregado da biblioteca.')
        setViewMode('builder')
    }

    const handleAssignTemplateFromLibrary = (template: FormTemplate) => {
        setAssignmentTemplateId(template.id)
        setViewMode('command_center')
    }

    const handleSaveTemplate = async () => {
        setCreatingTemplate(true)
        setAssignResult(null)

        try {
            const result = await createFormTemplate({
                title: templateTitle,
                description: templateDescription,
                category: templateCategory,
                schemaJson,
                createdSource: draftSource,
            })

            if (!result.success) {
                alert(result.error || 'Erro ao criar template')
                return
            }

            // Reset and go back to library
            setTemplateTitle('')
            setTemplateDescription('')
            setSchemaJson(DEFAULT_SCHEMA)
            setDraftSource('manual')
            router.refresh()
            setViewMode('library')
        } finally {
            setCreatingTemplate(false)
        }
    }

    const handleGenerateWithAI = async () => {
        setIsGeneratingAI(true)
        try {
            const result = await generateFormDraftWithAI({
                category: templateCategory,
                goal: aiGoal,
                studentContext: aiStudentContext,
                maxMinutes: aiMaxMinutes,
            })

            if (!result.success || !result.templateDraft) {
                alert(result.error || 'Erro ao gerar draft com IA.')
                return
            }

            setTemplateTitle(result.templateDraft.title)
            setTemplateDescription(result.templateDraft.description)
            setTemplateCategory(result.templateDraft.category)
            setSchemaJson(JSON.stringify(result.templateDraft.schema, null, 2))
            setDraftSource('ai_assisted')
            setAiProviderSource(result.source === 'llm' ? 'llm' : 'heuristic')
            setAiModelUsed(result.llmModel || null)
            setAiRuntimeNote(result.runtimeNote || null)
            setAiQualityReport(result.qualityReport || null)
            setAiChecklist(result.reviewChecklist || [])
        } finally {
            setIsGeneratingAI(false)
        }
    }

    const handleAuditWithAI = async () => {
        setIsAuditingAI(true)
        try {
            const result = await auditFormQualityWithAI({ schemaJson })
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

    const handleAssign = async () => {
        setAssigning(true)
        setAssignResult(null)
        try {
            const result = await assignFormToStudents({
                formTemplateId: assignmentTemplateId,
                studentIds: selectedStudentIds,
                dueAt: assignmentDueAt || null,
                message: assignmentMessage,
            })

            if (!result.success) {
                alert(result.error || 'Erro ao enviar.')
                return
            }

            setAssignResult(`Enviado para ${result.assignedCount} alunos.`)
            setSelectedStudentIds([])
            setAssignmentMessage('')
            setAssignmentDueAt('')
            router.refresh()
        } finally {
            setAssigning(false)
        }
    }

    const handleSendFeedback = async () => {
        if (!activeSubmissionId) return
        const message = (feedbackBySubmissionId[activeSubmissionId] || '').trim()
        if (!message) {
            alert('Digite um feedback.')
            return
        }

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

    const toggleStudent = (studentId: string) => {
        setSelectedStudentIds((prev) =>
            prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
        )
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
        >
            <div className="space-y-6">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-k-text-primary tracking-tight">Avaliações & Inbox</h1>
                        <p className="mt-1 text-k-text-secondary">
                            Gerencie formulários, check-ins e feedbacks dos alunos.
                        </p>
                    </div>

                    <div className="flex items-center p-1 rounded-xl bg-surface-elevated border border-k-border-subtle h-12">
                        <button
                            onClick={() => setViewMode('library')}
                            className={`relative px-5 h-full flex items-center justify-center text-sm font-semibold transition-all rounded-lg ${viewMode === 'library'
                                ? 'bg-surface-card text-k-text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                : 'text-k-text-secondary hover:text-k-text-primary'
                                }`}
                        >
                            Library
                            {viewMode === 'library' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 rounded-lg bg-surface-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setViewMode('builder')}
                            className={`relative px-5 h-full flex items-center justify-center text-sm font-semibold transition-all rounded-lg ${viewMode === 'builder'
                                ? 'bg-surface-card text-k-text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                : 'text-k-text-secondary hover:text-k-text-primary'
                                }`}
                        >
                            Builder
                            {viewMode === 'builder' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 rounded-lg bg-surface-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setViewMode('command_center')}
                            className={`relative px-5 h-full flex items-center justify-center gap-2 text-sm font-semibold transition-all rounded-lg ${viewMode === 'command_center'
                                ? 'bg-surface-card text-k-text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                : 'text-k-text-secondary hover:text-k-text-primary'
                                }`}
                        >
                            Command Center
                            {unreadInboxCount > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] text-white">
                                    {unreadInboxCount}
                                </span>
                            )}
                            {viewMode === 'command_center' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 rounded-lg bg-surface-card shadow-sm ring-1 ring-black/5 dark:ring-white/5 -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {viewMode === 'library' && (
                        <motion.div
                            key="library"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <FormsLibrary
                                templates={templates}
                                selectedTemplateId={selectedLibraryTemplateId}
                                onSelectTemplate={setSelectedLibraryTemplateId}
                                onEditTemplate={handleEditTemplate}
                                onAssignTemplate={handleAssignTemplateFromLibrary}
                                onCreateNew={handleCreateNewTemplate}
                            />
                        </motion.div>
                    )}

                    {viewMode === 'builder' && (
                        <motion.div
                            key="builder"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <FormsBuilder
                                templateTitle={templateTitle}
                                setTemplateTitle={setTemplateTitle}
                                templateDescription={templateDescription}
                                setTemplateDescription={setTemplateDescription}
                                templateCategory={templateCategory}
                                setTemplateCategory={setTemplateCategory}
                                schemaJson={schemaJson}
                                setSchemaJson={setSchemaJson}
                                onSave={handleSaveTemplate}
                                isSaving={creatingTemplate}
                                draftSource={draftSource}
                                aiGoal={aiGoal}
                                setAiGoal={setAiGoal}
                                aiStudentContext={aiStudentContext}
                                setAiStudentContext={setAiStudentContext}
                                aiMaxMinutes={aiMaxMinutes}
                                setAiMaxMinutes={setAiMaxMinutes}
                                onGenerateAI={handleGenerateWithAI}
                                isGeneratingAI={isGeneratingAI}
                                onAuditAI={handleAuditWithAI}
                                isAuditingAI={isAuditingAI}
                                aiProviderSource={aiProviderSource}
                                aiModelUsed={aiModelUsed}
                                aiRuntimeNote={aiRuntimeNote}
                                aiQualityReport={aiQualityReport}
                                aiChecklist={aiChecklist}
                                parsedSchema={parsedBuilderSchema}
                            />
                        </motion.div>
                    )}

                    {viewMode === 'command_center' && (
                        <motion.div
                            key="command_center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <FormsCommandCenter
                                templates={templates}
                                activeStudents={activeStudents}
                                submissions={filteredSubmissions}
                                assignmentTemplateId={assignmentTemplateId}
                                setAssignmentTemplateId={setAssignmentTemplateId}
                                assignmentDueAt={assignmentDueAt}
                                setAssignmentDueAt={setAssignmentDueAt}
                                assignmentMessage={assignmentMessage}
                                setAssignmentMessage={setAssignmentMessage}
                                selectedStudentIds={selectedStudentIds}
                                toggleStudent={toggleStudent}
                                onAssign={handleAssign}
                                isAssigning={assigning}
                                assignResult={assignResult}
                                submissionSearch={submissionSearch}
                                setSubmissionSearch={setSubmissionSearch}
                                activeSubmissionId={activeSubmissionId}
                                onSelectSubmission={setActiveSubmissionId}
                                getStudent={(id) => studentsById.get(id)}
                                getTemplate={(id) => templatesById.get(id)}
                                formatDateTime={formatDateTime}
                                getInitials={getInitials}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <SubmissionDetailSheet
                submission={activeSubmission}
                onClose={() => setActiveSubmissionId(null)}
                student={activeSubmission ? studentsById.get(activeSubmission.student_id) : undefined}
                template={activeSubmission ? templatesById.get(activeSubmission.form_template_id) : undefined}
                questions={activeSubmissionQuestions}
                answers={activeSubmissionAnswers}
                feedbackMessage={activeSubmission ? feedbackBySubmissionId[activeSubmission.id] || '' : ''}
                setFeedbackMessage={(msg) => activeSubmission && setFeedbackBySubmissionId(prev => ({ ...prev, [activeSubmission.id]: msg }))}
                onSendFeedback={handleSendFeedback}
                isSendingFeedback={activeSubmissionId === sendingFeedbackId}
                formatDateTime={formatDateTime}
                submissionStatus={submissionStatus}
                resolveImageUrl={resolveImageUrl}
                setZoomImageUrl={setZoomImageUrl}
            />

            <AnimatePresence>
                {zoomImageUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setZoomImageUrl(null)}
                    >
                        <img
                            src={zoomImageUrl}
                            alt="Expanded"
                            className="max-h-[90vh] max-w-full rounded-lg object-contain"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </AppLayout>
    )
}

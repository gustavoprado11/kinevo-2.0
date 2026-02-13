import { motion } from 'framer-motion'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Student {
    id: string
    name: string
}

interface FormTemplate {
    id: string
    title: string
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

interface SubmissionDetailSheetProps {
    submission: Submission | null
    onClose: () => void
    student: Student | undefined
    template: FormTemplate | undefined
    questions: any[]
    answers: Record<string, any>
    feedbackMessage: string
    setFeedbackMessage: (msg: string) => void
    onSendFeedback: () => void
    isSendingFeedback: boolean
    formatDateTime: (date: string | null) => string
    submissionStatus: (sub: Submission) => { label: string; className: string }
    resolveImageUrl: (value: any) => string | null
    setZoomImageUrl: (url: string | null) => void
}

export function SubmissionDetailSheet({
    submission,
    onClose,
    student,
    template,
    questions,
    answers,
    feedbackMessage,
    setFeedbackMessage,
    onSendFeedback,
    isSendingFeedback,
    formatDateTime,
    submissionStatus,
    resolveImageUrl,
    setZoomImageUrl,
}: SubmissionDetailSheetProps) {
    if (!submission) return null

    const status = submissionStatus(submission)

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-k-border-subtle bg-surface-card shadow-2xl"
            >
                <header className="flex items-center justify-between border-b border-k-border-subtle bg-surface-elevated/50 px-6 py-4 backdrop-blur-md">
                    <div>
                        <h3 className="text-lg font-bold text-k-text-primary">Submission Detail</h3>
                        <p className="text-sm text-k-text-secondary">
                            {student?.name || 'Unknown Student'} · {template?.title || 'Template Deleted'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-surface-inset p-2 text-k-text-secondary transition hover:bg-k-border-subtle hover:text-k-text-primary"
                    >
                        <X size={20} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="mb-6 flex items-center justify-between rounded-xl bg-surface-elevated p-4">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-k-text-secondary">Enviado em</p>
                            <p className="font-medium text-k-text-primary">
                                {formatDateTime(submission.submitted_at || submission.created_at)}
                            </p>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                            {status.label}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {questions.length === 0 && Object.keys(answers).length === 0 ? (
                            <div className="rounded-xl border border-dashed border-k-border-subtle p-8 text-center text-sm text-k-text-secondary">
                                Nenhuma resposta disponível.
                            </div>
                        ) : (
                            questions.map((question) => {
                                const value = answers[question.id]
                                const imageUrl = resolveImageUrl(value)

                                return (
                                    <div key={question.id} className="space-y-2">
                                        <p className="text-sm font-medium text-k-text-secondary">{question.label}</p>
                                        <div className="rounded-xl bg-surface-inset p-4 text-sm text-k-text-primary">
                                            {imageUrl ? (
                                                <div className="group relative overflow-hidden rounded-lg">
                                                    <img
                                                        src={imageUrl}
                                                        alt="Resposta visual"
                                                        className="max-h-64 w-full object-cover transition duration-300 group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setZoomImageUrl(imageUrl)}
                                                            className="text-xs"
                                                        >
                                                            Ampliar Imagem
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : typeof value === 'string' ? (
                                                <p className="whitespace-pre-wrap leading-relaxed">{value || '—'}</p>
                                            ) : typeof value === 'object' && value ? (
                                                <pre className="overflow-x-auto text-xs text-k-text-secondary">
                                                    {JSON.stringify(value, null, 2)}
                                                </pre>
                                            ) : (
                                                String(value ?? '—')
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                <footer className="border-t border-k-border-subtle bg-surface-card px-6 py-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-k-text-secondary">
                        Feedback para o Aluno
                    </p>
                    <div className="relative">
                        <textarea
                            value={feedbackMessage}
                            onChange={(e) => setFeedbackMessage(e.target.value)}
                            placeholder="Escreva orientações, correções ou parabéns..."
                            className="min-h-[120px] w-full rounded-xl border border-k-border-subtle bg-surface-elevated p-4 text-sm text-k-text-primary outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                        />
                        <div className="absolute bottom-3 right-3">
                            <Button
                                onClick={onSendFeedback}
                                disabled={isSendingFeedback || !feedbackMessage.trim()}
                                className="bg-violet-600 text-white hover:bg-violet-700"
                                size="sm"
                            >
                                {isSendingFeedback ? 'Enviando...' : 'Enviar Feedback'}
                                <Send size={14} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                </footer>
            </motion.aside>
        </>
    )
}

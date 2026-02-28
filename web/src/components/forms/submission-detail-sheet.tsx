import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, X, FileText, CheckCircle2, BarChart3, Image as ImageIcon, Type, MessageSquare, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface Student {
    id: string
    name: string
    avatar_url?: string | null
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

// ─── Helpers ──────────────────────────────────────────────────

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

/** Extract the actual display value from an answer (which may be wrapped in { type, value }) */
function unwrapAnswerValue(raw: any): any {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
        return raw.value
    }
    return raw
}

/** Get the answer type from wrapped answers or from schema question */
function resolveAnswerType(raw: any, question: any): string {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'type' in raw) {
        return raw.type as string
    }
    return question?.type || 'short_text'
}

/** Find the display label for a single_choice value */
function resolveOptionLabel(value: string, question: any): string {
    const options = question?.options as { value: string; label: string }[] | undefined
    if (!options) return value
    const match = options.find((o) => o.value === value)
    return match?.label || value
}

/** Get icon for question type */
function getTypeIcon(type: string) {
    switch (type) {
        case 'long_text': return FileText
        case 'short_text': return Type
        case 'single_choice': return CheckCircle2
        case 'scale': return BarChart3
        case 'photo': return ImageIcon
        default: return FileText
    }
}

/** Get type label in Portuguese */
function getTypeLabel(type: string) {
    switch (type) {
        case 'long_text': return 'Texto'
        case 'short_text': return 'Texto'
        case 'single_choice': return 'Escolha'
        case 'scale': return 'Escala'
        case 'photo': return 'Foto'
        default: return 'Resposta'
    }
}

/** Generate quick summary from first few answers */
function generateQuickSummary(questions: any[], answers: Record<string, any>): { label: string; value: string }[] {
    return questions
        .filter(q => answers[q.id] != null && answers[q.id] !== '')
        .slice(0, 4)
        .map(q => {
            const raw = answers[q.id]
            const value = unwrapAnswerValue(raw)
            const type = resolveAnswerType(raw, q)
            const label = (q.label || q.title || '')
                .replace(/^(Qual |Como |Você |Quantas |Quantos |Tem |Possui )/i, '')
                .split('?')[0]
                .trim()
                .substring(0, 25)

            let displayValue: string
            if (type === 'scale') {
                const numVal = typeof value === 'number' ? value : parseInt(String(value), 10)
                const max = q?.scale?.max ?? 10
                displayValue = isNaN(numVal) ? '-' : `${numVal}/${max}`
            } else if (type === 'single_choice') {
                displayValue = resolveOptionLabel(String(value), q)
            } else if (type === 'photo') {
                displayValue = 'Foto enviada'
            } else {
                displayValue = String(value).substring(0, 40)
                if (String(value).length > 40) displayValue += '...'
            }

            return { label, value: displayValue }
        })
}

// ─── Answer Renderers ──────────────────────────────────────────

function AnswerRenderer({
    question,
    rawValue,
    resolveImageUrl,
    setZoomImageUrl,
}: {
    question: any
    rawValue: any
    resolveImageUrl: (value: any) => string | null
    setZoomImageUrl: (url: string | null) => void
}) {
    const type = resolveAnswerType(rawValue, question)
    const value = unwrapAnswerValue(rawValue)
    const imageUrl = resolveImageUrl(rawValue) || resolveImageUrl(value)

    // Photo / Image answer
    if (imageUrl || type === 'photo') {
        if (imageUrl) {
            return (
                <div className="group relative overflow-hidden rounded-xl">
                    <img
                        src={imageUrl}
                        alt="Resposta visual"
                        className="max-h-64 w-full object-cover rounded-xl transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100 rounded-xl">
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
            )
        }
        return <p className="text-k-text-tertiary italic">Nenhuma foto enviada</p>
    }

    // Scale answer
    if (type === 'scale') {
        const numValue = typeof value === 'number' ? value : parseInt(String(value), 10)
        const min = question?.scale?.min ?? 1
        const max = question?.scale?.max ?? 10
        const minLabel = question?.scale?.min_label
        const maxLabel = question?.scale?.max_label

        if (isNaN(numValue)) {
            return <p className="text-k-text-tertiary italic">Sem resposta</p>
        }

        const range = Array.from({ length: max - min + 1 }, (_, i) => min + i)

        return (
            <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {range.map((n) => (
                        <div
                            key={n}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                                n === numValue
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 ring-2 ring-violet-400/30 scale-110'
                                    : 'bg-surface-elevated text-k-text-quaternary'
                            }`}
                        >
                            {n}
                        </div>
                    ))}
                </div>
                {(minLabel || maxLabel) && (
                    <div className="flex items-center justify-between">
                        {minLabel && <span className="text-[10px] text-k-text-quaternary">{minLabel}</span>}
                        {maxLabel && <span className="text-[10px] text-k-text-quaternary">{maxLabel}</span>}
                    </div>
                )}
            </div>
        )
    }

    // Single choice answer
    if (type === 'single_choice') {
        const displayValue = typeof value === 'string' ? value : String(value ?? '')
        const options = question?.options as { value: string; label: string }[] | undefined

        if (!displayValue) {
            return <p className="text-k-text-tertiary italic">Sem resposta</p>
        }

        if (options && options.length > 0) {
            return (
                <div className="space-y-1.5">
                    {options.map((opt) => {
                        const isSelected = opt.value === displayValue || opt.label === displayValue
                        return (
                            <div
                                key={opt.value}
                                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all ${
                                    isSelected
                                        ? 'bg-violet-500/10 border border-violet-500/30'
                                        : 'bg-surface-elevated/30 border border-transparent opacity-50'
                                }`}
                            >
                                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0 ${
                                    isSelected
                                        ? 'border-violet-500 bg-violet-500'
                                        : 'border-k-border-subtle'
                                }`}>
                                    {isSelected && (
                                        <div className="h-2 w-2 rounded-full bg-white" />
                                    )}
                                </div>
                                <span className={`text-sm ${
                                    isSelected ? 'text-k-text-primary font-medium' : 'text-k-text-tertiary'
                                }`}>
                                    {opt.label || opt.value}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )
        }

        // Fallback: no options metadata available
        const label = resolveOptionLabel(displayValue, question)
        return (
            <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-violet-400 shrink-0" />
                <span className="text-sm text-k-text-primary font-medium">{label}</span>
            </div>
        )
    }

    // Text answers (short_text, long_text, or unknown)
    const textValue = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : String(value ?? '')

    if (!textValue.trim()) {
        return <p className="text-k-text-tertiary italic">Sem resposta</p>
    }

    return (
        <p className="whitespace-pre-wrap leading-relaxed text-sm text-k-text-primary">{textValue}</p>
    )
}

// ─── Main Component ──────────────────────────────────────────

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
    const [editingFeedback, setEditingFeedback] = useState(false)

    if (!submission) return null

    const feedbackAlreadySent = !!(submission.feedback_sent_at || submission.status === 'reviewed')
    const existingFeedback = submission.trainer_feedback?.message || ''
    const quickSummary = generateQuickSummary(questions, answers)

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
                {/* Header — simplified with avatar */}
                <header className="flex items-center justify-between border-b border-k-border-subtle px-6 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-k-border-primary bg-glass-bg overflow-hidden shrink-0">
                            {student?.avatar_url ? (
                                <Image src={student.avatar_url} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                            ) : (
                                <span className="text-xs font-semibold text-k-text-primary">
                                    {(student?.name || '?').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-k-text-primary truncate">
                                {student?.name || 'Aluno'}
                            </p>
                            <p className="text-xs text-k-text-quaternary truncate">
                                {cleanTemplateName(template?.title || 'Template')} · {timeAgo(submission.submitted_at || submission.created_at)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {feedbackAlreadySent && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Feedback enviado
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="rounded-full bg-surface-inset p-2 text-k-text-secondary transition hover:bg-k-border-subtle hover:text-k-text-primary"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {/* Quick summary */}
                    {quickSummary.length > 0 && (
                        <div className="mb-6 px-4 py-3 bg-surface-elevated/50 rounded-xl border border-k-border-subtle">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                {quickSummary.map(({ label, value }) => (
                                    <span key={label} className="text-k-text-tertiary">
                                        <span className="text-k-text-quaternary">{label}:</span>{' '}
                                        <span className="text-k-text-secondary">{value}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Answers */}
                    <div className="space-y-5">
                        {questions.length === 0 && Object.keys(answers).length === 0 ? (
                            <div className="rounded-xl border border-dashed border-k-border-subtle p-8 text-center text-sm text-k-text-secondary">
                                Nenhuma resposta disponível.
                            </div>
                        ) : (
                            questions.map((question, index) => {
                                const rawValue = answers[question.id]
                                const type = resolveAnswerType(rawValue, question)
                                const TypeIcon = getTypeIcon(type)

                                return (
                                    <div key={question.id} className="rounded-2xl border border-k-border-subtle bg-surface-elevated/30 overflow-hidden">
                                        {/* Question header */}
                                        <div className="px-5 pt-4 pb-3 flex items-start gap-3">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
                                                <TypeIcon size={14} className="text-violet-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-k-text-primary leading-snug">
                                                    {question.label}
                                                </p>
                                                <p className="text-[10px] text-k-text-quaternary uppercase tracking-wider mt-0.5 font-bold">
                                                    Pergunta {index + 1} &middot; {getTypeLabel(type)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Answer */}
                                        <div className="px-5 pb-4 pl-[3.75rem]">
                                            <AnswerRenderer
                                                question={question}
                                                rawValue={rawValue}
                                                resolveImageUrl={resolveImageUrl}
                                                setZoomImageUrl={setZoomImageUrl}
                                            />
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Feedback Footer — two states */}
                <footer className="border-t border-k-border-subtle bg-surface-card px-6 py-4">
                    {feedbackAlreadySent && !editingFeedback ? (
                        /* READ-ONLY state */
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare size={14} className="text-emerald-400" />
                                <span className="text-xs text-k-text-quaternary">
                                    Seu feedback · {submission.feedback_sent_at ? timeAgo(submission.feedback_sent_at) : ''}
                                </span>
                            </div>
                            <div className="bg-surface-elevated/50 rounded-xl p-3 text-sm text-k-text-secondary border-l-2 border-emerald-500/40 italic">
                                {existingFeedback}
                            </div>
                            <button
                                onClick={() => setEditingFeedback(true)}
                                className="flex items-center gap-1.5 text-xs text-k-text-quaternary hover:text-k-text-secondary mt-2 transition"
                            >
                                <Pencil size={12} />
                                Editar feedback
                            </button>
                        </div>
                    ) : (
                        /* EDITABLE state */
                        <div>
                            <p className="mb-2 text-xs font-medium text-k-text-tertiary">
                                Feedback para o aluno
                            </p>
                            <div className="relative">
                                <textarea
                                    value={feedbackMessage}
                                    onChange={(e) => setFeedbackMessage(e.target.value)}
                                    placeholder="Escreva orientações, correções ou parabéns..."
                                    className="min-h-[100px] w-full rounded-xl border border-k-border-subtle bg-surface-elevated p-4 pr-36 text-sm text-k-text-primary outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 resize-none transition-all"
                                />
                                <div className="absolute bottom-3 right-3">
                                    <Button
                                        onClick={onSendFeedback}
                                        disabled={isSendingFeedback || !feedbackMessage.trim()}
                                        className="bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-600/20"
                                        size="sm"
                                    >
                                        {isSendingFeedback ? 'Enviando...' : 'Enviar Feedback'}
                                        <Send size={14} className="ml-2" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[10px] text-k-text-quaternary">
                                    O aluno receberá este feedback no app
                                </span>
                                {editingFeedback && (
                                    <button
                                        onClick={() => setEditingFeedback(false)}
                                        className="text-[10px] text-k-text-quaternary hover:text-k-text-secondary transition"
                                    >
                                        Cancelar edição
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </footer>
            </motion.aside>
        </>
    )
}

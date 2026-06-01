'use client'

import { useState } from 'react'
import { X, ClipboardCheck, BarChart3, CheckCircle2, Type, MessageSquare, Pencil, Send, Loader2 } from 'lucide-react'

interface CheckinResponsesViewerProps {
    title: string // "Check-in Pré-treino" / "Check-in Pós-treino"
    date: string
    answers: Record<string, any> // answers_json from submission
    schema: { questions?: any[] } | null // schema_snapshot_json
    onClose: () => void
    workoutName?: string // nome do treino vinculado (ex: "Treino A")
    /**
     * Quando fornecido, exibe um footer pra o treinador enviar/editar feedback
     * da avaliação sem sair do modal. Opcional: usos que só visualizam (ex.
     * check-ins na session-detail-sheet) não passam e o footer não aparece.
     */
    feedback?: {
        initialMessage: string
        sentAt: string | null
        onSend: (message: string) => Promise<{ success: boolean; error?: string }>
    }
}

// ── Helpers (same logic as submission-detail-sheet) ──

function unwrapAnswerValue(raw: any): any {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
        return raw.value
    }
    return raw
}

function resolveAnswerType(raw: any, question: any): string {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'type' in raw) {
        return raw.type as string
    }
    return question?.type || 'short_text'
}

function resolveOptionLabel(value: string, question: any): string {
    const options = question?.options as { value: string; label: string }[] | undefined
    if (!options) return value
    const match = options.find((o) => o.value === value)
    return match?.label || value
}

// ── Answer Renderers (compact, read-only) ──

function CompactAnswer({ question, rawValue }: { question: any; rawValue: any }) {
    const type = resolveAnswerType(rawValue, question)
    const value = unwrapAnswerValue(rawValue)

    if (value == null || value === '') {
        return <p className="text-xs text-muted-foreground italic">Sem resposta</p>
    }

    if (type === 'scale') {
        const numValue = typeof value === 'number' ? value : parseInt(String(value), 10)
        const min = question?.scale?.min ?? 1
        const max = question?.scale?.max ?? 10
        if (isNaN(numValue)) return <p className="text-xs text-muted-foreground italic">-</p>

        const percentage = ((numValue - min) / (max - min)) * 100

        return (
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{numValue}</span>
                    <span className="text-xs text-muted-foreground">/ {max}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-violet-500 transition-all"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {(question?.scale?.min_label || question?.scale?.max_label) && (
                    <div className="flex justify-between">
                        <span className="text-[10px] text-muted-foreground">{question.scale.min_label || ''}</span>
                        <span className="text-[10px] text-muted-foreground">{question.scale.max_label || ''}</span>
                    </div>
                )}
            </div>
        )
    }

    if (type === 'single_choice') {
        const displayValue = typeof value === 'string' ? value : String(value)
        const label = resolveOptionLabel(displayValue, question)
        return (
            <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-violet-500 shrink-0" />
                <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
        )
    }

    if (type === 'multi_choice') {
        const selected = Array.isArray(value) ? value : [value]
        return (
            <div className="flex flex-wrap gap-1">
                {selected.map((v: any, i: number) => {
                    const label = resolveOptionLabel(String(v), question)
                    return (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-medium">
                            {label}
                        </span>
                    )
                })}
            </div>
        )
    }

    // Text (short_text, long_text)
    return (
        <p className="text-sm text-foreground whitespace-pre-wrap">{String(value)}</p>
    )
}

// ── Main Component ──

export function CheckinResponsesViewer({ title, date, answers, schema, onClose, workoutName, feedback }: CheckinResponsesViewerProps) {
    const questions = schema?.questions || []
    const answersMap = answers?.answers || answers || {}

    // Feedback do treinador (estado local; só relevante quando `feedback` é passado).
    const [feedbackMessage, setFeedbackMessage] = useState(feedback?.initialMessage || '')
    const [sentAt, setSentAt] = useState<string | null>(feedback?.sentAt ?? null)
    const [editing, setEditing] = useState(false)
    const [sending, setSending] = useState(false)

    const handleSendFeedback = async () => {
        if (!feedback) return
        const msg = feedbackMessage.trim()
        if (!msg || sending) return
        setSending(true)
        try {
            const result = await feedback.onSend(msg)
            if (result.success) {
                setSentAt(new Date().toISOString())
                setEditing(false)
            } else {
                alert(result.error || 'Erro ao enviar feedback.')
            }
        } catch {
            alert('Erro ao enviar feedback.')
        } finally {
            setSending(false)
        }
    }

    // If no schema, render raw answers
    const renderableQuestions = questions.length > 0
        ? questions.filter(q => answersMap[q.id] != null)
        : Object.entries(answersMap).map(([id, val]) => ({
            id,
            label: id,
            type: typeof val === 'object' && val && 'type' in val ? (val as any).type : 'short_text',
        }))

    return (
        <div className="fixed inset-0 z-topmost flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-white dark:bg-surface-card rounded-2xl shadow-2xl border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            title.includes('Pré') ? 'bg-violet-500/10' : 'bg-emerald-500/10'
                        }`}>
                            <ClipboardCheck size={16} className={
                                title.includes('Pré') ? 'text-violet-500' : 'text-emerald-500'
                            } />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">{title}</h3>
                            <p className="text-[11px] text-muted-foreground">
                                {workoutName && <span className="font-semibold text-foreground/70">{workoutName} — </span>}
                                {new Date(date).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Answers */}
                <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
                    {renderableQuestions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta registrada</p>
                    ) : (
                        renderableQuestions.map((q: any) => (
                            <div key={q.id} className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">
                                    {q.label || q.title || q.id}
                                </p>
                                <CompactAnswer question={q} rawValue={answersMap[q.id]} />
                            </div>
                        ))
                    )}
                </div>

                {/* Feedback footer — só quando habilitado via prop */}
                {feedback && (
                    <div className="border-t border-border px-5 py-4">
                        {sentAt && !editing ? (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare size={13} className="text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-[11px] text-muted-foreground">Seu feedback enviado</span>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3 text-sm text-foreground border-l-2 border-emerald-500/40 italic whitespace-pre-wrap">
                                    {feedbackMessage || feedback.initialMessage}
                                </div>
                                <button
                                    onClick={() => setEditing(true)}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                                >
                                    <Pencil size={12} />
                                    Editar feedback
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Feedback para o aluno</p>
                                <textarea
                                    value={feedbackMessage}
                                    onChange={(e) => setFeedbackMessage(e.target.value)}
                                    placeholder="Escreva orientações, correções ou parabéns..."
                                    className="min-h-[80px] w-full rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 resize-none transition-all"
                                />
                                <div className="flex items-center justify-between mt-2 gap-2">
                                    <span className="text-[10px] text-muted-foreground">O aluno receberá no app</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {editing && (
                                            <button
                                                onClick={() => { setEditing(false); setFeedbackMessage(feedback.initialMessage) }}
                                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            onClick={handleSendFeedback}
                                            disabled={sending || !feedbackMessage.trim()}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                        >
                                            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                            {sending ? 'Enviando…' : 'Enviar feedback'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Inline Badge (for session cards) ──

export function CheckinBadge({
    type,
    onClick,
}: {
    type: 'pre' | 'post'
    onClick?: () => void
}) {
    const isPre = type === 'pre'

    return (
        <button
            onClick={onClick}
            title={isPre ? 'Check-in pré-treino respondido' : 'Check-in pós-treino respondido'}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                isPre
                    ? 'bg-violet-500/10 text-violet-500 hover:bg-violet-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
            }`}
        >
            <ClipboardCheck size={10} />
            {isPre ? 'Pré' : 'Pós'}
        </button>
    )
}

// ── Inline Compact Answer (single line) ──

function InlineCompactAnswer({ question, rawValue }: { question: any; rawValue: any }) {
    const type = resolveAnswerType(rawValue, question)
    const value = unwrapAnswerValue(rawValue)

    if (value == null || value === '') {
        return <span className="text-xs text-muted-foreground italic">—</span>
    }

    if (type === 'scale') {
        const numValue = typeof value === 'number' ? value : parseInt(String(value), 10)
        const min = question?.scale?.min ?? 1
        const max = question?.scale?.max ?? 10
        if (isNaN(numValue)) return <span className="text-xs text-muted-foreground">—</span>
        const percentage = ((numValue - min) / (max - min)) * 100

        return (
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden max-w-[80px]">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${percentage}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground shrink-0">{numValue}/{max}</span>
            </div>
        )
    }

    if (type === 'single_choice') {
        const label = resolveOptionLabel(String(value), question)
        return <span className="text-xs font-medium text-foreground">{label}</span>
    }

    if (type === 'multi_choice') {
        const selected = Array.isArray(value) ? value : [value]
        const labels = selected.map((v: any) => resolveOptionLabel(String(v), question))
        return <span className="text-xs font-medium text-foreground truncate">{labels.join(', ')}</span>
    }

    const text = String(value)
    return <span className="text-xs font-medium text-foreground truncate">{text.length > 50 ? text.slice(0, 50) + '...' : text}</span>
}

// ── Inline Checkin Summary (compact, for session detail) ──

export interface InlineCheckinData {
    answersJson: Record<string, any>
    schemaJson: { questions?: any[] } | null
    submittedAt?: string
    formTitle?: string
}

export function InlineCheckinSummary({
    type,
    data,
    onViewFull,
}: {
    type: 'pre' | 'post'
    data: InlineCheckinData
    onViewFull: () => void
}) {
    const isPre = type === 'pre'
    const questions = data.schemaJson?.questions || []
    const answersMap = data.answersJson?.answers || data.answersJson || {}
    const MAX_VISIBLE = 3

    const renderableQuestions = questions.length > 0
        ? questions.filter(q => answersMap[q.id] != null)
        : Object.entries(answersMap).map(([id, val]) => ({
            id,
            label: id,
            type: typeof val === 'object' && val && 'type' in val ? (val as any).type : 'short_text',
        }))

    const visibleQuestions = renderableQuestions.slice(0, MAX_VISIBLE)
    const remainingCount = renderableQuestions.length - MAX_VISIBLE

    return (
        <div className={`rounded-xl p-3 border ${isPre ? 'bg-violet-500/5 dark:bg-violet-500/5 border-violet-500/10' : 'bg-emerald-500/5 dark:bg-emerald-500/5 border-emerald-500/10'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <ClipboardCheck size={13} className={isPre ? 'text-violet-500' : 'text-emerald-500'} />
                    <span className={`text-xs font-bold ${isPre ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        Check-in {isPre ? 'Pré-treino' : 'Pós-treino'}
                    </span>
                </div>
                <button
                    onClick={onViewFull}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                    Ver tudo
                </button>
            </div>

            {/* Compact answers */}
            {visibleQuestions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma resposta</p>
            ) : (
                <div className="space-y-1.5">
                    {visibleQuestions.map((q: any) => (
                        <div key={q.id} className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] text-muted-foreground shrink-0 max-w-[40%] truncate">
                                {q.label || q.title || q.id}:
                            </span>
                            <InlineCompactAnswer question={q} rawValue={answersMap[q.id]} />
                        </div>
                    ))}
                    {remainingCount > 0 && (
                        <button
                            onClick={onViewFull}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            e mais {remainingCount} {remainingCount === 1 ? 'resposta' : 'respostas'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

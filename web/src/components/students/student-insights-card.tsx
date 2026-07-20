'use client'

import { useState, useCallback, useRef } from 'react'
import { X, ChevronRight, Pin, Plus, Send, MessageCircle, Dumbbell, ClipboardList, Eye, PlusCircle } from 'lucide-react'
import { dismissInsight, markInsightRead, createPinnedNote, deletePinnedNote } from '@/actions/insights'
import type { InsightItem } from '@/actions/insights'

interface StudentInsightsCardProps {
    studentId: string
    insights: InsightItem[]
    /**
     * Optional callback invoked when the user clicks a contextual CTA on an
     * insight. Receives the raw action_type + full insight so the parent can
     * decide what to do (navigate, open modal, scroll to section, etc.).
     * When omitted, the CTAs fallback to smooth-scrolling to a section
     * derived from the action_type — enough to be useful in isolation.
     */
    onInsightAction?: (actionType: string, insight: InsightItem) => void
}

// Maps backend action_type to a compact label + icon for inline CTAs.
// Keep the set small; unknown action_types render with a generic "Ver" fallback.
const ACTION_CTA: Record<string, { label: string; icon: typeof MessageCircle; scrollTarget?: string }> = {
    contact_student: { label: 'Enviar mensagem', icon: MessageCircle, scrollTarget: 'quick-message' },
    adjust_load: { label: 'Ajustar carga', icon: Dumbbell, scrollTarget: 'student-actions' },
    generate_program: { label: 'Criar programa', icon: PlusCircle, scrollTarget: 'student-actions' },
    review_program: { label: 'Revisar programa', icon: Eye, scrollTarget: 'student-actions' },
    review_anamnese: { label: 'Ver avaliação', icon: ClipboardList, scrollTarget: 'assessments' },
    review_checkin: { label: 'Ver check-in', icon: ClipboardList, scrollTarget: 'assessments' },
}

// Redesign "ferramenta profissional": a cor da categoria virou um PONTO
// semântico na linha — os fundos/bordas tintados por categoria saíram.
const CATEGORY_DOT: Record<string, string> = {
    alert: 'bg-amber-500',
    progression: 'bg-emerald-500',
    suggestion: 'bg-blue-500',
    summary: 'bg-k-text-quaternary',
    pinned_note: 'bg-k-text-quaternary',
}

export function StudentInsightsCard({ studentId, insights: initialInsights, onInsightAction }: StudentInsightsCardProps) {
    const [insights, setInsights] = useState(initialInsights)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [noteText, setNoteText] = useState('')
    const [saving, setSaving] = useState(false)
    const [noteError, setNoteError] = useState<string | null>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Split into pinned notes and AI insights
    const studentInsights = insights.filter(i => i.student_id === studentId)
    const pinnedNotes = studentInsights.filter(i => i.category === 'pinned_note')
    // Prioritize AI insights: category (alert > progression > suggestion > summary) then priority DESC.
    // Rationale: alerts represent risk that needs action today; progression is celebratory next;
    // suggestions are proactive ideas; summaries are informational.
    const CATEGORY_ORDER: Record<string, number> = { alert: 0, progression: 1, suggestion: 2, summary: 3 }
    const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const aiInsights = studentInsights
        .filter(i => i.category !== 'pinned_note')
        .slice() // copy before sort (state immutability)
        .sort((a, b) => {
            const ca = CATEGORY_ORDER[a.category] ?? 99
            const cb = CATEGORY_ORDER[b.category] ?? 99
            if (ca !== cb) return ca - cb
            const pa = PRIORITY_ORDER[a.priority] ?? 99
            const pb = PRIORITY_ORDER[b.priority] ?? 99
            if (pa !== pb) return pa - pb
            // Newest first as tie-breaker
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
    const newCount = aiInsights.filter(i => i.status === 'new').length

    const handleDismiss = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setInsights(prev => prev.filter(i => i.id !== id))
        await dismissInsight(id)
    }, [])

    const handleDeletePin = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setInsights(prev => prev.filter(i => i.id !== id))
        await deletePinnedNote(id)
    }, [])

    const handleExpand = useCallback(async (id: string) => {
        const isExpanding = expandedId !== id
        setExpandedId(isExpanding ? id : null)

        if (isExpanding) {
            const insight = insights.find(i => i.id === id)
            if (insight?.status === 'new') {
                setInsights(prev => prev.map(i => i.id === id ? { ...i, status: 'read' as const } : i))
                await markInsightRead(id)
            }
        }
    }, [expandedId, insights])

    const handleAction = useCallback((insight: InsightItem, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!insight.action_type) return
        if (onInsightAction) {
            onInsightAction(insight.action_type, insight)
            return
        }
        // Default behavior: scroll to a section marked with data-onboarding=<scrollTarget>
        const cta = ACTION_CTA[insight.action_type]
        if (cta?.scrollTarget) {
            const el = document.querySelector(`[data-onboarding="${cta.scrollTarget}"]`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [onInsightAction])

    const handleAddNote = useCallback(async () => {
        if (!noteText.trim() || saving) return
        setSaving(true)
        setNoteError(null)
        const result = await createPinnedNote(studentId, noteText.trim())
        if (result.success && result.id) {
            const newNote: InsightItem = {
                id: result.id,
                student_id: studentId,
                student_name: null,
                category: 'pinned_note',
                priority: 'low',
                title: 'Nota do treinador',
                body: noteText.trim(),
                action_type: null,
                action_metadata: {},
                status: 'read',
                source: 'trainer',
                insight_key: `pinned_note:${studentId}:${Date.now()}`,
                created_at: new Date().toISOString(),
            }
            setInsights(prev => [newNote, ...prev])
            setNoteText('')
            setIsAddingNote(false)
        } else {
            // Não falhar em silêncio: mantém o texto e mostra o erro pro treinador.
            setNoteError(result.error || 'Não foi possível salvar a nota. Tente novamente.')
        }
        setSaving(false)
    }, [noteText, saving, studentId])

    const noteButton = (
        <button
            onClick={() => { setIsAddingNote(true); setTimeout(() => inputRef.current?.focus(), 100) }}
            className="flex items-center gap-1 text-[11px] font-medium text-k-text-tertiary hover:text-k-text-primary transition-colors"
        >
            <Plus className="w-3 h-3" />
            Nota
        </button>
    )

    // Show card even if only pinned notes exist (no AI insights needed)
    if (studentInsights.length === 0 && !isAddingNote) {
        // Still show the add-note button as a compact bar
        return (
            <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                        Insights &amp; notas
                    </span>
                    {noteButton}
                </div>
                <p className="text-[11.5px] text-k-text-quaternary mt-2">Nenhum insight ou nota no momento.</p>
            </div>
        )
    }

    return (
        <div className="bg-surface-card rounded-panel border border-k-border-subtle p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-k-text-tertiary">
                    Insights &amp; notas
                    {newCount > 0 && (
                        <span className="text-primary"> · {newCount} nov{newCount > 1 ? 'os' : 'o'}</span>
                    )}
                </span>
                {noteButton}
            </div>

            {/* Add note input */}
            {isAddingNote && (
                <div className="my-3">
                    <NoteInput
                        ref={inputRef}
                        value={noteText}
                        onChange={(v) => { setNoteText(v); if (noteError) setNoteError(null) }}
                        onSubmit={handleAddNote}
                        onCancel={() => { setIsAddingNote(false); setNoteText(''); setNoteError(null) }}
                        saving={saving}
                        error={noteError}
                    />
                </div>
            )}

            <div>
                {/* Pinned notes first */}
                {pinnedNotes.map(note => (
                    <div
                        key={note.id}
                        className="flex items-start gap-2.5 py-2.5 border-b border-k-border-subtle last:border-b-0"
                    >
                        <Pin className="w-3 h-3 mt-0.5 shrink-0 text-k-text-quaternary" />
                        <p className="flex-1 text-xs text-k-text-secondary leading-relaxed">
                            {note.body}
                        </p>
                        <button
                            onClick={(e) => handleDeletePin(note.id, e)}
                            className="p-1 text-k-text-quaternary hover:text-red-500 rounded-control transition-colors shrink-0"
                            title="Remover nota"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}

                {/* AI insights — linha com ponto semântico; expande inline */}
                {aiInsights.slice(0, 5).map(insight => {
                    const dot = CATEGORY_DOT[insight.category] || CATEGORY_DOT.summary
                    const isExpanded = expandedId === insight.id
                    const isNew = insight.status === 'new'

                    return (
                        <div
                            key={insight.id}
                            className="py-2.5 border-b border-k-border-subtle last:border-b-0 cursor-pointer group"
                            onClick={() => handleExpand(insight.id)}
                        >
                            <div className="flex items-start gap-2.5">
                                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dot}`} aria-hidden="true" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className={`text-xs font-semibold truncate ${isNew ? 'text-k-text-primary' : 'text-k-text-secondary'}`}>
                                            {insight.title}
                                        </p>
                                        {isNew && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Novo" />
                                        )}
                                    </div>
                                    {isExpanded && (
                                        <>
                                            <p className="text-[11px] text-k-text-tertiary mt-1 leading-relaxed">
                                                {insight.body}
                                            </p>
                                            {insight.action_type && ACTION_CTA[insight.action_type] && (() => {
                                                const cta = ACTION_CTA[insight.action_type!]
                                                const CtaIcon = cta.icon
                                                return (
                                                    <button
                                                        onClick={(e) => handleAction(insight, e)}
                                                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-control border border-k-border-primary text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary transition-colors"
                                                    >
                                                        <CtaIcon className="w-3 h-3" />
                                                        {cta.label}
                                                    </button>
                                                )
                                            })()}
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {!isExpanded && (
                                        <ChevronRight className="w-3.5 h-3.5 text-k-text-quaternary" />
                                    )}
                                    <button
                                        onClick={(e) => handleDismiss(insight.id, e)}
                                        className="p-1 text-k-text-quaternary hover:text-k-text-secondary rounded-control transition-colors"
                                        title="Dispensar"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {aiInsights.length > 5 && (
                <p className="font-mono text-[10px] text-k-text-quaternary mt-3 text-center tabular-nums">
                    +{aiInsights.length - 5} insight{aiInsights.length - 5 > 1 ? 's' : ''}
                </p>
            )}
        </div>
    )
}

// ── Note Input Component ──

import { forwardRef } from 'react'

const NoteInput = forwardRef<HTMLTextAreaElement, {
    value: string
    onChange: (v: string) => void
    onSubmit: () => void
    onCancel: () => void
    saving: boolean
    error?: string | null
}>(({ value, onChange, onSubmit, onCancel, saving, error }, ref) => {
    return (
        <div>
        <div className="flex gap-2">
            <textarea
                ref={ref}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() }
                    if (e.key === 'Escape') onCancel()
                }}
                placeholder="Escreva uma nota sobre o aluno..."
                className="flex-1 min-h-[60px] px-3 py-2 text-xs text-k-text-primary bg-surface-inset border border-k-border-subtle rounded-control resize-none outline-none focus:border-ring focus:ring-1 focus:ring-ring/25 placeholder-k-text-quaternary transition-colors"
            />
            <div className="flex flex-col gap-1">
                <button
                    onClick={onSubmit}
                    disabled={!value.trim() || saving}
                    aria-label="Salvar nota"
                    className="p-2 rounded-control border border-k-border-primary text-k-text-secondary hover:bg-surface-inset hover:text-k-text-primary disabled:opacity-40 transition-colors"
                >
                    <Send className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={onCancel}
                    aria-label="Cancelar nota"
                    className="p-2 text-k-text-quaternary hover:text-k-text-secondary rounded-control transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
        {error && (
            <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400">
                {error}
            </p>
        )}
        </div>
    )
})
NoteInput.displayName = 'NoteInput'

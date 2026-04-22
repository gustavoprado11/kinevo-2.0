'use client'

import { useState, useCallback, useRef } from 'react'
import {
    Sparkles, AlertTriangle, TrendingUp, Lightbulb, BarChart3,
    X, ChevronRight, Pin, Plus, Send, MessageCircle, Dumbbell, ClipboardList, Eye, PlusCircle,
} from 'lucide-react'
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

const CATEGORY_CONFIG: Record<string, {
    icon: typeof AlertTriangle
    color: string
    bg: string
    border: string
}> = {
    alert: {
        icon: AlertTriangle,
        color: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/20',
    },
    progression: {
        icon: TrendingUp,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        border: 'border-emerald-200 dark:border-emerald-500/20',
    },
    suggestion: {
        icon: Lightbulb,
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        border: 'border-blue-200 dark:border-blue-500/20',
    },
    summary: {
        icon: BarChart3,
        color: 'text-violet-500',
        bg: 'bg-violet-50 dark:bg-violet-500/10',
        border: 'border-violet-200 dark:border-violet-500/20',
    },
    pinned_note: {
        icon: Pin,
        color: 'text-[#6E6E73] dark:text-k-text-tertiary',
        bg: 'bg-[#F5F5F7] dark:bg-white/5',
        border: 'border-[#E5E5EA] dark:border-k-border-subtle',
    },
}

export function StudentInsightsCard({ studentId, insights: initialInsights, onInsightAction }: StudentInsightsCardProps) {
    const [insights, setInsights] = useState(initialInsights)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [noteText, setNoteText] = useState('')
    const [saving, setSaving] = useState(false)
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
        }
        setSaving(false)
    }, [noteText, saving, studentId])

    // Show card even if only pinned notes exist (no AI insights needed)
    if (studentInsights.length === 0 && !isAddingNote) {
        // Still show the add-note button as a compact bar
        return (
            <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        Insights & Notas
                    </h3>
                    <button
                        onClick={() => { setIsAddingNote(true); setTimeout(() => inputRef.current?.focus(), 100) }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                        Nota
                    </button>
                </div>
                {isAddingNote && (
                    <div className="mt-3">
                        <NoteInput
                            ref={inputRef}
                            value={noteText}
                            onChange={setNoteText}
                            onSubmit={handleAddNote}
                            onCancel={() => { setIsAddingNote(false); setNoteText('') }}
                            saving={saving}
                        />
                    </div>
                )}
                {!isAddingNote && (
                    <p className="text-[11px] text-[#AEAEB2] dark:text-k-text-quaternary mt-2">Nenhum insight ou nota no momento</p>
                )}
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-glass-bg backdrop-blur-md rounded-2xl border border-transparent dark:border-k-border-primary shadow-sm dark:shadow-none p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#1C1C1E] dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    Insights & Notas
                    {newCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                            {newCount} novo{newCount > 1 ? 's' : ''}
                        </span>
                    )}
                </h3>
                <button
                    onClick={() => { setIsAddingNote(true); setTimeout(() => inputRef.current?.focus(), 100) }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    Nota
                </button>
            </div>

            {/* Add note input */}
            {isAddingNote && (
                <div className="mb-3">
                    <NoteInput
                        ref={inputRef}
                        value={noteText}
                        onChange={setNoteText}
                        onSubmit={handleAddNote}
                        onCancel={() => { setIsAddingNote(false); setNoteText('') }}
                        saving={saving}
                    />
                </div>
            )}

            <div className="space-y-2">
                {/* Pinned notes first */}
                {pinnedNotes.map(note => (
                    <div
                        key={note.id}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-white/5 border border-[#E5E5EA] dark:border-k-border-subtle"
                    >
                        <Pin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#8E8E93] dark:text-k-text-quaternary rotate-45" />
                        <p className="flex-1 text-xs text-[#3C3C43] dark:text-k-text-secondary leading-relaxed">
                            {note.body}
                        </p>
                        <button
                            onClick={(e) => handleDeletePin(note.id, e)}
                            className="p-1 text-[#C7C7CC] dark:text-k-text-quaternary hover:text-red-400 rounded-md transition-colors shrink-0"
                            title="Remover nota"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}

                {/* AI insights */}
                {aiInsights.slice(0, 5).map(insight => {
                    const config = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.summary
                    const Icon = config.icon
                    const isExpanded = expandedId === insight.id
                    const isNew = insight.status === 'new'

                    return (
                        <div
                            key={insight.id}
                            className={`rounded-xl border transition-all cursor-pointer ${config.border} ${isExpanded ? config.bg : ''} hover:${config.bg}`}
                            onClick={() => handleExpand(insight.id)}
                        >
                            <div className="flex items-start gap-2.5 px-3 py-2.5">
                                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className={`text-xs font-semibold text-[#1C1C1E] dark:text-k-text-primary truncate ${isNew ? '' : 'opacity-80'}`}>
                                            {insight.title}
                                        </p>
                                        {isNew && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                        )}
                                    </div>
                                    {isExpanded && (
                                        <>
                                            <p className="text-[11px] text-[#6E6E73] dark:text-k-text-tertiary mt-1 leading-relaxed">
                                                {insight.body}
                                            </p>
                                            {insight.action_type && ACTION_CTA[insight.action_type] && (() => {
                                                const cta = ACTION_CTA[insight.action_type!]
                                                const CtaIcon = cta.icon
                                                return (
                                                    <button
                                                        onClick={(e) => handleAction(insight, e)}
                                                        className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${config.color} bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border ${config.border}`}
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
                                        <ChevronRight className="w-3.5 h-3.5 text-[#C7C7CC] dark:text-k-text-quaternary" />
                                    )}
                                    <button
                                        onClick={(e) => handleDismiss(insight.id, e)}
                                        className="p-1 text-[#C7C7CC] dark:text-k-text-quaternary hover:text-[#8E8E93] dark:hover:text-k-text-tertiary rounded-md transition-colors"
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
                <p className="text-[10px] font-medium text-[#86868B] dark:text-k-text-quaternary mt-3 text-center">
                    +{aiInsights.length - 5} mais insight{aiInsights.length - 5 > 1 ? 's' : ''}
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
}>(({ value, onChange, onSubmit, onCancel, saving }, ref) => {
    return (
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
                className="flex-1 min-h-[60px] px-3 py-2 text-xs text-[#1C1C1E] dark:text-k-text-secondary bg-[#F5F5F7] dark:bg-white/5 border border-[#E5E5EA] dark:border-k-border-subtle rounded-xl resize-none outline-none focus:border-violet-400 dark:focus:border-violet-500/50 placeholder-[#AEAEB2] dark:placeholder-k-text-quaternary transition-colors"
            />
            <div className="flex flex-col gap-1">
                <button
                    onClick={onSubmit}
                    disabled={!value.trim() || saving}
                    className="p-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white rounded-xl transition-colors"
                >
                    <Send className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={onCancel}
                    className="p-2 text-[#8E8E93] dark:text-k-text-quaternary hover:text-[#3C3C43] dark:hover:text-k-text-secondary rounded-xl transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
})
NoteInput.displayName = 'NoteInput'

'use client'

import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp, AlertTriangle, Loader2, Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type {
    AgentAnswerEntry,
    PrescriptionAgentQuestion,
    PrescriptionContextAnalysis,
} from '@kinevo/shared/types/prescription'

// ============================================================================
// Props
// ============================================================================

interface AgentQuestionsPanelProps {
    questions: PrescriptionAgentQuestion[]
    analysis: PrescriptionContextAnalysis | null
    studentName: string
    answers: Record<string, string>
    onAnswerChange: (questionId: string, answer: string) => void
    onSubmit: () => void
    onSkip: () => void
    isSubmitting: boolean
    /**
     * Persisted answers from the previous generation cycle (loaded from
     * profile.agent_answers via use-prescription-agent). When a question_id
     * matches, the panel pre-selects that option/text so the trainer
     * confirms-or-changes instead of answering from scratch every time.
     */
    initialStructuredAnswers?: Record<string, AgentAnswerEntry>
    /**
     * Fires alongside onAnswerChange whenever the user touches an answer.
     * Carries the structured form so the parent can persist it back to the
     * profile (avoids re-derivation from the serialized string).
     */
    onStructuredChange?: (questionId: string, structured: AgentAnswerEntry) => void
}

// ============================================================================
// Internal state for structured answers
// ============================================================================

interface StructuredAnswer {
    selectedOptions: string[]   // for single_choice / multi_choice
    textInput: string           // for text or allows_text additional field
}

function serializeAnswer(question: PrescriptionAgentQuestion, answer: StructuredAnswer): string {
    switch (question.type) {
        case 'single_choice': {
            const base = answer.selectedOptions[0] || ''
            return answer.textInput ? `${base} — ${answer.textInput}` : base
        }
        case 'multi_choice': {
            const base = answer.selectedOptions.join(', ')
            return answer.textInput ? `${base} — ${answer.textInput}` : base
        }
        case 'text':
        default:
            return answer.textInput
    }
}

function isAnswered(question: PrescriptionAgentQuestion, answer: StructuredAnswer): boolean {
    switch (question.type) {
        case 'single_choice':
            return answer.selectedOptions.length > 0
        case 'multi_choice':
            return answer.selectedOptions.length > 0
        case 'text':
        default:
            return answer.textInput.trim().length > 0
    }
}

// ============================================================================
// Component
// ============================================================================
//
// Visual language matches the Configurar step's pattern (Contexto do Aluno,
// Formulários respondidos, Volume Semanal cards) — same outer chrome, same
// header structure, same color tokens. Two cards stacked:
//
//   1. "Análise do contexto" — collapsible, mirrors Contexto do Aluno
//   2. "Decisões pra refinar" — main interactive card, divide-y between
//      questions instead of card-in-card pillows
//
// Skip dialog kept (it's a destructive-ish action) but slimmed to match
// the rest of the design system.

export function AgentQuestionsPanel({
    questions,
    analysis,
    studentName,
    answers: _externalAnswers,
    onAnswerChange,
    onSubmit,
    onSkip,
    isSubmitting,
    initialStructuredAnswers,
    onStructuredChange,
}: AgentQuestionsPanelProps) {
    const [analysisExpanded, setAnalysisExpanded] = useState(false)
    const [showSkipConfirm, setShowSkipConfirm] = useState(false)

    // Seed each question with the trainer's last persisted answer when one
    // exists. The panel then immediately fires onAnswerChange/onStructuredChange
    // for every pre-filled question so the parent's serialized + structured
    // maps stay in sync with what the user sees on screen.
    const [structuredAnswers, setStructuredAnswers] = useState<Record<string, StructuredAnswer>>(() => {
        const initial: Record<string, StructuredAnswer> = {}
        for (const q of questions) {
            const prev = initialStructuredAnswers?.[q.id]
            initial[q.id] = prev
                ? { selectedOptions: [...prev.selectedOptions], textInput: prev.textInput }
                : { selectedOptions: [], textInput: '' }
        }
        return initial
    })

    // On first mount, propagate any pre-filled answers to the parent so the
    // submit button enables and the agentState reaches the LLM with last-cycle
    // decisions intact even if the trainer doesn't touch anything.
    const [didSeedParent, setDidSeedParent] = useState(false)
    if (!didSeedParent && initialStructuredAnswers) {
        for (const q of questions) {
            const prev = initialStructuredAnswers[q.id]
            if (prev && (prev.selectedOptions.length > 0 || prev.textInput.trim())) {
                onAnswerChange(q.id, serializeAnswer(q, prev))
                onStructuredChange?.(q.id, prev)
            }
        }
        // useState setter inside render is allowed for one-shot init guards.
        setDidSeedParent(true)
    }

    const updateAnswer = (questionId: string, question: PrescriptionAgentQuestion, updated: StructuredAnswer) => {
        setStructuredAnswers(prev => ({ ...prev, [questionId]: updated }))
        onAnswerChange(questionId, serializeAnswer(question, updated))
        onStructuredChange?.(questionId, updated)
    }

    const handleOptionToggle = (question: PrescriptionAgentQuestion, option: string) => {
        const current = structuredAnswers[question.id] || { selectedOptions: [], textInput: '' }

        if (question.type === 'single_choice') {
            const updated = { ...current, selectedOptions: [option] }
            updateAnswer(question.id, question, updated)
        } else {
            const selected = current.selectedOptions.includes(option)
                ? current.selectedOptions.filter(o => o !== option)
                : [...current.selectedOptions, option]
            const updated = { ...current, selectedOptions: selected }
            updateAnswer(question.id, question, updated)
        }
    }

    const handleTextChange = (question: PrescriptionAgentQuestion, text: string) => {
        const current = structuredAnswers[question.id] || { selectedOptions: [], textInput: '' }
        const updated = { ...current, textInput: text }
        updateAnswer(question.id, question, updated)
    }

    const allAnswered = questions.every(q => {
        const answer = structuredAnswers[q.id]
        return answer ? isAnswered(q, answer) : false
    })

    const answeredCount = questions.filter(q => {
        const answer = structuredAnswers[q.id]
        return answer ? isAnswered(q, answer) : false
    }).length

    return (
        <div className="space-y-4">
            {/* ── Analysis card (collapsible, mirrors Contexto do Aluno) ───── */}
            {analysis && analysis.student_summary && (
                <div className="bg-glass-bg backdrop-blur-md rounded-2xl
                    border border-violet-200 dark:border-violet-500/30 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setAnalysisExpanded(!analysisExpanded)}
                        aria-expanded={analysisExpanded}
                        className="w-full flex items-center justify-between px-6 py-4
                            hover:bg-violet-50/60 dark:hover:bg-violet-500/[0.04] transition-colors"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/15
                                border border-violet-200 dark:border-violet-500/30
                                flex items-center justify-center shrink-0">
                                <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="text-left min-w-0">
                                <span className="text-sm font-semibold text-k-text-primary block truncate">
                                    Análise do contexto
                                </span>
                                <p className="text-[11px] text-k-text-tertiary mt-0.5 truncate">
                                    O que a IA observou sobre {studentName}
                                </p>
                            </div>
                        </div>
                        {analysisExpanded
                            ? <ChevronUp className="w-4 h-4 text-k-text-tertiary shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-k-text-tertiary shrink-0" />
                        }
                    </button>

                    <div
                        className="overflow-hidden transition-all duration-300"
                        style={{
                            maxHeight: analysisExpanded ? '480px' : '0',
                            opacity: analysisExpanded ? 1 : 0,
                        }}
                    >
                        <div className="px-6 pb-5 border-t border-violet-200 dark:border-violet-500/10 pt-3">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {analysis.student_summary}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Questions card (main interactive content) ───────────────── */}
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl
                border border-violet-200 dark:border-violet-500/30 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4
                    border-b border-violet-200 dark:border-violet-500/10">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/15
                        border border-violet-200 dark:border-violet-500/30
                        flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-sm font-semibold text-k-text-primary block">
                            Decisões para refinar
                        </span>
                        <p className="text-[11px] text-k-text-tertiary mt-0.5">
                            {answeredCount} de {questions.length} respondida{questions.length === 1 ? '' : 's'}
                            {' · '}A IA precisa do seu input antes de gerar
                        </p>
                    </div>
                </div>

                {/* Questions — divide-y between them, no card-in-card chrome */}
                <ul className="divide-y divide-violet-200/60 dark:divide-violet-500/10">
                    {questions.map((q, i) => {
                        const answer = structuredAnswers[q.id] || { selectedOptions: [], textInput: '' }
                        const answered = isAnswered(q, answer)
                        const wasPreFilled =
                            !!initialStructuredAnswers?.[q.id]
                            && (
                                (initialStructuredAnswers[q.id].selectedOptions.length > 0)
                                || initialStructuredAnswers[q.id].textInput.trim().length > 0
                            )
                        const isMultiChoice = q.type === 'multi_choice'

                        // Per-QUESTION mode: if any option has long content, render all as cards
                        const useCardMode = q.options?.some(o => o.includes(' — ') || o.length > 50) || false

                        return (
                            <li key={q.id} className="px-6 py-4 space-y-3">
                                {/* Question header — number + text + context */}
                                <div className="flex items-start gap-2.5">
                                    <span className={`shrink-0 inline-flex items-center justify-center
                                        w-5 h-5 rounded-full text-[10px] font-bold mt-0.5 transition-colors ${
                                        answered
                                            ? 'bg-violet-600 text-white dark:bg-violet-500'
                                            : 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30'
                                    }`}>
                                        {answered ? <Check className="w-3 h-3" /> : i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start gap-2 flex-wrap">
                                            <p className="text-sm font-medium text-k-text-primary leading-snug flex-1 min-w-0">
                                                {q.question}
                                            </p>
                                            {wasPreFilled && (
                                                <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full
                                                    text-[10px] font-semibold
                                                    bg-violet-50 dark:bg-violet-500/10
                                                    text-violet-700 dark:text-violet-300
                                                    border border-violet-200 dark:border-violet-500/30">
                                                    Resposta anterior
                                                </span>
                                            )}
                                        </div>
                                        {q.context && (
                                            <p className="text-xs text-k-text-tertiary mt-1 leading-relaxed">
                                                {q.context}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Options for single_choice / multi_choice */}
                                {(q.type === 'single_choice' || q.type === 'multi_choice') && q.options && (
                                    <div className={
                                        useCardMode
                                            ? 'space-y-2 pl-7'
                                            : isMultiChoice
                                                ? 'flex flex-wrap gap-2 pl-7'
                                                : 'flex flex-wrap gap-2 pl-7'
                                    }>
                                        {q.options.map(option => {
                                            const isSelected = answer.selectedOptions.includes(option)

                                            if (useCardMode) {
                                                const hasDash = option.includes(' — ')
                                                const [title, description] = hasDash
                                                    ? [option.split(' — ')[0], option.split(' — ').slice(1).join(' — ')]
                                                    : [option, null]

                                                return (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => handleOptionToggle(q, option)}
                                                        disabled={isSubmitting}
                                                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 active:scale-[0.99] disabled:opacity-50 ${
                                                            isSelected
                                                                ? 'border-violet-400 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10'
                                                                : 'border-[#E8E8ED] dark:border-k-border-subtle bg-transparent hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-violet-50/30 dark:hover:bg-violet-500/[0.03]'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className={`text-sm font-semibold ${
                                                                    isSelected
                                                                        ? 'text-violet-700 dark:text-violet-300'
                                                                        : 'text-k-text-primary'
                                                                }`}>
                                                                    {title}
                                                                </p>
                                                                {description && (
                                                                    <p className="text-xs text-k-text-tertiary mt-0.5 leading-relaxed">
                                                                        {description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {isSelected && (
                                                                <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
                                                            )}
                                                        </div>
                                                    </button>
                                                )
                                            }

                                            // Chip mode
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => handleOptionToggle(q, option)}
                                                    disabled={isSubmitting}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 active:scale-[0.97] disabled:opacity-50 ${
                                                        isSelected
                                                            ? 'border-violet-400 dark:border-violet-500/50 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300'
                                                            : 'border-[#E8E8ED] dark:border-k-border-subtle bg-transparent text-k-text-secondary hover:border-violet-300 dark:hover:border-violet-500/30'
                                                    }`}
                                                >
                                                    {isMultiChoice && isSelected && (
                                                        <Check className="w-3 h-3 inline mr-1 -mt-0.5" />
                                                    )}
                                                    {option}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Free-text input for `text` type or `allows_text` additional field */}
                                {(q.type === 'text' || q.allows_text) && (
                                    <div className="pl-7">
                                        <textarea
                                            value={answer.textInput}
                                            onChange={(e) => handleTextChange(q, e.target.value)}
                                            placeholder={q.placeholder || (q.type === 'text' ? 'Sua resposta...' : 'Algo mais? (opcional)')}
                                            disabled={isSubmitting}
                                            rows={1}
                                            className="w-full px-3 py-2 rounded-lg
                                                bg-white dark:bg-white/[0.04]
                                                border border-[#E8E8ED] dark:border-k-border-subtle
                                                text-sm text-k-text-primary placeholder:text-k-text-quaternary
                                                focus:border-violet-400 dark:focus:border-violet-500/40
                                                focus:outline-none focus:ring-1 focus:ring-violet-500/20 dark:focus:ring-violet-500/10
                                                resize-none disabled:opacity-50 transition-colors"
                                            style={{ minHeight: '40px', maxHeight: '120px', fieldSizing: 'content' } as React.CSSProperties}
                                        />
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-3 px-6 py-4
                    border-t border-violet-200 dark:border-violet-500/10
                    bg-[#FAFAFA] dark:bg-white/[0.02]">
                    <Button
                        variant="ghost"
                        onClick={() => setShowSkipConfirm(true)}
                        disabled={isSubmitting}
                        className="text-k-text-tertiary hover:text-k-text-secondary text-sm"
                    >
                        Pular perguntas
                    </Button>

                    <Button
                        onClick={onSubmit}
                        disabled={!allAnswered || isSubmitting}
                        className="bg-violet-600 hover:bg-violet-500 text-white gap-2 rounded-full px-5"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Gerar Programa
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* ── Skip Confirmation Dialog ────────────────────────────────── */}
            {showSkipConfirm && (
                <div className="fixed inset-0 z-modal flex items-center justify-center">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowSkipConfirm(false)}
                    />
                    <div className="relative w-full max-w-md
                        bg-white dark:bg-surface-primary
                        border border-[#E8E8ED] dark:border-k-border-primary
                        rounded-2xl p-5 z-modal space-y-4 mx-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg
                                bg-amber-50 dark:bg-amber-500/15
                                border border-amber-200 dark:border-amber-500/30
                                flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-k-text-primary">
                                    Pular perguntas?
                                </h3>
                                <p className="text-xs text-k-text-tertiary mt-1.5 leading-relaxed">
                                    O programa será gerado sem essas informações. Revise com atenção
                                    antes de enviar ao aluno, especialmente restrições físicas.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button
                                variant="ghost"
                                onClick={() => setShowSkipConfirm(false)}
                                className="text-k-text-secondary text-sm rounded-full"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowSkipConfirm(false)
                                    onSkip()
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-full px-4"
                            >
                                Sim, gerar mesmo assim
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

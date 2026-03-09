'use client'

import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp, AlertTriangle, Loader2, Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type {
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

export function AgentQuestionsPanel({
    questions,
    analysis,
    studentName,
    answers: _externalAnswers,
    onAnswerChange,
    onSubmit,
    onSkip,
    isSubmitting,
}: AgentQuestionsPanelProps) {
    const [analysisExpanded, setAnalysisExpanded] = useState(false)
    const [showSkipConfirm, setShowSkipConfirm] = useState(false)

    // Structured state per question
    const [structuredAnswers, setStructuredAnswers] = useState<Record<string, StructuredAnswer>>(() => {
        const initial: Record<string, StructuredAnswer> = {}
        for (const q of questions) {
            initial[q.id] = { selectedOptions: [], textInput: '' }
        }
        return initial
    })

    const updateAnswer = (questionId: string, question: PrescriptionAgentQuestion, updated: StructuredAnswer) => {
        setStructuredAnswers(prev => ({ ...prev, [questionId]: updated }))
        onAnswerChange(questionId, serializeAnswer(question, updated))
    }

    const handleOptionToggle = (question: PrescriptionAgentQuestion, option: string) => {
        const current = structuredAnswers[question.id] || { selectedOptions: [], textInput: '' }

        if (question.type === 'single_choice') {
            const updated = { ...current, selectedOptions: [option] }
            updateAnswer(question.id, question, updated)
        } else {
            // multi_choice: toggle
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

    return (
        <div className="space-y-6">
            {/* Analysis summary (collapsible) */}
            {analysis && analysis.student_summary && (
                <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary overflow-hidden">
                    <button
                        onClick={() => setAnalysisExpanded(!analysisExpanded)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                                <Brain className="w-4 h-4 text-violet-400" />
                            </div>
                            <span className="text-sm font-medium text-k-text-secondary">
                                Análise do contexto de {studentName}
                            </span>
                        </div>
                        {analysisExpanded
                            ? <ChevronUp className="w-4 h-4 text-k-text-quaternary" />
                            : <ChevronDown className="w-4 h-4 text-k-text-quaternary" />
                        }
                    </button>

                    {analysisExpanded && (
                        <div className="px-6 pb-5 space-y-3 border-t border-k-border-primary pt-4">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {analysis.student_summary}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Questions card */}
            <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-k-text-primary flex items-center gap-2">
                        <Brain className="w-5 h-5 text-violet-500" />
                        Quase lá! Algumas decisões para refinar
                    </h3>
                    <p className="text-sm text-k-text-tertiary mt-1">
                        A IA identificou {questions.length} {questions.length === 1 ? 'ponto que precisa' : 'pontos que precisam'} da sua decisão antes de montar o programa.
                    </p>
                </div>

                <div className="space-y-4">
                    {questions.map((q, i) => {
                        const answer = structuredAnswers[q.id] || { selectedOptions: [], textInput: '' }
                        const isMultiChoice = q.type === 'multi_choice'

                        // Per-QUESTION mode decision: if ANY option has "—" or >50 chars → ALL render as card
                        const useCardMode = q.options?.some(o => o.includes(' — ') || o.length > 50) || false

                        return (
                            <div key={q.id} className="border border-k-border-subtle rounded-xl p-5 space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-k-text-primary">
                                            {q.question}
                                        </span>
                                        {q.context && (
                                            <span className="block text-xs text-k-text-tertiary mt-0.5">
                                                {q.context}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Options for single_choice / multi_choice */}
                                {(q.type === 'single_choice' || q.type === 'multi_choice') && q.options && (
                                    <div className={
                                        useCardMode
                                            ? 'space-y-2 mt-1'
                                            : isMultiChoice
                                                ? 'grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1'
                                                : 'flex flex-wrap gap-2 mt-1'
                                    }>
                                        {q.options.map(option => {
                                            const isSelected = answer.selectedOptions.includes(option)

                                            if (useCardMode) {
                                                // Card mode — ALL options render as card
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
                                                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 active:scale-[0.97] disabled:opacity-50 ${
                                                            isSelected
                                                                ? 'border-violet-500 bg-violet-500/10'
                                                                : 'border-k-border-primary bg-k-surface hover:border-violet-400'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className={`text-sm font-semibold ${isSelected ? 'text-violet-400' : 'text-k-text-primary'}`}>
                                                                    {title}
                                                                </p>
                                                                {description && (
                                                                    <p className="text-xs text-k-text-tertiary mt-0.5">{description}</p>
                                                                )}
                                                            </div>
                                                            {isSelected && (
                                                                <Check className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                                                            )}
                                                        </div>
                                                    </button>
                                                )
                                            }

                                            // Chip mode — ALL options render as chip
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => handleOptionToggle(q, option)}
                                                    disabled={isSubmitting}
                                                    className={`px-4 py-2 rounded-lg text-sm border transition-all duration-150 active:scale-[0.97] disabled:opacity-50 ${
                                                        isSelected
                                                            ? 'border-violet-500 bg-violet-500/10 text-violet-400 font-medium'
                                                            : 'border-k-border-primary bg-k-surface text-k-text-secondary hover:border-violet-400'
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

                                {/* Additional text field for allows_text or pure text type */}
                                {(q.type === 'text' || q.allows_text) && (
                                    <textarea
                                        value={answer.textInput}
                                        onChange={(e) => handleTextChange(q, e.target.value)}
                                        placeholder={q.placeholder || (q.type === 'text' ? 'Sua resposta...' : 'Algo mais? (opcional)')}
                                        disabled={isSubmitting}
                                        rows={1}
                                        className="w-full px-4 py-3 rounded-lg bg-k-surface border border-k-border-primary text-sm text-k-text-primary placeholder:text-k-text-tertiary focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 resize-none disabled:opacity-50 transition-colors"
                                        style={{ minHeight: '40px', maxHeight: '120px', fieldSizing: 'content' } as React.CSSProperties}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Actions — sticky on mobile */}
                <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-glass-bg/80 backdrop-blur-sm border-t border-k-border-subtle sm:static sm:mx-0 sm:mb-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:pt-2">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setShowSkipConfirm(true)}
                            disabled={isSubmitting}
                            className="text-k-text-tertiary hover:text-k-text-secondary"
                        >
                            Pular perguntas
                        </Button>

                        <Button
                            onClick={onSubmit}
                            disabled={!allAnswered || isSubmitting}
                            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
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
            </div>

            {/* Skip Confirmation Dialog */}
            {showSkipConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowSkipConfirm(false)}
                    />
                    <div className="relative w-full max-w-md bg-k-surface border border-k-border-primary rounded-2xl p-6 z-50 space-y-4 mx-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-k-text-primary">
                                    Pular perguntas?
                                </h3>
                                <p className="text-sm text-k-text-tertiary mt-1.5 leading-relaxed">
                                    O programa será gerado sem essas informações. Revise com atenção antes de enviar ao aluno, especialmente restrições físicas.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowSkipConfirm(false)}
                                className="border-k-border-primary text-k-text-secondary"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowSkipConfirm(false)
                                    onSkip()
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white"
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

'use client'

import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp, AlertTriangle, Loader2 } from 'lucide-react'
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
                    <h3 className="text-lg font-bold text-k-text-primary">
                        Preciso de mais algumas informações
                    </h3>
                    <p className="text-sm text-k-text-tertiary mt-1">
                        Com base no histórico de {studentName}, tenho {questions.length} {questions.length === 1 ? 'dúvida' : 'dúvidas'} antes de prescrever:
                    </p>
                </div>

                <div className="space-y-5">
                    {questions.map((q, i) => {
                        const answer = structuredAnswers[q.id] || { selectedOptions: [], textInput: '' }

                        return (
                            <div key={q.id} className="space-y-2">
                                <div>
                                    <span className="text-sm font-medium text-k-text-primary">
                                        {i + 1}. {q.question}
                                    </span>
                                    {q.context && (
                                        <span className="block text-xs text-k-text-tertiary mt-0.5">
                                            {q.context}
                                        </span>
                                    )}
                                </div>

                                {/* Options for single_choice / multi_choice */}
                                {(q.type === 'single_choice' || q.type === 'multi_choice') && q.options && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {q.options.map(option => {
                                            const isSelected = answer.selectedOptions.includes(option)
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => handleOptionToggle(q, option)}
                                                    disabled={isSubmitting}
                                                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all disabled:opacity-50 ${
                                                        isSelected
                                                            ? 'bg-violet-600 border-violet-500 text-white'
                                                            : 'bg-k-surface border-k-border-primary text-k-text-secondary hover:border-violet-400'
                                                    }`}
                                                >
                                                    {q.type === 'multi_choice' && isSelected && (
                                                        <span className="mr-1">✓</span>
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
                                        placeholder={q.placeholder || (q.type === 'text' ? 'Sua resposta...' : 'Informação adicional (opcional)...')}
                                        disabled={isSubmitting}
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-xl bg-k-surface border border-k-border-primary text-sm text-k-text-primary placeholder:text-k-text-tertiary focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 resize-none disabled:opacity-50 transition-colors"
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={() => setShowSkipConfirm(true)}
                        disabled={isSubmitting}
                        className="text-sm text-k-text-tertiary hover:text-k-text-secondary transition-colors disabled:opacity-50"
                    >
                        Pular perguntas
                    </button>

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
                            'Gerar Programa'
                        )}
                    </Button>
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

'use client'

import { useState } from 'react'
import { Lightbulb, ChevronDown, ChevronUp, Globe, MessageSquare, AlertTriangle } from 'lucide-react'

import type { PrescriptionReasoningExtended } from '@kinevo/shared/types/prescription'

// ============================================================================
// Props
// ============================================================================

interface PrescriptionRationalePanelProps {
    reasoning: PrescriptionReasoningExtended
}

// ============================================================================
// Component
// ============================================================================

export function PrescriptionRationalePanel({ reasoning }: PrescriptionRationalePanelProps) {
    const [isExpanded, setIsExpanded] = useState(true)

    const confidencePercent = Math.round(reasoning.confidence_score * 100)
    const confidenceColor = confidencePercent >= 85
        ? 'text-emerald-400'
        : confidencePercent >= 70
            ? 'text-amber-400'
            : 'text-red-400'

    const confidenceBg = confidencePercent >= 85
        ? 'bg-emerald-500/15 border-emerald-500/30'
        : confidencePercent >= 70
            ? 'bg-amber-500/15 border-amber-500/30'
            : 'bg-red-500/15 border-red-500/30'

    const confidenceBarColor = confidencePercent >= 85
        ? 'bg-emerald-400'
        : confidencePercent >= 70
            ? 'bg-amber-400'
            : 'bg-red-400'

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-violet-500/20 overflow-hidden mb-6">
            {/* Header (always visible) */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                        <span className="text-sm font-semibold text-violet-300">
                            Racional da IA
                        </span>
                        <p className="text-[10px] text-k-text-quaternary">
                            Entenda as decisões da IA para este programa
                        </p>
                    </div>
                    {/* Confidence badge with mini progress bar */}
                    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold ${confidenceBg} ${confidenceColor}`}>
                        <span>{confidencePercent}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${confidenceBarColor} transition-all duration-500`}
                                style={{ width: `${confidencePercent}%` }}
                            />
                        </div>
                    </div>
                </div>
                {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-k-text-quaternary" />
                    : <ChevronDown className="w-4 h-4 text-k-text-quaternary" />
                }
            </button>

            {/* Content (collapsible) */}
            {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-violet-500/10 pt-4">
                    {/* Context Analysis */}
                    {reasoning.context_analysis?.student_summary && (
                        <Section title="📐 Análise do Contexto">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.context_analysis.student_summary}
                            </p>
                        </Section>
                    )}

                    {/* Structure Rationale */}
                    <Section title="📐 Estrutura">
                        <p className="text-sm text-k-text-secondary leading-relaxed">
                            {reasoning.structure_rationale}
                        </p>
                    </Section>

                    {/* Volume Rationale */}
                    {reasoning.volume_rationale && (
                        <Section title="📊 Volume">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.volume_rationale}
                            </p>
                        </Section>
                    )}

                    {/* Exercise Choices */}
                    {reasoning.exercise_choices && (
                        <Section title="🏋️ Escolha de Exercícios">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.exercise_choices}
                            </p>
                        </Section>
                    )}

                    {/* Form Data Used */}
                    {reasoning.form_data_used && reasoning.form_data_used !== 'Sem formulários respondidos' && (
                        <Section title="📝 Dados do Aluno">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.form_data_used}
                            </p>
                        </Section>
                    )}

                    {/* Adaptations */}
                    {reasoning.adaptations && reasoning.adaptations !== 'Primeiro programa — sem dados de performance' && (
                        <Section title="⚙️ Adaptações">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.adaptations}
                            </p>
                        </Section>
                    )}

                    {/* Workout Notes — grid of mini-rows */}
                    {reasoning.workout_notes.length > 0 && (
                        <Section title="📋 Detalhes por sessão">
                            <div className="space-y-1.5">
                                {reasoning.workout_notes.map((note, i) => {
                                    // Try to parse structured notes like "Treino A — Push | 5 compostos | 17 séries"
                                    const parts = note.split(' | ')
                                    if (parts.length >= 2) {
                                        return (
                                            <div key={i} className="flex items-center gap-4 text-sm py-1.5 px-3 rounded-lg bg-white/[0.02]">
                                                <span className="font-semibold text-k-text-primary">{parts[0]}</span>
                                                {parts.slice(1).map((part, j) => (
                                                    <span key={j} className="text-k-text-tertiary text-xs">{part}</span>
                                                ))}
                                            </div>
                                        )
                                    }
                                    return (
                                        <div key={i} className="text-sm text-k-text-secondary py-1.5 px-3 rounded-lg bg-white/[0.02]">
                                            {note}
                                        </div>
                                    )
                                })}
                            </div>
                        </Section>
                    )}

                    {/* Evidence References */}
                    {reasoning.evidence_references && reasoning.evidence_references.length > 0 && (
                        <Section title="🔗 Evidências">
                            <ul className="space-y-1">
                                {reasoning.evidence_references.map((url, i) => (
                                    <li key={i}>
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-violet-400 hover:text-violet-300 underline break-all"
                                        >
                                            {url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {/* Q&A Trail */}
                    {reasoning.trainer_answers && reasoning.trainer_answers.length > 0 && (
                        <Section title="💬 Perguntas & Respostas">
                            <div className="space-y-2">
                                {reasoning.trainer_answers.map((qa, i) => (
                                    <div key={i} className="space-y-1">
                                        <p className="text-xs font-medium text-k-text-tertiary">
                                            Pergunta {i + 1}
                                        </p>
                                        <p className="text-sm text-k-text-secondary py-1.5 px-3 rounded-lg bg-white/[0.02]">
                                            {qa.answer}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Attention Flags — 4c improved alert */}
                    {reasoning.attention_flags.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 rounded-r-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                                    {reasoning.attention_flags.length === 1
                                        ? 'Ponto de atenção'
                                        : `${reasoning.attention_flags.length} pontos de atenção`
                                    }
                                </p>
                                {reasoning.attention_flags.map((flag, i) => (
                                    <p key={i} className="text-sm text-amber-800 dark:text-amber-400/80">
                                        {flag}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// Section helper
// ============================================================================

function Section({ title, children }: {
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary">
                {title}
            </span>
            {children}
        </div>
    )
}

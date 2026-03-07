'use client'

import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp, Globe, MessageSquare, TrendingUp, Shield } from 'lucide-react'

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

    const confidenceColor = reasoning.confidence_score >= 0.8
        ? 'text-emerald-400'
        : reasoning.confidence_score >= 0.6
            ? 'text-amber-400'
            : 'text-red-400'

    const confidenceBg = reasoning.confidence_score >= 0.8
        ? 'bg-emerald-500/15 border-emerald-500/30'
        : reasoning.confidence_score >= 0.6
            ? 'bg-amber-500/15 border-amber-500/30'
            : 'bg-red-500/15 border-red-500/30'

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-violet-500/20 overflow-hidden mb-6">
            {/* Header (always visible) */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-sm font-semibold text-violet-300">
                        Racional do Agente
                    </span>
                    <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${confidenceBg} ${confidenceColor}`}>
                        {Math.round(reasoning.confidence_score * 100)}% confiança
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
                        <Section icon={TrendingUp} title="Análise do Contexto">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.context_analysis.student_summary}
                            </p>
                        </Section>
                    )}

                    {/* Structure Rationale */}
                    <Section icon={Shield} title="Estrutura">
                        <p className="text-sm text-k-text-secondary leading-relaxed">
                            {reasoning.structure_rationale}
                        </p>
                    </Section>

                    {/* Volume Rationale */}
                    {reasoning.volume_rationale && (
                        <Section icon={TrendingUp} title="Volume">
                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                {reasoning.volume_rationale}
                            </p>
                        </Section>
                    )}

                    {/* Workout Notes */}
                    {reasoning.workout_notes.length > 0 && (
                        <Section icon={MessageSquare} title="Notas por Treino">
                            <ul className="space-y-1.5">
                                {reasoning.workout_notes.map((note, i) => (
                                    <li key={i} className="text-sm text-k-text-secondary pl-3 border-l-2 border-violet-500/20">
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {/* Evidence References */}
                    {reasoning.evidence_references && reasoning.evidence_references.length > 0 && (
                        <Section icon={Globe} title="Evidências">
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
                        <Section icon={MessageSquare} title="Perguntas & Respostas">
                            <div className="space-y-2">
                                {reasoning.trainer_answers.map((qa, i) => (
                                    <div key={i} className="space-y-1">
                                        <p className="text-xs font-medium text-k-text-tertiary">
                                            Pergunta {i + 1}
                                        </p>
                                        <p className="text-sm text-k-text-secondary pl-3 border-l-2 border-violet-500/20">
                                            {qa.answer}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Attention Flags */}
                    {reasoning.attention_flags.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                Atenção
                            </span>
                            {reasoning.attention_flags.map((flag, i) => (
                                <p key={i} className="text-sm text-amber-900">
                                    {flag}
                                </p>
                            ))}
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

function Section({ icon: Icon, title, children }: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-k-text-quaternary">
                    {title}
                </span>
            </div>
            {children}
        </div>
    )
}

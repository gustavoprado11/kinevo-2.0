'use client'

import { useMemo, useState } from 'react'
import {
    Lightbulb,
    ChevronDown,
    AlertTriangle,
    Layers,
    BarChart3,
    Dumbbell,
    ClipboardList,
    Settings2,
    UserSearch,
    Link2,
    MessageSquare,
} from 'lucide-react'

import type { PrescriptionReasoningExtended } from '@kinevo/shared/types/prescription'
import { translateAttentionFlags } from '@/lib/prescription/output-enricher'

// ============================================================================
// Props
// ============================================================================

interface PrescriptionRationalePanelProps {
    reasoning: PrescriptionReasoningExtended
}

// ============================================================================
// Component
// ============================================================================
//
// UX goals (Issue 4 — UI pass):
//   1. Default collapsed. The trainer lands on the program, not on a wall of
//      AI rationale. They opt-in by clicking.
//   2. Header summarizes the program even when collapsed: split, frequency,
//      confidence pill, and a count of attention points. The trainer can read
//      the whole gist without expanding.
//   3. Strong click affordance: full-width header button, hover bg, chevron
//      with rotation animation, "Ver detalhes" / "Recolher" microcopy.
//   4. Bounded height when expanded (max-h ~55vh) with internal scroll, so
//      the program below stays in view — no more "stuck" feeling.
//   5. Visual hierarchy by importance: attention points first, then structure
//      + volume side-by-side (the main story), then per-session details, then
//      the long-tail context (Q&A, evidence).

export function PrescriptionRationalePanel({ reasoning }: PrescriptionRationalePanelProps) {
    // Default collapsed — trainer expands when they want detail.
    const [isExpanded, setIsExpanded] = useState(false)

    const confidencePercent = Math.round(reasoning.confidence_score * 100)
    // Theme-aware tones: dark text on light bg in light mode; light text on dim bg in dark mode.
    const confidenceTone = confidencePercent >= 85
        ? {
            text: 'text-emerald-700 dark:text-emerald-300',
            bg: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30',
            bar: 'bg-emerald-500 dark:bg-emerald-400',
        }
        : confidencePercent >= 70
            ? {
                text: 'text-amber-700 dark:text-amber-300',
                bg: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30',
                bar: 'bg-amber-500 dark:bg-amber-400',
            }
            : {
                text: 'text-red-700 dark:text-red-300',
                bg: 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30',
                bar: 'bg-red-500 dark:bg-red-400',
            }

    // Defensive translation: snapshots persisted before the enricher learned
    // to translate flags still hold raw snake_case identifiers like
    // "replaced_stalled_exercises". Re-running the translator at render is
    // idempotent (snake_case-only guard) so already-translated text passes
    // through unchanged.
    const displayFlags = useMemo(
        () => translateAttentionFlags(reasoning.attention_flags),
        [reasoning.attention_flags],
    )
    const flagCount = displayFlags.length

    // First line of structure_rationale gives a clean tag-line for the collapsed header.
    // e.g. "Upper/Lower A/B 4x/sem" from "Upper/Lower A/B 4x/sem (Upper A seg, ...)."
    const structureTagline = (() => {
        const raw = reasoning.structure_rationale ?? ''
        const beforeParen = raw.split('(')[0].trim()
        return beforeParen.replace(/\.$/, '') || 'Programa personalizado'
    })()

    // Render note: full-bleed header strip (no rounded corners, no side border,
    // no margin). The bottom border ties it to the rest of the page chrome — it
    // reads as "another row of the header" instead of a floating card sitting
    // between the title bar and the workspace.
    return (
        <div className="bg-white dark:bg-surface-primary border-b border-[#E8E8ED] dark:border-k-border-subtle">
            {/* ── Header (always visible, summarizes when collapsed) ──────── */}
            <button
                type="button"
                onClick={() => setIsExpanded(v => !v)}
                aria-expanded={isExpanded}
                aria-controls="rationale-panel-content"
                className="w-full flex items-center gap-4 px-8 py-3 cursor-pointer
                    hover:bg-violet-50/60 dark:hover:bg-violet-500/[0.04]
                    active:bg-violet-100/60 dark:active:bg-violet-500/[0.08]
                    transition-colors text-left"
            >
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/30
                    flex items-center justify-center shrink-0">
                    <Lightbulb className="w-4 h-4 text-violet-600 dark:text-violet-300" />
                </div>

                {/* Title + tagline */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-violet-700 dark:text-violet-200">
                            Racional da IA
                        </span>
                        <span className="text-xs text-k-text-quaternary">·</span>
                        <span className="text-xs text-k-text-tertiary truncate">
                            {structureTagline}
                        </span>
                    </div>
                    <p className="text-[11px] text-k-text-quaternary mt-0.5">
                        {isExpanded ? 'Toque para recolher' : 'Toque para ver as decisões em detalhe'}
                    </p>
                </div>

                {/* Confidence pill */}
                <div className={`hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full
                    border text-[10px] font-bold ${confidenceTone.bg} ${confidenceTone.text}`}>
                    <span>{confidencePercent}%</span>
                    <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${confidenceTone.bar} transition-all duration-500`}
                            style={{ width: `${confidencePercent}%` }}
                        />
                    </div>
                </div>

                {/* Attention chip (collapsed-state preview of urgency) */}
                {flagCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30
                        text-amber-700 dark:text-amber-200 text-[10px] font-bold shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                        <span>{flagCount}</span>
                        <span className="hidden md:inline">
                            {flagCount === 1 ? 'ponto de atenção' : 'pontos de atenção'}
                        </span>
                    </div>
                )}

                {/* Toggle affordance */}
                <div className="flex items-center gap-1.5 text-k-text-tertiary shrink-0">
                    <span className="hidden md:inline text-xs font-medium">
                        {isExpanded ? 'Recolher' : 'Ver detalhes'}
                    </span>
                    <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200
                            ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            {/* ── Content (collapsible, bounded scroll) ──────────────────── */}
            {isExpanded && (
                <div
                    id="rationale-panel-content"
                    className="border-t border-[#E8E8ED] dark:border-k-border-subtle
                        bg-[#FAFAFA] dark:bg-white/[0.02] max-h-[55vh] overflow-y-auto"
                >
                    <div className="px-8 py-5 space-y-4">
                        {/* 1) Attention points come FIRST when present — most actionable
                              info should not be buried at the bottom of a long card. */}
                        {flagCount > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-500/10
                                border border-amber-200 dark:border-amber-500/30
                                rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400
                                    flex-shrink-0 mt-0.5" />
                                <div className="space-y-2 min-w-0">
                                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                        {flagCount === 1
                                            ? 'Ponto de atenção desta prescrição'
                                            : `${flagCount} pontos de atenção desta prescrição`
                                        }
                                    </p>
                                    <ul className="space-y-1.5">
                                        {displayFlags.map((flag, i) => (
                                            <li
                                                key={i}
                                                className="text-sm text-amber-800 dark:text-amber-100/80 leading-relaxed
                                                    flex items-start gap-2"
                                            >
                                                <span className="text-amber-500 dark:text-amber-400 mt-1.5 shrink-0">·</span>
                                                <span>{flag}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* 2) Headline story: structure + volume side-by-side on desktop. */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Section icon={Layers} title="Estrutura">
                                <p className="text-sm text-k-text-secondary leading-relaxed">
                                    {reasoning.structure_rationale}
                                </p>
                            </Section>

                            {reasoning.volume_rationale && (
                                <Section icon={BarChart3} title="Volume semanal">
                                    <p className="text-sm text-k-text-secondary leading-relaxed">
                                        {reasoning.volume_rationale}
                                    </p>
                                </Section>
                            )}
                        </div>

                        {/* 3) Per-session breakdown — minimal list, no card chrome.
                              Each row is just "Nome — descrição" with a violet
                              dot, so the section reads as continuous prose
                              instead of a stack of pills. */}
                        {reasoning.workout_notes.length > 0 && (
                            <Section icon={ClipboardList} title="Detalhes por sessão">
                                <ul className="space-y-1">
                                    {reasoning.workout_notes.map((note, i) => {
                                        const parts = note.split(' | ')
                                        const head = parts[0]
                                        const tail = parts.slice(1).join(' · ')
                                        return (
                                            <li
                                                key={i}
                                                className="text-sm text-k-text-secondary
                                                    leading-relaxed flex items-start gap-2"
                                            >
                                                <span className="text-violet-400 dark:text-violet-300/60
                                                    mt-2 shrink-0 text-[10px]">●</span>
                                                <span className="min-w-0">
                                                    {tail ? (
                                                        <>
                                                            <span className="font-semibold text-k-text-primary">
                                                                {head}
                                                            </span>
                                                            <span className="text-k-text-tertiary"> · {tail}</span>
                                                        </>
                                                    ) : (
                                                        head
                                                    )}
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </Section>
                        )}

                        {/* 4) Optional context — only renders when present. */}
                        {reasoning.context_analysis?.student_summary && (
                            <Section icon={UserSearch} title="Análise do aluno">
                                <p className="text-sm text-k-text-secondary leading-relaxed">
                                    {reasoning.context_analysis.student_summary}
                                </p>
                            </Section>
                        )}

                        {reasoning.exercise_choices && (
                            <Section icon={Dumbbell} title="Escolha de exercícios">
                                <p className="text-sm text-k-text-secondary leading-relaxed">
                                    {reasoning.exercise_choices}
                                </p>
                            </Section>
                        )}

                        {reasoning.adaptations
                            && reasoning.adaptations !== 'Primeiro programa — sem dados de performance' && (
                            <Section icon={Settings2} title="Adaptações">
                                <p className="text-sm text-k-text-secondary leading-relaxed">
                                    {reasoning.adaptations}
                                </p>
                            </Section>
                        )}

                        {reasoning.form_data_used
                            && reasoning.form_data_used !== 'Sem formulários respondidos' && (
                            <Section icon={ClipboardList} title="Dados do aluno">
                                <p className="text-sm text-k-text-secondary leading-relaxed">
                                    {reasoning.form_data_used}
                                </p>
                            </Section>
                        )}

                        {/* 5) Long-tail: trainer Q&A */}
                        {reasoning.trainer_answers && reasoning.trainer_answers.length > 0 && (
                            <Section icon={MessageSquare} title="Perguntas & respostas">
                                <div className="space-y-2">
                                    {reasoning.trainer_answers.map((qa, i) => (
                                        <div key={i} className="space-y-0.5">
                                            <p className="text-[10px] font-semibold text-k-text-quaternary uppercase tracking-wide">
                                                Pergunta {i + 1}
                                            </p>
                                            <p className="text-sm text-k-text-secondary leading-relaxed">
                                                {qa.answer}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* 6) Long-tail: evidence references */}
                        {reasoning.evidence_references && reasoning.evidence_references.length > 0 && (
                            <Section icon={Link2} title="Evidências">
                                <ul className="space-y-1">
                                    {reasoning.evidence_references.map((url, i) => (
                                        <li key={i}>
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-violet-600 dark:text-violet-400
                                                    hover:text-violet-700 dark:hover:text-violet-300 underline break-all"
                                            >
                                                {url}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// Section — uniform layout for content blocks (icon + title + body)
// ============================================================================

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
                <Icon className="w-3 h-3 text-violet-500/80 dark:text-violet-300/70" />
                <span className="text-[10px] font-bold uppercase tracking-wider
                    text-violet-700 dark:text-violet-300">
                    {title}
                </span>
            </div>
            {children}
        </div>
    )
}

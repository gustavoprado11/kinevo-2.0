'use client'

import { useState } from 'react'
import { ClipboardList, Check, ChevronDown, ChevronUp, Info } from 'lucide-react'
import type { FormSubmissionSummary } from '@/actions/prescription/get-prescription-data'

// ============================================================================
// Props
// ============================================================================

interface FormSubmissionsCardProps {
    submissions: FormSubmissionSummary[]
    selectedIds: string[]
    onToggle: (id: string) => void
}

// ============================================================================
// Category config — light/dark theme aware so chips stay legible in both modes
// ============================================================================

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    anamnese: {
        bg: 'bg-violet-100 dark:bg-violet-500/15',
        text: 'text-violet-700 dark:text-violet-400',
        label: 'Anamnese',
    },
    checkin: {
        bg: 'bg-blue-100 dark:bg-blue-500/15',
        text: 'text-blue-700 dark:text-blue-400',
        label: 'Check-in',
    },
    survey: {
        bg: 'bg-emerald-100 dark:bg-emerald-500/15',
        text: 'text-emerald-700 dark:text-emerald-400',
        label: 'Pesquisa',
    },
}

function getCategoryStyle(category: string) {
    return CATEGORY_STYLES[category] || CATEGORY_STYLES.survey
}

// ============================================================================
// Component
// ============================================================================
//
// Mirrors the visual pattern of the "Contexto do Aluno" card so the two cards
// in the Configurar step feel like siblings instead of unrelated widgets:
//   - Same header chrome (icon 8x8 violet + title + subtitle + chevron)
//   - Same expand/collapse mechanism with maxHeight transition
//   - Same list pattern (divide-y rows, no per-item card chrome)
//
// Default state: collapsed when every form is already selected (the common
// happy path — trainer doesn't need to think about it). Auto-expands when
// any form is deselected so the trainer can see exactly what they excluded.

export function FormSubmissionsCard({
    submissions,
    selectedIds,
    onToggle,
}: FormSubmissionsCardProps) {
    if (submissions.length === 0) return null

    const selectedSet = new Set(selectedIds)
    const allSelected = submissions.length > 0 && selectedSet.size === submissions.length
    const noneSelected = selectedSet.size === 0

    const [manuallyToggled, setManuallyToggled] = useState(false)
    // If the user has touched the chevron, respect that state. Otherwise the
    // default is "collapsed when all selected".
    const [userExpanded, setUserExpanded] = useState(false)
    const isExpanded = manuallyToggled
        ? userExpanded
        : !allSelected

    const toggleExpanded = () => {
        setManuallyToggled(true)
        setUserExpanded(!isExpanded)
    }

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-violet-200 dark:border-violet-500/30 overflow-hidden">
            {/* ── Header (always visible, click to expand/collapse) ─────────── */}
            <button
                type="button"
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between px-6 py-4
                    hover:bg-violet-50/60 dark:hover:bg-violet-500/[0.04] transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/15
                        border border-violet-200 dark:border-violet-500/30
                        flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="text-left min-w-0">
                        <span className="text-sm font-semibold text-k-text-primary block truncate">
                            Formulários respondidos
                        </span>
                        <p className="text-[11px] text-k-text-tertiary mt-0.5 truncate">
                            {summarize(selectedSet.size, submissions.length)}
                        </p>
                    </div>
                </div>
                {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-k-text-tertiary shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-k-text-tertiary shrink-0" />
                }
            </button>

            {/* ── Content (collapsible) ─────────────────────────────────────── */}
            <div
                className="overflow-hidden transition-all duration-300"
                style={{
                    maxHeight: isExpanded ? '600px' : '0',
                    opacity: isExpanded ? 1 : 0,
                }}
            >
                <div className="px-6 pb-5 border-t border-violet-200 dark:border-violet-500/10 pt-3">
                    {/* Form list — divide-y rows, no per-item border, names
                        wrap freely so they're never truncated like before
                        ("Anamnese - Coleta d..." → full title now). */}
                    <ul className="divide-y divide-violet-200/60 dark:divide-violet-500/10">
                        {submissions.map((sub) => {
                            const isSelected = selectedSet.has(sub.id)
                            const cat = getCategoryStyle(sub.template_category)
                            const date = formatDate(sub.submitted_at)

                            return (
                                <li key={sub.id}>
                                    <button
                                        type="button"
                                        onClick={() => onToggle(sub.id)}
                                        aria-pressed={isSelected}
                                        className="w-full flex items-center gap-3 py-3
                                            text-left transition-colors group"
                                    >
                                        {/* Checkbox */}
                                        <div
                                            className={`w-5 h-5 rounded-md flex items-center justify-center
                                                flex-shrink-0 transition-colors border ${
                                                isSelected
                                                    ? 'bg-violet-600 border-violet-600 dark:bg-violet-600 dark:border-violet-500'
                                                    : 'bg-transparent border-[#D2D2D7] dark:border-k-border-secondary group-hover:border-violet-500/40'
                                            }`}
                                        >
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>

                                        {/* Title + date — full width, no truncation */}
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-sm font-medium block ${
                                                isSelected
                                                    ? 'text-k-text-primary'
                                                    : 'text-k-text-secondary'
                                            }`}>
                                                {sub.template_title}
                                            </span>
                                            <span className="text-xs text-k-text-tertiary">
                                                {date}
                                            </span>
                                        </div>

                                        {/* Category chip */}
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold
                                            flex-shrink-0 ${cat.bg} ${cat.text}`}>
                                            {cat.label}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>

                    {/* Impact hint — same pattern as the goal/equipment captions
                        in the form: tells the trainer what this choice changes
                        in the AI's behavior. Three states: all-selected (positive
                        confirmation), some-excluded (warning), none-selected
                        (clear consequence stated). */}
                    <ImpactHint
                        selected={selectedSet.size}
                        total={submissions.length}
                        allSelected={allSelected}
                        noneSelected={noneSelected}
                    />
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Subtitle — concise count for the collapsed header
// ============================================================================

function summarize(selected: number, total: number): string {
    if (total === 0) return 'Sem formulários respondidos'
    if (selected === 0) return `0 de ${total} selecionados · sem contexto extra`
    if (selected === total) {
        return total === 1
            ? '1 formulário · usado como contexto'
            : `${total} formulários · todos usados como contexto`
    }
    return `${selected} de ${total} selecionados`
}

// ============================================================================
// Impact hint — explains the consequence of the current selection
// ============================================================================

function ImpactHint({
    selected,
    total,
    allSelected,
    noneSelected,
}: {
    selected: number
    total: number
    allSelected: boolean
    noneSelected: boolean
}) {
    let toneClasses: string
    let message: string

    if (noneSelected) {
        toneClasses =
            'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 ' +
            'text-amber-800 dark:text-amber-200'
        message =
            'Nenhum formulário selecionado. A IA vai usar apenas o histórico de treinos do aluno.'
    } else if (allSelected) {
        toneClasses =
            'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 ' +
            'text-violet-700 dark:text-violet-200'
        message =
            total === 1
                ? 'A IA vai considerar este formulário ao montar o programa.'
                : 'A IA vai considerar todos esses formulários ao montar o programa.'
    } else {
        const excluded = total - selected
        toneClasses =
            'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 ' +
            'text-amber-800 dark:text-amber-200'
        message =
            excluded === 1
                ? '1 formulário desmarcado — a IA não vai considerar essas respostas.'
                : `${excluded} formulários desmarcados — a IA não vai considerar essas respostas.`
    }

    return (
        <div className={`mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs leading-relaxed ${toneClasses}`}>
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-80" />
            <span>{message}</span>
        </div>
    )
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(isoDate: string): string {
    try {
        const d = new Date(isoDate)
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        })
    } catch {
        return isoDate
    }
}

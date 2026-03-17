'use client'

import { ClipboardList, Check } from 'lucide-react'
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
// Category config
// ============================================================================

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    anamnese: { bg: 'bg-violet-500/15', text: 'text-violet-400', label: 'Anamnese' },
    checkin: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Check-in' },
    survey: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Pesquisa' },
}

function getCategoryStyle(category: string) {
    return CATEGORY_STYLES[category] || CATEGORY_STYLES.survey
}

// ============================================================================
// Component
// ============================================================================

export function FormSubmissionsCard({
    submissions,
    selectedIds,
    onToggle,
}: FormSubmissionsCardProps) {
    if (submissions.length === 0) return null

    const selectedSet = new Set(selectedIds)

    return (
        <div className="bg-glass-bg backdrop-blur-md rounded-2xl border border-k-border-primary p-6 mb-6">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-k-text-primary">
                        Formulários respondidos
                    </h3>
                    <p className="text-sm text-k-text-tertiary mt-1 leading-relaxed">
                        Selecione quais formulários usar como contexto para a IA.
                    </p>

                    <div className="mt-4 space-y-2">
                        {submissions.map((sub) => {
                            const isSelected = selectedSet.has(sub.id)
                            const cat = getCategoryStyle(sub.template_category)
                            const date = formatDate(sub.submitted_at)

                            return (
                                <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => onToggle(sub.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors
                                        ${isSelected
                                            ? 'bg-violet-500/10 border border-violet-500/25'
                                            : 'bg-glass-bg-hover border border-transparent hover:border-k-border-primary'
                                        }
                                    `}
                                >
                                    {/* Checkbox */}
                                    <div
                                        className={`
                                            w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors
                                            ${isSelected
                                                ? 'bg-violet-600 border border-violet-500'
                                                : 'bg-transparent border border-k-border-secondary'
                                            }
                                        `}
                                    >
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-k-text-primary truncate block">
                                            {sub.template_title}
                                        </span>
                                        <span className="text-xs text-k-text-tertiary">
                                            {date}
                                        </span>
                                    </div>

                                    {/* Category badge */}
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${cat.bg} ${cat.text} flex-shrink-0`}>
                                        {cat.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
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

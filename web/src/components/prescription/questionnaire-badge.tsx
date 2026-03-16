'use client'

import { CheckCircle, AlertTriangle } from 'lucide-react'
import type { Divergence } from '@/lib/prescription/questionnaire-mapper'

// ============================================================================
// Props
// ============================================================================

interface QuestionnaireBadgeProps {
    completedAt: string
    divergences: Divergence[]
}

// ============================================================================
// Component
// ============================================================================

export function QuestionnaireBadge({ completedAt, divergences }: QuestionnaireBadgeProps) {
    const date = new Date(completedAt)
    const formatted = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })

    return (
        <div className="mb-6 space-y-3">
            {/* Completed badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                    Questionário respondido em {formatted}
                </span>
            </div>

            {/* Divergence badges */}
            {divergences.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {divergences.map((d) => (
                        <div
                            key={d.field}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs text-amber-400">
                                {d.field === 'training_level' && `Nível: perfil ${d.profile_value} vs aluno ${d.student_value}`}
                                {d.field === 'frequency' && `Frequência: perfil ${d.profile_value} vs aluno ${d.student_value}`}
                                {d.field === 'goal' && `Objetivo: perfil ${d.profile_value} vs aluno ${d.student_value}`}
                                {d.field === 'equipment' && `Ambiente: perfil ${d.profile_value} vs aluno ${d.student_value}`}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

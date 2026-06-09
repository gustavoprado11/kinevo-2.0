'use client'

import { useRouter } from 'next/navigation'
import { FileText, X } from 'lucide-react'
import type { BuilderDraftSummary } from '@/components/programs/helpers/use-builder-draft'

/**
 * Entrada de "rascunho não salvo" no card "Próximos Programas" do aluno.
 * O rascunho vive no localStorage (autosave do builder); aqui o treinador
 * retoma a montagem de onde parou ou descarta.
 */
export function ProgramDraftEntry({
    draft,
    onDiscard,
}: {
    draft: BuilderDraftSummary
    onDiscard: () => void
}) {
    const router = useRouter()
    const savedLabel = draft.savedAt
        ? new Date(draft.savedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : ''

    return (
        <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <h4 className="font-bold text-[#1C1C1E] dark:text-white text-sm truncate">
                    {draft.name.trim() || 'Programa sem nome'}
                </h4>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">
                    Rascunho
                </span>
            </div>
            <p className="text-[11px] font-medium text-amber-700/70 dark:text-amber-300/70">
                {draft.workoutCount > 0 && `${draft.workoutCount} ${draft.workoutCount === 1 ? 'treino' : 'treinos'} · `}
                {savedLabel ? `não salvo · ${savedLabel}` : 'não salvo'}
            </p>
            <div className="flex items-center gap-2 mt-3">
                <button
                    onClick={() => router.push(draft.route)}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                    Continuar montando
                </button>
                <button
                    onClick={onDiscard}
                    aria-label="Descartar rascunho"
                    className="p-2 text-amber-700/60 dark:text-amber-400/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

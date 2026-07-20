'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { BuilderDraftSummary } from '@/components/programs/helpers/use-builder-draft'

/**
 * Entrada de "rascunho não salvo" na fila "Próximo ciclo" do aluno.
 * O rascunho vive no localStorage (autosave do builder); aqui o treinador
 * retoma a montagem de onde parou ou descarta.
 *
 * Redesign: linha da fila unificada (ponto de status + rótulo mono), não
 * mais um card âmbar — a origem do rascunho é texto, não cor.
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
        <div className="flex items-center gap-2.5 py-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-none" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-k-text-primary truncate">
                    {draft.name.trim() || 'Programa sem nome'}
                </p>
                <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-k-text-tertiary truncate">
                    Rascunho · não salvo
                    {draft.workoutCount > 0 && ` · ${draft.workoutCount} ${draft.workoutCount === 1 ? 'treino' : 'treinos'}`}
                    {savedLabel && ` · ${savedLabel}`}
                </p>
            </div>
            <button
                onClick={() => router.push(draft.route)}
                className="text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity flex-none"
            >
                Continuar
            </button>
            <button
                onClick={onDiscard}
                aria-label="Descartar rascunho"
                className="p-1.5 text-k-text-quaternary hover:text-red-500 hover:bg-red-500/10 rounded-control transition-colors flex-none"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    )
}

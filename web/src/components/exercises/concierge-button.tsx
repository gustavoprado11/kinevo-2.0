'use client'

import { Video } from 'lucide-react'

interface ConciergeButtonProps {
    onClick: () => void
}

/**
 * Botão fixo no header da Biblioteca de Exercícios. Sempre visível enquanto
 * o trainer está na página — abre o ConciergeModal no clique.
 *
 * Mesma geometria do botão primário "Criar exercício" (rounded-full, px-5
 * py-2, text-sm) pra ter consistência, mas em estilo outline pra não
 * competir com a ação primária. Pulse verde no ícone sinaliza "equipe
 * disponível" sem precisar de texto extra.
 */
export function ConciergeButton({ onClick }: ConciergeButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Concierge — pedir biblioteca pronta em 24h"
            className="inline-flex items-center gap-2 rounded-full border border-k-border-primary bg-surface-card px-5 py-2 text-sm font-medium text-k-text-primary transition-all hover:border-violet-500/40 hover:bg-violet-50/60 dark:bg-glass-bg dark:hover:bg-glass-bg-active"
        >
            <span className="relative flex">
                <Video size={16} strokeWidth={2} className="text-violet-600 dark:text-violet-400" />
                <span
                    aria-hidden
                    className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface-card dark:ring-glass-bg"
                />
            </span>
            <span>Concierge: Biblioteca em 24h</span>
        </button>
    )
}

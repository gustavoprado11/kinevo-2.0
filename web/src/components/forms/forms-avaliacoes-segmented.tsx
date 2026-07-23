'use client'

import { useRouter } from 'next/navigation'

interface FormsAvaliacoesSegmentedProps {
    active: 'formularios' | 'avaliacoes'
}

// M15 — segmented control no header de /forms e /avaliacoes. Substitui os
// 2 items separados do sidebar por 1 item composto + alternância via URL.
// Click navega entre as 2 rotas (preserva deep-links e shareability).
// Redesign "ferramenta profissional": caixa hairline com o ativo em tinta
// sobre inset (pílula é estado, não navegação).
export function FormsAvaliacoesSegmented({ active }: FormsAvaliacoesSegmentedProps) {
    const router = useRouter()

    const segmentClass = (isActive: boolean) =>
        `px-4 py-1.5 text-sm font-medium transition-colors ${
            isActive
                ? 'bg-surface-inset text-k-text-primary font-semibold'
                : 'text-k-text-secondary hover:text-k-text-primary hover:bg-surface-inset/60'
        }`

    return (
        <div className="mb-6 inline-flex items-center rounded-control border border-k-border-primary bg-surface-card overflow-hidden">
            <button
                type="button"
                onClick={() => {
                    if (active !== 'formularios') router.push('/forms')
                }}
                className={segmentClass(active === 'formularios')}
                aria-pressed={active === 'formularios'}
            >
                Formulários
            </button>
            <button
                type="button"
                onClick={() => {
                    if (active !== 'avaliacoes') router.push('/avaliacoes')
                }}
                className={segmentClass(active === 'avaliacoes')}
                aria-pressed={active === 'avaliacoes'}
            >
                Avaliações
            </button>
        </div>
    )
}

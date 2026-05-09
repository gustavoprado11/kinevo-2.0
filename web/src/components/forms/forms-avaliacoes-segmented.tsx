'use client'

import { useRouter } from 'next/navigation'

interface FormsAvaliacoesSegmentedProps {
    active: 'formularios' | 'avaliacoes'
}

// M15 — segmented control no header de /forms e /avaliacoes. Substitui os
// 2 items separados do sidebar por 1 item composto + alternância via URL.
// Click navega entre as 2 rotas (preserva deep-links e shareability).
export function FormsAvaliacoesSegmented({ active }: FormsAvaliacoesSegmentedProps) {
    const router = useRouter()

    const segmentClass = (isActive: boolean) =>
        isActive
            ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-glass-bg-active dark:text-k-text-primary'
            : 'text-[#6E6E73] hover:text-[#1D1D1F] dark:text-k-text-tertiary dark:hover:text-k-text-secondary'

    return (
        <div className="mb-6 inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] p-1 dark:bg-glass-bg">
            <button
                type="button"
                onClick={() => {
                    if (active !== 'formularios') router.push('/forms')
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${segmentClass(active === 'formularios')}`}
                aria-pressed={active === 'formularios'}
            >
                Formulários
            </button>
            <button
                type="button"
                onClick={() => {
                    if (active !== 'avaliacoes') router.push('/avaliacoes')
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${segmentClass(active === 'avaliacoes')}`}
                aria-pressed={active === 'avaliacoes'}
            >
                Avaliações
            </button>
        </div>
    )
}

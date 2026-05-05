'use client'

import { useState } from 'react'

/**
 * Mantém um estado de "rascunho" local (controlled input) que se ressincroniza
 * quando o valor externo muda — ex: rollback após erro de save, hidratação inicial.
 *
 * Pattern oficial do React docs ("Resetting all state when a prop changes"),
 * que substitui o anti-padrão `useEffect(() => setDraft(external), [external])`
 * (banido pela regra `react-hooks/set-state-in-effect` do React 19).
 */
export function useDraftSync<T>(external: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [draft, setDraft] = useState<T>(external)
    const [tracked, setTracked] = useState<T>(external)
    if (external !== tracked) {
        setTracked(external)
        setDraft(external)
    }
    return [draft, setDraft]
}

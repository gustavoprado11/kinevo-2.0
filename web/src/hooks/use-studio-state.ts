'use client'

/**
 * useStudioState — a casca do app (Sidebar/AppLayout) precisa saber se a conta é
 * de estúdio (esconde Financeiro) e se o usuário é gestor (mostra "Estúdio").
 *
 * Mesma mecânica do useAiAccessState: primeira render usa o valor do servidor
 * (false — casa com o HTML SSR), cache aplicado num layout effect pós-hidratação
 * (sem flash), e o fetch a /api/studio/state confirma logo depois. Evita threddar
 * props de estúdio pelas ~30 páginas que renderizam AppLayout.
 */

import { useEffect, useLayoutEffect, useState } from 'react'

const STUDIO_KEY = 'kinevo-studio-account'
const MANAGER_KEY = 'kinevo-studio-manager'
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function getCached(key: string): boolean {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem(key) === '1' } catch { return false }
}
function setCached(key: string, v: boolean) {
    try { window.localStorage.setItem(key, v ? '1' : '0') } catch { /* noop */ }
}

export function useStudioState() {
    const [isStudioAccount, setIsStudioAccount] = useState(false)
    const [isManager, setIsManager] = useState(false)

    useIsomorphicLayoutEffect(() => {
        setIsStudioAccount(getCached(STUDIO_KEY))
        setIsManager(getCached(MANAGER_KEY))
    }, [])

    useEffect(() => {
        let active = true
        void fetch('/api/studio/state')
            .then(r => (r.ok ? r.json() : null))
            .then((s: { isStudioAccount: boolean; isManager: boolean } | null) => {
                if (!active || !s) return
                setIsStudioAccount(s.isStudioAccount)
                setIsManager(s.isManager)
                setCached(STUDIO_KEY, s.isStudioAccount)
                setCached(MANAGER_KEY, s.isManager)
            })
            .catch(() => { /* degrada para solo */ })
        return () => { active = false }
    }, [])

    return { isStudioAccount, isManager }
}

'use client'

/**
 * useAiAccessState — gate de IA (allowed) + modo de Início (classic|assistant)
 * para a casca do app (Sidebar, AppLayout).
 *
 * Por que não ler o cache no lazy init do useState: o initializer roda também na
 * PRIMEIRA render do cliente, e essa render precisa bater com o HTML do servidor
 * — que nunca vê o localStorage (allowed=false, homeStyle='classic'). Ler o cache
 * ali fazia o cliente pintar o ModeToggle (e, no modo Assistente, uma sidebar
 * inteiramente diferente) contra um HTML que não os tinha: hydration mismatch, e
 * o React descartava a árvore a cada carga.
 *
 * Aqui a primeira render usa o valor do servidor e o cache entra num layout
 * effect — depois da hidratação, antes do paint. Sem mismatch e sem o flash que
 * o cache existe para evitar. O fetch confirma logo em seguida.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import {
    fetchAiAccess,
    getCachedAiAllowed,
    getCachedConsultoriaAllowed,
    getCachedHomeStyle,
    type HomeStyle,
} from '@/components/assistant/command-bar/command-bar'

// useLayoutEffect não roda no servidor e o React avisa quando o componente é
// SSR-ado; no servidor o efeito é inócuo (só o cliente tem cache para aplicar).
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function useAiAccessState() {
    // Valores do SERVIDOR — é com eles que a hidratação precisa casar.
    const [aiAllowed, setAiAllowed] = useState(false)
    const [homeStyle, setHomeStyle] = useState<HomeStyle>('classic')
    // Consultoria IA — beta fechado (migration 251). Mesma mecânica: false na 1ª
    // render (casa com o SSR), cache pós-hidratação, fetch confirma.
    const [consultoriaAllowed, setConsultoriaAllowed] = useState(false)

    useIsomorphicLayoutEffect(() => {
        setAiAllowed(getCachedAiAllowed())
        setHomeStyle(getCachedHomeStyle())
        setConsultoriaAllowed(getCachedConsultoriaAllowed())
    }, [])

    useEffect(() => {
        let active = true
        void fetchAiAccess().then((a) => {
            if (!active || !a) return
            setAiAllowed(a.allowed)
            if (a.homeStyle) setHomeStyle(a.homeStyle)
            setConsultoriaAllowed(a.consultoriaAllowed === true)
        })
        return () => { active = false }
    }, [])

    return { aiAllowed, consultoriaAllowed, homeStyle, setAiAllowed, setHomeStyle }
}

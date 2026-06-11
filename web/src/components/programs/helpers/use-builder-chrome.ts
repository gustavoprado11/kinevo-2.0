'use client'

// "Chrome" da tela dos builders — header auto-hide no scroll, escala do
// preview de celular e colapso da biblioteca. Era a última duplicação entre
// ProgramBuilderClient e EditAssignedProgramClient (com implementações que
// haviam divergido); unificado com o melhor dos dois:
// - acumulação direcional do editor (40px descendo / 20px subindo) — resiste
//   a jitter de trackpad melhor que o delta-por-evento;
// - rebase do scrollTop pós-transição do builder — alternar o header
//   redimensiona a área de scroll e o deslocamento induzido era lido como
//   movimento novo, travando o reaparecimento.

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseBuilderChromeOptions {
    /** Estado inicial do painel da biblioteca (builder deriva das prefs do
     *  treinador). O valor salvo em localStorage rehidrata após o mount
     *  (SSR-safe — ver Fase 4.5k). */
    initialLibraryCollapsed?: boolean
}

const LIBRARY_COLLAPSED_KEY = 'kinevo-library-collapsed'
const HEADER_TRANSITION_MS = 280
const HIDE_AFTER_PX = 40
const SHOW_AFTER_PX = 20
const MIN_SCROLL_TO_HIDE = 60

export function useBuilderChrome({ initialLibraryCollapsed = false }: UseBuilderChromeOptions = {}) {
    const [isCanvasScrolled, setIsCanvasScrolled] = useState(false)
    const [isHeaderHidden, setIsHeaderHidden] = useState(false)
    const lastScrollTopRef = useRef(0)
    const accumulatedScrollRef = useRef(0)
    const lastDirectionRef = useRef<'up' | 'down' | null>(null)
    const headerTransitionRef = useRef(false)
    const canvasScrollRef = useRef<HTMLDivElement>(null)

    const setHeaderHiddenSafe = useCallback((hidden: boolean) => {
        if (hidden === isHeaderHidden || headerTransitionRef.current) return
        headerTransitionRef.current = true
        setIsHeaderHidden(hidden)
        setTimeout(() => {
            headerTransitionRef.current = false
            // Alternar o header redimensiona a área de scroll e pode deslocar o
            // scrollTop; re-baseia para que esse deslocamento induzido não seja
            // lido como um novo movimento (o que travava o reaparecimento).
            if (canvasScrollRef.current) lastScrollTopRef.current = canvasScrollRef.current.scrollTop
        }, HEADER_TRANSITION_MS)
    }, [isHeaderHidden])

    const handleCanvasScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop
        const shouldBeScrolled = isCanvasScrolled ? scrollTop > 10 : scrollTop > 60
        if (shouldBeScrolled !== isCanvasScrolled) setIsCanvasScrolled(shouldBeScrolled)

        // Auto-hide: acumula distância na mesma direção antes de agir.
        if (!headerTransitionRef.current) {
            const dir = scrollTop > lastScrollTopRef.current ? 'down' : 'up'
            const absDelta = Math.abs(scrollTop - lastScrollTopRef.current)
            if (dir !== lastDirectionRef.current) {
                accumulatedScrollRef.current = 0
                lastDirectionRef.current = dir
            }
            accumulatedScrollRef.current += absDelta
            if (dir === 'down' && scrollTop > MIN_SCROLL_TO_HIDE && accumulatedScrollRef.current > HIDE_AFTER_PX) {
                setHeaderHiddenSafe(true)
                accumulatedScrollRef.current = 0
            } else if (dir === 'up' && accumulatedScrollRef.current > SHOW_AFTER_PX) {
                setHeaderHiddenSafe(false)
                accumulatedScrollRef.current = 0
            }
            if (scrollTop <= 10) setHeaderHiddenSafe(false)
        }
        lastScrollTopRef.current = scrollTop
    }, [isCanvasScrolled, setHeaderHiddenSafe])

    // Escala dinâmica do preview de celular para caber na altura disponível.
    const [previewScale, setPreviewScale] = useState(0.82)
    useEffect(() => {
        const BASE_PHONE_HEIGHT = 812
        // Offset = AppLayout header (64) + builder header (~48) + tabs (~44) + padding (24)
        const OFFSET = 180
        const update = () => {
            const available = window.innerHeight - OFFSET
            setPreviewScale(Math.min(0.82, Math.max(0.55, available / BASE_PHONE_HEIGHT)))
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    // Fase 4.5k: SSR-safe init — default no servidor; o localStorage rehidrata
    // DEPOIS do mount (a transição animada do painel mascara o ajuste). Ler no
    // initializer causava hydration mismatch (servidor sem localStorage), por
    // isso o setState pós-mount é intencional aqui.
    const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(initialLibraryCollapsed)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const stored = localStorage.getItem(LIBRARY_COLLAPSED_KEY)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- rehidratação one-shot pós-mount (SSR-safe)
        if (stored === 'true') setIsLibraryCollapsed(true)
    }, [])

    const toggleLibrary = useCallback(() => {
        setIsLibraryCollapsed(prev => {
            const next = !prev
            localStorage.setItem(LIBRARY_COLLAPSED_KEY, String(next))
            return next
        })
    }, [])

    return {
        canvasScrollRef,
        isCanvasScrolled,
        isHeaderHidden,
        handleCanvasScroll,
        previewScale,
        isLibraryCollapsed,
        toggleLibrary,
    }
}

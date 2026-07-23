'use client'

/**
 * LandingV2Client — interatividade da nova landing (Kinevo.dc.html):
 *   1) portais nos slots do HTML (SSR):
 *        #kvlp-hero-dash    → <HeroDashMock/>   (dashboard do treinador, hero desktop)
 *        #kvlp-hero-phone   → <HeroPhoneMock/>  (Assistente no celular, hero ≤820px)
 *        #kvlp-pricing-slot → <PricingV2/>      (planos — fonte única de preços)
 *   2) reveal-on-scroll (IntersectionObserver; degrada visível sem JS).
 * As micro-animações dos cards (kvbuild/kvbar/kvlive) são CSS puro — sem JS aqui.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PricingV2 } from './pricing-v2'
import { HeroDashMock, HeroPhoneMock } from './assistant-mocks'

interface Slots {
    pricing: HTMLElement | null
    dash: HTMLElement | null
    phone: HTMLElement | null
}

export function LandingV2Client({ rootId }: { rootId: string }) {
    const [slots, setSlots] = useState<Slots>({ pricing: null, dash: null, phone: null })

    useEffect(() => {
        const root = document.getElementById(rootId)
        if (!root) return

        // Alvos dos portais = <div> vazios injetados pelo SSR; existem já no 1º
        // frame. Resolvidos num microtask (evita setState síncrono no effect E
        // funciona em aba de fundo — ao contrário do requestAnimationFrame, que
        // é pausado quando a aba não está visível e deixaria os portais vazios).
        const resolveSlots = () =>
            setSlots({
                pricing: document.getElementById('kvlp-pricing-slot'),
                dash: document.getElementById('kvlp-hero-dash'),
                phone: document.getElementById('kvlp-hero-phone'),
            })

        // Reveal-on-scroll — o gate `.reveal-on` faz o CSS esconder [data-reveal];
        // sem JS o conteúdo fica visível (degrada bem). Os cards de preço são
        // montados por portal, então re-observamos algumas vezes.
        const noReveal = new URLSearchParams(window.location.search).has('noreveal')
        if (!noReveal) root.classList.add('reveal-on')

        let io: IntersectionObserver | null = null
        const observed = new WeakSet<Element>()
        const scan = () => {
            const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
            if (!('IntersectionObserver' in window)) {
                els.forEach((el) => el.classList.add('revealed'))
                return
            }
            if (!io) {
                io = new IntersectionObserver(
                    (entries) =>
                        entries.forEach((e) => {
                            if (e.isIntersecting) {
                                e.target.classList.add('revealed')
                                io?.unobserve(e.target)
                            }
                        }),
                    { threshold: 0.1, rootMargin: '0px 0px -7% 0px' },
                )
            }
            els.forEach((el) => {
                if (!observed.has(el)) {
                    observed.add(el)
                    io?.observe(el)
                }
            })
        }

        let cancelled = false
        // Microtask: resolve os slots e observa os [data-reveal] do SSR sem
        // depender de rAF (que pausa em aba de fundo).
        queueMicrotask(() => {
            if (cancelled) return
            resolveSlots()
            if (!noReveal) scan()
        })
        // Re-scans para pegar os [data-reveal] que os portais (preços) injetam,
        // via timers (que disparam mesmo em aba de fundo, ao contrário do rAF).
        const t1 = setTimeout(() => { if (!cancelled && !noReveal) scan() }, 60)
        const t2 = setTimeout(() => { if (!cancelled && !noReveal) scan() }, 400)

        return () => {
            cancelled = true
            clearTimeout(t1)
            clearTimeout(t2)
            io?.disconnect()
        }
    }, [rootId])

    return (
        <>
            {slots.dash && createPortal(<HeroDashMock />, slots.dash)}
            {slots.phone && createPortal(<HeroPhoneMock />, slots.phone)}
            {slots.pricing && createPortal(<PricingV2 />, slots.pricing)}
        </>
    )
}

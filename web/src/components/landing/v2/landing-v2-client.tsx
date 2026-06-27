'use client'

/**
 * LandingV2Client — interatividade da nova landing:
 *   1) portal de <PricingV2/> no slot #kvlp-pricing-slot (preços do TIER_DISPLAY);
 *   2) reveal-on-scroll (IntersectionObserver);
 *   3) animações dos mocks (chat do assistente digitando + demo "cole o treino"),
 *      portadas da máquina de estado do design (manipula os hooks data-kv).
 * Ícones já são SVG inline (build) — sem runtime de ícones.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PricingV2 } from './pricing-v2'
import { HeroPhone, HeroWatch, StudentPhone, AlunoWatch } from './device-mocks'

const DEMO_TEXT = 'Treino B – Posterior\nStiff 4x10\nMesa flexora 3x12\nCadeira flexora 3x15\nPanturrilha 4x20'
const AGENT_PROMPT =
    '"A Marina voltou de viagem. Remarca o treino dela pra terça e quinta e manda uma mensagem avisando."'

interface Slots {
    pricing: HTMLElement | null
    phone: HTMLElement | null
    watch: HTMLElement | null
    alunoPhone: HTMLElement | null
    alunoWatch: HTMLElement | null
}

export function LandingV2Client({ rootId }: { rootId: string }) {
    const [slots, setSlots] = useState<Slots>({ pricing: null, phone: null, watch: null, alunoPhone: null, alunoWatch: null })

    useEffect(() => {
        const root = document.getElementById(rootId)
        if (!root) return
        setSlots({
            pricing: document.getElementById('kvlp-pricing-slot'),
            phone: document.getElementById('kvlp-hero-phone'),
            watch: document.getElementById('kvlp-hero-watch'),
            alunoPhone: document.getElementById('kvlp-aluno-phone'),
            alunoWatch: document.getElementById('kvlp-aluno-watch'),
        })

        let live = true
        const timers: ReturnType<typeof setTimeout>[] = []
        const after = (ms: number, fn: () => void) => {
            const id = setTimeout(() => live && fn(), ms)
            timers.push(id)
            return id
        }
        const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)

        // ── 1) Reveal-on-scroll ──
        let io: IntersectionObserver | null = null
        if (!new URLSearchParams(window.location.search).has('noreveal')) {
            root.classList.add('reveal-on')
            const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
            if ('IntersectionObserver' in window && els.length) {
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
                requestAnimationFrame(() => live && els.forEach((el) => io?.observe(el)))
            } else {
                els.forEach((el) => el.classList.add('revealed'))
            }
        }

        // ── 2) Demo "cole o treino" ──
        const typedEl = q<HTMLElement>('[data-kv="typed"]')
        const exRows = Array.from(root.querySelectorAll<HTMLElement>('[data-kv="ex"]')).sort(
            (a, b) => Number(a.dataset.kvEx) - Number(b.dataset.kvEx),
        )
        const loopDemo = () => {
            if (typedEl) typedEl.textContent = ''
            exRows.forEach((r) => {
                r.style.opacity = '0'
                r.style.transform = 'translateY(10px)'
            })
            let i = 0
            const revealEx = (r: number) => {
                if (r < exRows.length) {
                    const el = exRows[r]
                    if (el) {
                        el.style.opacity = '1'
                        el.style.transform = 'none'
                    }
                    after(520, () => revealEx(r + 1))
                } else {
                    after(3200, loopDemo)
                }
            }
            const type = () => {
                if (i <= DEMO_TEXT.length) {
                    if (typedEl) typedEl.textContent = DEMO_TEXT.slice(0, i)
                    i++
                    after(34, type)
                } else {
                    after(520, () => revealEx(0))
                }
            }
            after(700, type)
        }

        // ── 3) Chat do Assistente ──
        const agTyped = q<HTMLElement>('[data-kv="agentTyped"]')
        const agCaret = q<HTMLElement>('[data-kv="agentCaret"]')
        const agStatus = q<HTMLElement>('[data-kv="agentStatus"]')
        const steps = {
            think: q<HTMLElement>('[data-kv="agThink"]'),
            s1: q<HTMLElement>('[data-kv="agStep1"]'),
            s2: q<HTMLElement>('[data-kv="agStep2"]'),
            done: q<HTMLElement>('[data-kv="agDone"]'),
        }
        const setVis = (el: HTMLElement | null, show: boolean) => {
            if (!el) return
            const hidden = el.classList.contains('kvhide')
            if (show && hidden) {
                el.classList.remove('kvhide')
                el.style.animation = 'kvfadeup .42s var(--kv-ease-out) both'
            } else if (!show && !hidden) {
                el.classList.add('kvhide')
                el.style.animation = ''
            }
        }
        const applyStep = (step: number) => {
            setVis(steps.think, step === 1)
            setVis(steps.s1, step >= 2)
            setVis(steps.s2, step >= 3)
            setVis(steps.done, step >= 4)
            if (agStatus) agStatus.textContent = step >= 4 ? 'pronto' : step >= 1 ? 'executando…' : 'ouvindo…'
        }
        const loopAgent = () => {
            if (agTyped) agTyped.textContent = ''
            if (agCaret) agCaret.style.opacity = '1'
            applyStep(0)
            let i = 0
            const advance = (step: number) => {
                applyStep(step)
                if (step < 4) after(step === 1 ? 900 : 1100, () => advance(step + 1))
                else after(4200, loopAgent)
            }
            const type = () => {
                if (i <= AGENT_PROMPT.length) {
                    if (agTyped) agTyped.textContent = AGENT_PROMPT.slice(0, i)
                    i++
                    after(28, type)
                } else {
                    if (agCaret) agCaret.style.opacity = '0'
                    after(520, () => advance(1))
                }
            }
            after(600, type)
        }

        loopDemo()
        loopAgent()

        return () => {
            live = false
            timers.forEach(clearTimeout)
            io?.disconnect()
        }
    }, [rootId])

    return (
        <>
            {slots.pricing && createPortal(<PricingV2 />, slots.pricing)}
            {slots.phone && createPortal(<HeroPhone />, slots.phone)}
            {slots.watch && createPortal(<HeroWatch />, slots.watch)}
            {slots.alunoPhone && createPortal(<StudentPhone />, slots.alunoPhone)}
            {slots.alunoWatch && createPortal(<AlunoWatch />, slots.alunoWatch)}
        </>
    )
}

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Link2, MousePointer2 } from 'lucide-react'

/**
 * Conteúdo customizado do passo "Superset no hover" do tour do builder
 * (renderizado dentro do OnboardingTooltip quando step.customContentId ===
 * 'superset-demo').
 *
 * Ilustra, em loop, o gesto que muitos treinadores não descobrem sozinhos:
 * passar o mouse ENTRE dois exercícios faz surgir o botão "Criar superset";
 * ao clicar, os dois viram um bloco só (barrinha violeta). Não mexe no
 * programa — é só uma animação. Respeita prefers-reduced-motion.
 *
 * Cores via tokens do design system (accent-superset adapta light/dark).
 */
export function SupersetDemo() {
    const reduce = useReducedMotion()

    // Um ciclo de 6s. `times` marca os keyframes proporcionais à duração.
    const connectAnim = reduce
        ? { opacity: 1 }
        : { opacity: [0, 0, 1, 1, 1, 0, 0], scale: [0.9, 0.9, 1, 1, 1.05, 0.9, 0.9] }
    const connectTimes = [0, 0.12, 0.24, 0.55, 0.64, 0.74, 1]

    const bracketAnim = reduce ? { opacity: 0 } : { opacity: [0, 0, 1, 1, 0] }
    const bracketTimes = [0, 0.62, 0.72, 0.94, 1]

    const cursorAnim = reduce
        ? { opacity: 0 }
        : { opacity: [0, 1, 1, 1, 0], x: [26, 0, 0, 0, 26], y: [-12, 0, 0, 0, -12] }
    const cursorTimes = [0.06, 0.2, 0.6, 0.66, 0.74]

    const repeat = reduce ? 0 : Infinity
    const transition = { duration: 6, ease: 'easeInOut' as const, repeat }

    return (
        <div className="mt-3">
            <div className="relative pl-1.5">
                {/* Barrinha + rótulo do superset (aparecem no fim do loop) */}
                <motion.span
                    aria-hidden
                    className="absolute left-1.5 top-1.5 bottom-1.5 w-1 rounded-full bg-accent-superset"
                    initial={{ opacity: 0 }}
                    animate={bracketAnim}
                    transition={{ ...transition, times: bracketTimes }}
                />
                <motion.span
                    aria-hidden
                    className="absolute left-4 -top-2 z-10 bg-surface-card px-1.5 text-[10px] font-bold uppercase tracking-wide text-accent-superset"
                    initial={{ opacity: 0 }}
                    animate={bracketAnim}
                    transition={{ ...transition, times: bracketTimes }}
                >
                    Superset
                </motion.span>

                {/* Exercício 1 */}
                <div className="relative z-[1] flex items-center gap-3 rounded-xl border border-k-border-subtle bg-surface-inset px-3.5 py-3">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-glass-bg text-xs font-bold text-k-text-tertiary">1</span>
                    <div>
                        <div className="text-sm font-semibold text-k-text-primary">Supino reto</div>
                        <div className="text-[11px] text-k-text-tertiary">4 × 10 · 90s</div>
                    </div>
                </div>

                {/* Gap com o conector */}
                <div className="relative h-7">
                    <span className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-k-border-primary" />
                    <motion.span
                        className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-k-border-primary bg-surface-card px-2.5 py-1 text-[11px] font-medium text-k-text-secondary"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={connectAnim}
                        transition={{ ...transition, times: connectTimes }}
                    >
                        <Link2 className="h-3.5 w-3.5" />
                        Criar superset
                    </motion.span>
                    <motion.span
                        aria-hidden
                        className="absolute left-1/2 top-1/2 z-[3] text-k-text-primary"
                        initial={{ opacity: 0 }}
                        animate={cursorAnim}
                        transition={{ ...transition, times: cursorTimes }}
                    >
                        <MousePointer2 className="h-4 w-4" fill="currentColor" />
                    </motion.span>
                </div>

                {/* Exercício 2 */}
                <div className="relative z-[1] flex items-center gap-3 rounded-xl border border-k-border-subtle bg-surface-inset px-3.5 py-3">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-glass-bg text-xs font-bold text-k-text-tertiary">2</span>
                    <div>
                        <div className="text-sm font-semibold text-k-text-primary">Crucifixo</div>
                        <div className="text-[11px] text-k-text-tertiary">3 × 12 · 60s</div>
                    </div>
                </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-k-text-tertiary">
                Passe o mouse <span className="font-semibold text-k-text-secondary">entre dois exercícios</span> e clique em
                “Criar superset”. O mesmo gesto vira bi-set, tri-set e adiciona exercícios a um superset existente.
            </p>
        </div>
    )
}

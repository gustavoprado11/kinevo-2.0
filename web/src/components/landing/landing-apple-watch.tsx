'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Heart, Check, Timer, RefreshCw, Play, Dumbbell, X } from 'lucide-react'

/* ================================================================== */
/*  Watch screens — faithful to the real KinevoWatch app               */
/*  Theme: kinevoBg #0D0D17, kinevoCard #1A1A2E, violet #7C3AED        */
/* ================================================================== */

type Phase = 'ready' | 'execution' | 'completed' | 'rest'

const PHASE_DURATIONS_MS: Record<Phase, number> = {
    ready: 3000,
    execution: 3500,
    completed: 1200,
    rest: 4500,
}

const PHASE_ORDER: Phase[] = ['ready', 'execution', 'completed', 'rest']

function ReadyScreen() {
    return (
        <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-3.5"
        >
            <div className="w-full bg-[#1A1A2E] rounded-[20px] px-3 py-4 flex flex-col items-center">
                <Dumbbell className="w-8 h-8 text-[#7C3AED]" strokeWidth={2.5} />
                <p className="font-jakarta text-[15px] font-bold text-[#F1F5F9] mt-2.5 text-center">
                    Gustavo Prado
                </p>
                <p className="font-jakarta text-[11px] text-[#64748B] mt-1.5">5 exercícios</p>
                <div className="w-full mt-3 rounded-full bg-[#7C3AED] py-2 flex items-center justify-center gap-1.5">
                    <Play className="w-3 h-3 text-white fill-white" />
                    <span className="font-jakarta text-[12px] font-bold text-white">Iniciar</span>
                </div>
            </div>
        </motion.div>
    )
}

function ExecutionScreen() {
    return (
        <motion.div
            key="execution"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col px-3 pt-2 pb-2.5"
        >
            {/* Header row: exercise meta on left, set dots on right */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="font-jakarta text-[12px] font-bold text-[#F1F5F9] leading-tight truncate">
                        Agachamento Smith
                    </p>
                    <p className="font-jakarta text-[9px] text-[#64748B] mt-0.5">Anterior 80 × 8</p>
                    <p className="font-jakarta text-[9px] text-[#64748B]">Série 1/3</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full border border-[#7C3AED]" />
                    <div className="w-1.5 h-1.5 rounded-full border border-[#3F3F5C]" />
                    <div className="w-1.5 h-1.5 rounded-full border border-[#3F3F5C]" />
                </div>
            </div>

            {/* Weight + reps cards */}
            <div className="grid grid-cols-2 gap-1.5 mt-2 flex-1">
                {/* Carga (kg) — focused card with bright violet border */}
                <div className="relative bg-[#1A1A2E] rounded-2xl flex flex-col items-center justify-center px-2 py-1.5 border-[1.5px] border-[#7C3AED]">
                    <span className="absolute top-1 right-1.5 font-jakarta text-[7px] font-semibold text-[#A78BFA]">
                        10
                    </span>
                    <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="font-jakarta text-[22px] font-bold text-[#F1F5F9] tabular-nums leading-none"
                    >
                        80.0
                    </motion.span>
                    <span className="font-jakarta text-[8px] font-medium text-[#A1A1B8] mt-0.5">
                        Carga (kg)
                    </span>
                </div>
                {/* Reps */}
                <div className="bg-[#1A1A2E] rounded-2xl flex flex-col items-center justify-center px-2 py-1.5 border border-[#1A1A2E]">
                    <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="font-jakarta text-[22px] font-bold text-[#F1F5F9] tabular-nums leading-none"
                    >
                        8
                    </motion.span>
                    <span className="font-jakarta text-[8px] font-medium text-[#A78BFA] mt-0.5">
                        Meta: 8-10
                    </span>
                </div>
            </div>

            {/* Confirm button */}
            <div className="w-full mt-2 rounded-full bg-[#7C3AED] py-2 flex items-center justify-center">
                <span className="font-jakarta text-[11px] font-bold text-white">Concluir Série</span>
            </div>
        </motion.div>
    )
}

function CompletedScreen() {
    return (
        <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute inset-0 flex flex-col items-center justify-center px-3"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="w-12 h-12 rounded-full bg-[#7C3AED]/15 border-2 border-[#7C3AED] flex items-center justify-center"
            >
                <Check className="w-6 h-6 text-[#7C3AED]" strokeWidth={3.5} />
            </motion.div>
            <p className="font-jakarta text-[12px] font-bold text-[#F1F5F9] mt-2.5">
                Série concluída
            </p>
            <p className="font-jakarta text-[10px] text-[#64748B] mt-0.5 tabular-nums">80 kg × 8</p>
        </motion.div>
    )
}

function RestScreen({ active }: { active: boolean }) {
    const total = 90
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        if (!active) return
        const id = setInterval(() => {
            setElapsed((e) => e + 1)
        }, 1000)
        return () => {
            clearInterval(id)
            setElapsed(0)
        }
    }, [active])

    const secondsLeft = Math.max(0, total - elapsed)
    const radius = 36
    const circumference = 2 * Math.PI * radius
    const progress = secondsLeft / total
    const dashOffset = circumference * (1 - progress)

    return (
        <motion.div
            key="rest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col px-2.5 pt-2 pb-2.5"
        >
            {/* Top row: X close button + "Descanso" title */}
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#1A1A2E] flex items-center justify-center shrink-0">
                    <X className="w-2.5 h-2.5 text-[#A1A1B8]" strokeWidth={2.5} />
                </div>
                <p className="font-jakarta text-[14px] font-bold text-[#F1F5F9] flex-1 text-center -ml-5">
                    Descanso
                </p>
            </div>

            {/* Subtitle: exercise name */}
            <p className="font-jakarta text-[9px] text-[#A1A1B8] text-center mt-0.5">
                Agachamento Smith
            </p>

            {/* Ring + countdown */}
            <div className="flex-1 flex items-center justify-center">
                <div className="relative w-[88px] h-[88px]">
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
                        <circle cx="44" cy="44" r={radius} fill="none" stroke="#2A2A3E" strokeWidth="3" />
                        <motion.circle
                            cx="44"
                            cy="44"
                            r={radius}
                            fill="none"
                            stroke="#7C3AED"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            animate={{ strokeDashoffset: dashOffset }}
                            transition={{ duration: 0.9, ease: 'linear' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-jakarta text-[22px] font-bold text-[#F1F5F9] tabular-nums">
                            {secondsLeft}s
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom: status + skip button */}
            <p className="font-jakarta text-[9px] text-[#A1A1B8] text-center">
                Série 1 concluída
            </p>
            <div className="w-full mt-1.5 rounded-full bg-[#1A1A2E] py-1.5 flex items-center justify-center">
                <span className="font-jakarta text-[10px] font-semibold text-[#F1F5F9]">
                    Pular descanso
                </span>
            </div>
        </motion.div>
    )
}

/* ================================================================== */
/*  Watch frame                                                         */
/* ================================================================== */

export function WatchMockup() {
    const reducedMotion = useReducedMotion()
    const [phase, setPhase] = useState<Phase>('ready')

    useEffect(() => {
        if (reducedMotion) return
        const id = setTimeout(() => {
            const idx = PHASE_ORDER.indexOf(phase)
            const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]
            setPhase(next)
        }, PHASE_DURATIONS_MS[phase])
        return () => clearTimeout(id)
    }, [phase, reducedMotion])

    return (
        <div className="relative mx-auto w-[240px] md:w-[260px]">
            {/* Watch body */}
            <div className="relative aspect-[1/1.18] rounded-[44px] bg-gradient-to-b from-[#2a2a2e] to-[#0a0a0d] border border-white/5 p-2 shadow-[0_30px_80px_-20px_rgba(124,58,237,0.25)]">
                {/* Digital crown */}
                <div className="absolute right-[-5px] top-[28%] w-[5px] h-9 bg-[#1c1c20] rounded-r-md" />
                <div className="absolute right-[-3px] top-[44%] w-[4px] h-5 bg-[#1c1c20] rounded-r-sm" />

                {/* Screen */}
                <div className="relative w-full h-full rounded-[36px] bg-[#0D0D17] overflow-hidden">
                    {/* Status bar — only the time, like the real Watch screen */}
                    <div className="absolute top-1.5 right-3 z-10">
                        <span className="font-jakarta text-[10px] font-semibold text-[#7C3AED]">
                            10:57
                        </span>
                    </div>

                    {/* Screen content */}
                    <div className="absolute inset-0 pt-5">
                        <AnimatePresence mode="wait">
                            {phase === 'ready' && <ReadyScreen />}
                            {phase === 'execution' && <ExecutionScreen />}
                            {phase === 'completed' && <CompletedScreen />}
                            {phase === 'rest' && <RestScreen active={phase === 'rest'} />}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Main                                                                */
/* ================================================================== */

export function LandingAppleWatch() {
    const features = [
        {
            icon: Heart,
            label: 'Frequência cardíaca',
            detail: 'Acompanhamento em tempo real durante o treino.',
        },
        {
            icon: Check,
            label: 'Marcar série no pulso',
            detail: 'Um toque entre uma série e outra.',
        },
        {
            icon: Timer,
            label: 'Descanso com vibração',
            detail: 'Sente quando o tempo acaba, sem precisar olhar.',
        },
        {
            icon: RefreshCw,
            label: 'Tudo sincroniza',
            detail: 'O treino chega no Watch e os registros voltam pro app.',
        },
    ]

    return (
        <section
            id="apple-watch"
            className="relative bg-[#0D0D17] py-24 md:py-32 overflow-hidden scroll-mt-20"
        >
            {/* Subtle violet glow at top */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(124,58,237,0.10),transparent)]" />

            <div className="relative max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-14 md:mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7 }}
                    >
                        <span className="inline-flex items-center font-jakarta text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full text-[#A78BFA] bg-[#7C3AED]/15">
                            Apple Watch
                        </span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7, delay: 0.1 }}
                        className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-white mt-5 leading-[1.1]"
                    >
                        O treino{' '}
                        <span className="text-white/50">no pulso do seu aluno.</span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="font-jakarta text-base md:text-lg text-white/55 mt-5 max-w-2xl mx-auto leading-relaxed"
                    >
                        App nativo para Apple Watch. Seu aluno marca série, vê o tempo de descanso e acompanha a frequência cardíaca — sem precisar tirar o celular do bolso.
                    </motion.p>
                </div>

                {/* Main layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-5xl mx-auto">
                    {/* Watch */}
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.8 }}
                    >
                        <WatchMockup />
                    </motion.div>

                    {/* Features */}
                    <div className="space-y-3">
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.label}
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ delay: i * 0.08, duration: 0.4 }}
                                className="flex items-start gap-3.5 bg-white/[0.025] border border-white/[0.06] rounded-xl p-4"
                            >
                                <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/15 flex items-center justify-center shrink-0">
                                    <feature.icon className="w-4 h-4 text-[#A78BFA]" strokeWidth={2.2} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-jakarta text-sm font-semibold text-white/90">
                                        {feature.label}
                                    </p>
                                    <p className="font-jakarta text-[13px] text-white/45 mt-0.5 leading-snug">
                                        {feature.detail}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Seal */}
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="font-jakarta text-sm text-white/40 text-center mt-14 max-w-md mx-auto italic"
                >
                    Seu aluno treina sem precisar tirar o celular do bolso.
                </motion.p>
            </div>
        </section>
    )
}

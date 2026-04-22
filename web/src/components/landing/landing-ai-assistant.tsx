'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
    Eye,
    ClipboardEdit,
    MessageSquare,
    Sparkles,
    Flame,
    TrendingDown,
    BatteryLow,
    CalendarClock,
    Dumbbell,
    Check,
    ChevronRight,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Tab config                                                         */
/* ------------------------------------------------------------------ */

type TabId = 'monitor' | 'prescribe' | 'chat'

const tabs: { id: TabId; icon: typeof Eye; label: string; color: string; tagline: string; support: string }[] = [
    {
        id: 'monitor',
        icon: Eye,
        label: 'Monitoramento',
        color: '#007AFF',
        tagline: 'Vê antes de virar problema.',
        support: 'Alertas automáticos de gap, dor, carga e vencimento.',
    },
    {
        id: 'prescribe',
        icon: ClipboardEdit,
        label: 'Prescrição',
        color: '#7C3AED',
        tagline: 'Gera. Você aprova.',
        support: 'Prescrição com IA que aprende seu estilo.',
    },
    {
        id: 'chat',
        icon: MessageSquare,
        label: 'Copiloto',
        color: '#34C759',
        tagline: 'Pergunte. Resposta com dados.',
        support: 'Chat com contexto completo de qualquer aluno.',
    },
]

/* ------------------------------------------------------------------ */
/*  Mock — Monitoramento (fiel ao contextual-alerts.tsx real)         */
/* ------------------------------------------------------------------ */

function MonitorMock() {
    const alerts = [
        {
            Icon: Flame,
            tone: 'danger' as const,
            message: 'PSE média muito alta (9.2)',
            student: 'Maria S.',
            when: 'há 2h',
        },
        {
            Icon: TrendingDown,
            tone: 'danger' as const,
            message: 'Carga caiu 12% nos últimos treinos',
            student: 'Lucas O.',
            when: 'há 4h',
        },
        {
            Icon: BatteryLow,
            tone: 'warning' as const,
            message: 'Adesão abaixo de 70% nas últimas 2 semanas',
            student: 'Ana P.',
            when: 'há 6h',
        },
        {
            Icon: CalendarClock,
            tone: 'info' as const,
            message: 'Programa encerra em 5 dias',
            student: 'João M.',
            when: 'há 1d',
        },
    ]

    const toneStyles = {
        danger: { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-500' },
        warning: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-500' },
        info: { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-500' },
    }

    return (
        <div className="space-y-2">
            {alerts.map((a, i) => {
                const t = toneStyles[a.tone]
                return (
                    <motion.div
                        key={a.message}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.35 }}
                        className={`flex items-start gap-3 ${t.bg} border ${t.border} rounded-xl px-3.5 py-3`}
                    >
                        <div className="shrink-0 mt-0.5">
                            <a.Icon className={`w-4 h-4 ${t.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-jakarta text-[12px] font-semibold text-[#1D1D1F] leading-snug">
                                {a.message}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="font-jakarta text-[11px] text-[#6E6E73]">{a.student}</span>
                                <span className="text-[#D2D2D7]">·</span>
                                <span className="font-jakarta text-[11px] text-[#86868B]">{a.when}</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#AEAEB2] shrink-0 mt-0.5" />
                    </motion.div>
                )
            })}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Mock — Prescrição (fiel ao program-builder-client.tsx real)       */
/* ------------------------------------------------------------------ */

function PrescribeMock() {
    const workouts = [
        { day: 'Seg', name: 'Peito & Tríceps', exercises: 6, done: true },
        { day: 'Ter', name: 'Costas & Bíceps', exercises: 6, done: true },
        { day: 'Qui', name: 'Pernas', exercises: 7, done: false },
    ]

    return (
        <div className="space-y-3">
            {/* Program header */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="bg-white border border-[#E8E8ED] rounded-xl overflow-hidden"
            >
                <div className="px-4 py-3 border-b border-[#F2F2F5] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                            <Dumbbell className="w-3.5 h-3.5 text-[#7C3AED]" />
                        </div>
                        <div>
                            <p className="font-jakarta text-[12px] font-semibold text-[#1D1D1F]">Hipertrofia 4×</p>
                            <p className="font-jakarta text-[10px] text-[#86868B]">8 semanas · 3 treinos</p>
                        </div>
                    </div>
                </div>

                {workouts.map((w, i) => (
                    <motion.div
                        key={w.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.08 }}
                        className="px-4 py-2.5 flex items-center gap-3 border-b border-[#F2F2F5] last:border-0"
                    >
                        <span className="w-7 h-7 rounded-md bg-[#F5F5F7] flex items-center justify-center font-jakarta text-[10px] font-semibold text-[#6E6E73]">
                            {w.day}
                        </span>
                        <span className="font-jakarta text-[12px] text-[#1D1D1F] flex-1">{w.name}</span>
                        <span className="font-jakarta text-[10px] text-[#86868B]">{w.exercises} ex.</span>
                        {w.done ? (
                            <div className="w-4 h-4 rounded-full bg-[#34C759] flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </div>
                        ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
                        )}
                    </motion.div>
                ))}
            </motion.div>

            {/* AI pattern learned */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
                className="flex items-start gap-2.5 bg-[#7C3AED]/[0.04] border border-[#7C3AED]/15 rounded-xl px-3.5 py-3"
            >
                <Sparkles className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5" />
                <p className="font-jakarta text-[11px] text-[#4A4A4E] leading-snug">
                    <span className="text-[#7C3AED] font-semibold">Aprendi com suas edições</span>
                    <span className="text-[#6E6E73]"> — você prioriza posterior em 80% das prescrições.</span>
                </p>
            </motion.div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Mock — Copiloto (estilo assistant-chat do dashboard real)         */
/* ------------------------------------------------------------------ */

function ChatMock() {
    const messages: { from: 'user' | 'ai'; text: React.ReactNode }[] = [
        {
            from: 'user',
            text: 'Como está a progressão do Lucas nos últimos 30 dias?',
        },
        {
            from: 'ai',
            text: (
                <>
                    Progrediu em <strong className="text-[#1D1D1F]">7 de 12</strong> exercícios. Supino <strong className="text-[#34C759]">+5kg</strong>, Agachamento <strong className="text-[#34C759]">+8kg</strong>. Adesão de <strong className="text-[#1D1D1F]">92%</strong>.
                </>
            ),
        },
        {
            from: 'user',
            text: 'Gere um programa focado nos exercícios estagnados.',
        },
    ]

    const [resolved, setResolved] = useState(false)
    const reduced = useReducedMotion()

    useEffect(() => {
        if (reduced) {
            setResolved(true)
            return
        }
        setResolved(false)
        const t = setTimeout(() => setResolved(true), 1800)
        return () => clearTimeout(t)
    }, [reduced])

    return (
        <div className="space-y-2.5">
            {messages.map((m, i) =>
                m.from === 'user' ? (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.12, duration: 0.3 }}
                        className="flex justify-end"
                    >
                        <div className="max-w-[85%] bg-[#F5F5F7] border border-[#E8E8ED] rounded-2xl rounded-br-md px-3.5 py-2.5">
                            <p className="font-jakarta text-[12px] text-[#1D1D1F] leading-snug">{m.text}</p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.12, duration: 0.3 }}
                        className="flex items-start gap-2"
                    >
                        <div className="w-6 h-6 rounded-full bg-[#34C759]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-3 h-3 text-[#34C759]" />
                        </div>
                        <div className="max-w-[85%] bg-white border border-[#E8E8ED] rounded-2xl rounded-bl-md px-3.5 py-2.5">
                            <p className="font-jakarta text-[12px] text-[#4A4A4E] leading-relaxed">{m.text}</p>
                        </div>
                    </motion.div>
                ),
            )}

            {/* Typing / reply */}
            <AnimatePresence mode="wait">
                {!resolved ? (
                    <motion.div
                        key="typing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-2"
                    >
                        <div className="w-6 h-6 rounded-full bg-[#34C759]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-3 h-3 text-[#34C759]" />
                        </div>
                        <div className="bg-white border border-[#E8E8ED] rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="reply"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-start gap-2"
                    >
                        <div className="w-6 h-6 rounded-full bg-[#34C759]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-3 h-3 text-[#34C759]" />
                        </div>
                        <div className="max-w-[85%] bg-white border border-[#E8E8ED] rounded-2xl rounded-bl-md px-3.5 py-2.5">
                            <p className="font-jakarta text-[12px] text-[#4A4A4E] leading-relaxed">
                                Rascunho focando <strong className="text-[#1D1D1F]">supino inclinado</strong> e <strong className="text-[#1D1D1F]">remada curvada</strong>.{' '}
                                <span className="text-[#34C759] font-semibold">Revise antes de aplicar.</span>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export function LandingAiAssistant() {
    const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0)
    const [paused, setPaused] = useState(false)
    const reduced = useReducedMotion()
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const current = tabs[activeTab]

    const mocks: Record<TabId, React.ReactNode> = {
        monitor: <MonitorMock />,
        prescribe: <PrescribeMock />,
        chat: <ChatMock />,
    }

    useEffect(() => {
        if (reduced || paused) return
        intervalRef.current = setInterval(() => {
            setActiveTab((i) => ((i + 1) % tabs.length) as 0 | 1 | 2)
        }, 6000)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [paused, reduced])

    const handleTabClick = (i: 0 | 1 | 2) => {
        setActiveTab(i)
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (!reduced && !paused) {
            intervalRef.current = setInterval(() => {
                setActiveTab((j) => ((j + 1) % tabs.length) as 0 | 1 | 2)
            }, 6000)
        }
    }

    return (
        <section className="relative bg-[#FAFAFA] py-24 md:py-32 overflow-hidden border-t border-[#EDEDF0]">
            {/* Subtle colored wash at top to echo the active tab */}
            <motion.div
                className="absolute inset-x-0 top-0 h-64 pointer-events-none"
                animate={{
                    background: `radial-gradient(ellipse 70% 100% at 50% 0%, ${current.color}0D, transparent)`,
                }}
                transition={{ duration: 0.8 }}
            />

            <div className="relative mx-auto max-w-6xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-14 md:mb-20"
                >
                    <h2 className="font-jakarta text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#1D1D1F] leading-[1.05]">
                        Uma IA que entende{' '}
                        <span className="bg-gradient-to-r from-[#007AFF] via-[#7C3AED] to-[#34C759] bg-clip-text text-transparent">
                            cada aluno seu.
                        </span>
                    </h2>
                    <p className="font-jakarta text-base md:text-lg text-[#6E6E73] mt-5 max-w-xl mx-auto">
                        Alertas, prescrição e chat — com o contexto real do que acontece no seu treino.
                    </p>
                </motion.div>

                {/* Showcase grid */}
                <div
                    className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 md:gap-5"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    {/* Left — tabs + copy */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.5 }}
                        className="bg-white border border-[#E8E8ED] rounded-2xl p-7 md:p-10 flex flex-col"
                    >
                        {/* Tab pills */}
                        <div className="flex items-center gap-1.5 mb-8">
                            {tabs.map((tab, i) => {
                                const isActive = activeTab === i
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => handleTabClick(i as 0 | 1 | 2)}
                                        className={`relative flex items-center gap-1.5 font-jakarta text-[12px] font-semibold px-3 py-2 rounded-full transition-colors ${
                                            isActive ? '' : 'text-[#86868B] hover:text-[#6E6E73]'
                                        }`}
                                        style={isActive ? { color: tab.color } : undefined}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="ai-tab-pill"
                                                className="absolute inset-0 rounded-full"
                                                style={{
                                                    backgroundColor: `${tab.color}14`,
                                                    border: `1px solid ${tab.color}30`,
                                                }}
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className="relative flex items-center gap-1.5">
                                            <tab.icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Tagline + support */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.25 }}
                                className="flex-1 flex flex-col"
                            >
                                <h3 className="font-jakarta text-3xl md:text-4xl font-bold text-[#1D1D1F] leading-[1.1] tracking-tight">
                                    {current.tagline}
                                </h3>
                                <p className="font-jakarta text-base text-[#6E6E73] mt-4 max-w-md leading-relaxed">
                                    {current.support}
                                </p>

                                {/* Subtle footer pill — echoes the active feature */}
                                <div className="mt-auto pt-10">
                                    <div
                                        className="inline-flex items-center gap-2 font-jakarta text-[11px] font-semibold uppercase tracking-wider"
                                        style={{ color: current.color }}
                                    >
                                        <span className="flex h-1.5 w-1.5 relative">
                                            <span
                                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                                style={{ backgroundColor: current.color }}
                                            />
                                            <span
                                                className="relative inline-flex rounded-full h-1.5 w-1.5"
                                                style={{ backgroundColor: current.color }}
                                            />
                                        </span>
                                        Ao vivo no Kinevo
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>

                    {/* Right — real product mock */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="relative bg-white border border-[#E8E8ED] rounded-2xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)]"
                    >
                        {/* Top color accent line */}
                        <motion.div
                            className="absolute top-0 left-0 right-0 h-[2px]"
                            animate={{
                                background: `linear-gradient(90deg, transparent, ${current.color}, transparent)`,
                            }}
                            transition={{ duration: 0.5 }}
                        />

                        {/* Window chrome */}
                        <div className="px-5 py-3 border-b border-[#F2F2F5] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <current.icon
                                    className="w-4 h-4"
                                    style={{ color: current.color }}
                                />
                                <span className="font-jakarta text-[12px] font-semibold text-[#1D1D1F]">
                                    {current.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-[#E8E8ED]" />
                                <div className="w-2 h-2 rounded-full bg-[#E8E8ED]" />
                                <div className="w-2 h-2 rounded-full bg-[#E8E8ED]" />
                            </div>
                        </div>

                        {/* Mock body */}
                        <div className="p-5 md:p-6 min-h-[320px] bg-[#FBFBFD]">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={current.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {mocks[current.id]}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

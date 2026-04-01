'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles,
    Eye,
    ClipboardEdit,
    MessageSquare,
    Brain,
    Shield,
    Activity,
    BellRing,
    TrendingUp,
    Check,
    AlertTriangle,
    Dumbbell,
    ChevronRight,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Capability tabs — no agent names, just real features              */
/* ------------------------------------------------------------------ */

const tabs = [
    { id: 'monitor', icon: Eye, label: 'Monitoramento', color: '#007AFF' },
    { id: 'prescribe', icon: ClipboardEdit, label: 'Prescrição', color: '#7C3AED' },
    { id: 'chat', icon: MessageSquare, label: 'Copiloto', color: '#34C759' },
]

/* ------------------------------------------------------------------ */
/*  Visual demo components — UI mockups, minimal text                 */
/* ------------------------------------------------------------------ */

function MonitorDemo() {
    const insights = [
        { emoji: '🔴', label: 'Gap de treino', detail: 'Maria S.', value: '12 dias', color: '#FF3B30' },
        { emoji: '📈', label: 'Pronto pra progredir', detail: 'Lucas O.', value: 'Supino +5kg', color: '#34C759' },
        { emoji: '⚠️', label: 'Relato de dor', detail: 'Ana P.', value: 'Ombro', color: '#FF9500' },
        { emoji: '⏰', label: 'Programa vencendo', detail: 'João M.', value: '2 dias', color: '#007AFF' },
    ]
    return (
        <div className="space-y-2">
            {insights.map((item, i) => (
                <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.35 }}
                    className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2.5"
                >
                    <span className="text-base">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-jakarta text-[11px] font-semibold text-white/80 truncate">{item.label}</p>
                        <p className="font-jakarta text-[10px] text-white/30">{item.detail}</p>
                    </div>
                    <span className="font-jakarta text-[10px] font-bold shrink-0" style={{ color: item.color }}>
                        {item.value}
                    </span>
                </motion.div>
            ))}
        </div>
    )
}

function PrescribeDemo() {
    const workouts = [
        { letter: 'A', name: 'Peito / Tríceps', exercises: 6, status: 'ready' },
        { letter: 'B', name: 'Costas / Bíceps', exercises: 6, status: 'ready' },
        { letter: 'C', name: 'Pernas / Ombro', exercises: 7, status: 'generating' },
    ]
    return (
        <div className="space-y-2.5">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white/[0.03] border border-white/[0.05] rounded-lg overflow-hidden"
            >
                <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Dumbbell className="w-3 h-3 text-[#7C3AED]" />
                        <span className="font-jakarta text-[11px] font-semibold text-white/80">Programa — Hipertrofia 4x</span>
                    </div>
                    <span className="font-jakarta text-[9px] text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded">94%</span>
                </div>
                {workouts.map((w, i) => (
                    <motion.div
                        key={w.letter}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="px-3 py-2 flex items-center gap-2.5 border-b border-white/[0.03] last:border-0"
                    >
                        <span className="w-5 h-5 rounded bg-[#7C3AED]/10 flex items-center justify-center font-jakarta text-[9px] font-bold text-[#7C3AED]">
                            {w.letter}
                        </span>
                        <span className="font-jakarta text-[11px] text-white/60 flex-1">{w.name}</span>
                        <span className="font-jakarta text-[9px] text-white/25">{w.exercises} ex.</span>
                        {w.status === 'generating' ? (
                            <div className="w-3 h-3 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
                        ) : (
                            <Check className="w-3 h-3 text-[#34C759]" />
                        )}
                    </motion.div>
                ))}
            </motion.div>
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
                className="flex items-center gap-2.5 bg-[#7C3AED]/[0.06] border border-[#7C3AED]/10 rounded-lg px-3 py-2.5"
            >
                <Brain className="w-3.5 h-3.5 text-[#A855F7] shrink-0" />
                <p className="font-jakarta text-[10px] text-white/50">
                    <span className="text-[#A855F7] font-semibold">Padrão aprendido</span> — Você prioriza posterior em 80% das edições
                </p>
            </motion.div>
        </div>
    )
}

function ChatDemo() {
    const msgs = [
        { from: 'user', text: 'Como está a progressão do Lucas nos últimos 30 dias?' },
        { from: 'ai', text: 'Progrediu em 7/12 exercícios. Supino +5kg, Agachamento +8kg. Aderência: 92%.' },
        { from: 'user', text: 'Gere um programa focando nos estagnados' },
    ]
    return (
        <div className="space-y-2">
            {msgs.map((msg, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.3 }}
                    className={`rounded-lg px-3 py-2.5 ${
                        msg.from === 'user'
                            ? 'bg-white/[0.04] ml-6'
                            : 'bg-[#34C759]/[0.06] border border-[#34C759]/10 mr-6'
                    }`}
                >
                    {msg.from === 'ai' && (
                        <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="w-2.5 h-2.5 text-[#34C759]" />
                            <span className="font-jakarta text-[9px] font-bold text-[#34C759]">IA</span>
                        </div>
                    )}
                    <p className="font-jakarta text-[11px] text-white/60 leading-relaxed">{msg.text}</p>
                </motion.div>
            ))}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-[#34C759]/[0.06] border border-[#34C759]/10 rounded-lg px-3 py-2.5 mr-6 flex items-center gap-1.5"
            >
                <Sparkles className="w-2.5 h-2.5 text-[#34C759]" />
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </motion.div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function LandingAiAssistant() {
    const [activeTab, setActiveTab] = useState(0)
    const current = tabs[activeTab]

    const demos: Record<string, React.ReactNode> = {
        monitor: <MonitorDemo />,
        prescribe: <PrescribeDemo />,
        chat: <ChatDemo />,
    }

    const taglines: Record<string, string> = {
        monitor: 'Monitora cada aluno e alerta antes da desistência.',
        prescribe: 'Gera programas completos que aprendem o seu estilo.',
        chat: 'Converse sobre qualquer aluno com dados reais.',
    }

    const features: Record<string, string[]> = {
        monitor: [
            'Detecta gaps de treino e cargas estagnadas',
            'Alerta de relatos de dor nos check-ins',
            'Avisa quando o aluno está pronto pra progredir',
            'Notifica programas prestes a vencer',
        ],
        prescribe: [
            'Periodização real em 4 fases com motor de regras',
            'Respeita restrições médicas e equipamentos',
            'Aprende seu estilo após 10+ prescrições editadas',
            'Validação automática de volume e frequência',
        ],
        chat: [
            'Contexto completo do aluno em cada conversa',
            'Análise de progressão de carga e aderência',
            'Gera programas direto no chat',
            'Respostas baseadas em dados, não em templates',
        ],
    }

    return (
        <section className="relative bg-[#0A0A0B] py-24 md:py-36 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(124,58,237,0.1),transparent)]" />

            <div className="relative mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-4xl mx-auto mb-16 md:mb-20"
                >
                    <h2 className="font-jakarta text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]">
                        IA que trabalha{' '}
                        <span className="bg-gradient-to-r from-[#007AFF] via-[#7C3AED] to-[#34C759] bg-clip-text text-transparent">
                            com você.
                        </span>
                    </h2>
                    <p className="font-jakarta text-base md:text-lg text-white/35 mt-5 max-w-lg mx-auto">
                        Inteligência artificial integrada ao sistema para ajudar no seu dia a dia — sem substituir nenhuma decisão sua.
                    </p>
                </motion.div>

                {/* Bento showcase */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4 max-w-5xl mx-auto">
                    {/* Left — tab selector + feature list */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-50px' }}
                        transition={{ duration: 0.5 }}
                        className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 md:p-8"
                    >
                        {/* Tab pills */}
                        <div className="flex items-center gap-2 mb-8">
                            {tabs.map((tab, i) => {
                                const isActive = activeTab === i
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(i)}
                                        className={`relative flex items-center gap-1.5 font-jakarta text-xs font-semibold px-3 py-2 rounded-full transition-all duration-300 ${
                                            isActive ? 'text-white' : 'text-white/30 hover:text-white/50'
                                        }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="ai-tab"
                                                className="absolute inset-0 rounded-full"
                                                style={{ backgroundColor: `${tab.color}18`, border: `1px solid ${tab.color}30` }}
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className="relative flex items-center gap-1.5">
                                            <tab.icon className="w-3.5 h-3.5" style={isActive ? { color: tab.color } : undefined} />
                                            {tab.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Tagline */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25 }}
                            >
                                <h3 className="font-jakarta text-xl md:text-2xl font-bold text-white leading-snug">
                                    {taglines[current.id]}
                                </h3>

                                <ul className="mt-5 space-y-2.5">
                                    {features[current.id].map((feat, i) => (
                                        <motion.li
                                            key={feat}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.06, duration: 0.25 }}
                                            className="flex items-start gap-2"
                                        >
                                            <div
                                                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                                                style={{ backgroundColor: current.color }}
                                            />
                                            <span className="font-jakarta text-sm text-white/45">{feat}</span>
                                        </motion.li>
                                    ))}
                                </ul>
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>

                    {/* Right — visual demo */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-50px' }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="relative rounded-2xl border overflow-hidden"
                        style={{
                            borderColor: `${current.color}12`,
                            background: `linear-gradient(160deg, ${current.color}08, rgba(10,10,11,0.98) 60%)`,
                        }}
                    >
                        {/* Top glow */}
                        <div
                            className="absolute top-0 left-0 right-0 h-px"
                            style={{ background: `linear-gradient(90deg, transparent, ${current.color}30, transparent)` }}
                        />

                        <div className="p-5 md:p-6">
                            {/* Demo header */}
                            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-white/[0.04]">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: current.color }} />
                                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: current.color }} />
                                </span>
                                <span className="font-jakarta text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                                    {current.label}
                                </span>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={current.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {demos[current.id]}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* Bottom strip — 4 principles */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 max-w-3xl mx-auto"
                >
                    {[
                        { icon: Shield, text: 'Você aprova tudo' },
                        { icon: Brain, text: 'Aprende seu estilo' },
                        { icon: Activity, text: 'Dados reais' },
                        { icon: BellRing, text: 'Proativo' },
                    ].map((item) => (
                        <div key={item.text} className="flex items-center gap-2">
                            <item.icon className="w-4 h-4 text-white/15" />
                            <span className="font-jakarta text-xs text-white/25 font-medium">{item.text}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}

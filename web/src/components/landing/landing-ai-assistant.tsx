'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles,
    Eye,
    ClipboardEdit,
    MessageSquare,
    FileText,
    TrendingUp,
    AlertTriangle,
    Check,
    Brain,
    Shield,
    Zap,
    BellRing,
    Activity,
    ChevronRight,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Agent definitions                                                 */
/* ------------------------------------------------------------------ */

interface Agent {
    id: string
    name: string
    role: string
    tagline: string
    accentColor: string
    accentGlow: string
    icon: typeof Eye
}

const agents: Agent[] = [
    {
        id: 'vigil',
        name: 'Vigil',
        role: 'Monitoramento',
        tagline: 'Observa cada aluno. Alerta antes da desistência.',
        accentColor: '#007AFF',
        accentGlow: 'rgba(0, 122, 255, 0.15)',
        icon: Eye,
    },
    {
        id: 'forge',
        name: 'Forge',
        role: 'Prescrição',
        tagline: 'Gera programas que respeitam o seu estilo.',
        accentColor: '#7C3AED',
        accentGlow: 'rgba(124, 58, 237, 0.15)',
        icon: ClipboardEdit,
    },
    {
        id: 'pulse',
        name: 'Pulse',
        role: 'Copiloto',
        tagline: 'Converse com quem entende cada aluno.',
        accentColor: '#34C759',
        accentGlow: 'rgba(52, 199, 89, 0.15)',
        icon: MessageSquare,
    },
]

/* ------------------------------------------------------------------ */
/*  Visual mock components for each agent                             */
/* ------------------------------------------------------------------ */

function VigilDemo() {
    return (
        <div className="space-y-2.5">
            {[
                { emoji: '🔴', title: 'Gap de treino detectado', sub: 'Maria S. — 12 dias sem treinar', priority: 'Alta', color: '#FF3B30' },
                { emoji: '📈', title: 'Pronto pra progredir', sub: 'Lucas O. — Supino 3x no topo', priority: 'Média', color: '#34C759' },
                { emoji: '⚠️', title: 'Relato de desconforto', sub: 'Ana P. — "dor no ombro" no check-in', priority: 'Alta', color: '#FF9500' },
            ].map((item, i) => (
                <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12, duration: 0.4 }}
                    className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] transition-colors"
                >
                    <span className="text-lg shrink-0">{item.emoji}</span>
                    <div className="min-w-0 flex-1">
                        <p className="font-jakarta text-xs font-semibold text-white truncate">{item.title}</p>
                        <p className="font-jakarta text-[10px] text-white/40 truncate">{item.sub}</p>
                    </div>
                    <span
                        className="font-jakarta text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: item.color, backgroundColor: `${item.color}15` }}
                    >
                        {item.priority}
                    </span>
                </motion.div>
            ))}
        </div>
    )
}

function ForgeDemo() {
    return (
        <div className="space-y-3">
            {/* Program generated card */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4"
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center">
                        <ClipboardEdit className="w-3.5 h-3.5 text-[#A855F7]" />
                    </div>
                    <span className="font-jakarta text-xs font-semibold text-white">Programa gerado</span>
                    <span className="ml-auto font-jakarta text-[10px] text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full">94% confiança</span>
                </div>
                {['Treino A — Peito / Tríceps', 'Treino B — Costas / Bíceps', 'Treino C — Pernas / Ombro'].map((w, i) => (
                    <div key={w} className="flex items-center gap-2 py-1.5">
                        <div className="w-4 h-4 rounded bg-white/[0.06] flex items-center justify-center">
                            <span className="text-[9px] text-white/40 font-bold">{String.fromCharCode(65 + i)}</span>
                        </div>
                        <span className="font-jakarta text-[11px] text-white/60">{w}</span>
                    </div>
                ))}
            </motion.div>

            {/* Pattern learned */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex items-center gap-3 bg-[#7C3AED]/[0.08] border border-[#7C3AED]/10 rounded-xl px-4 py-3"
            >
                <Brain className="w-4 h-4 text-[#A855F7] shrink-0" />
                <div className="min-w-0">
                    <p className="font-jakarta text-[11px] font-semibold text-[#A855F7]">Padrão aprendido</p>
                    <p className="font-jakarta text-[10px] text-white/40">Você aumenta volume de posterior em 80% das edições</p>
                </div>
            </motion.div>
        </div>
    )
}

function PulseDemo() {
    const messages = [
        { from: 'user', text: 'Como está a progressão do Lucas nos últimos 30 dias?' },
        { from: 'ai', text: 'Lucas progrediu em 7/12 exercícios. Supino +5kg, Agachamento +8kg. Aderência: 92%. Sem relatos de dor.' },
        { from: 'user', text: 'Gere um programa novo focando nos exercícios estagnados' },
    ]
    return (
        <div className="space-y-2.5">
            {messages.map((msg, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.3 }}
                    className={`rounded-xl px-3.5 py-2.5 max-w-[90%] ${
                        msg.from === 'user'
                            ? 'bg-white/[0.06] ml-auto'
                            : 'bg-[#34C759]/[0.08] border border-[#34C759]/10'
                    }`}
                >
                    {msg.from === 'ai' && (
                        <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3 text-[#34C759]" />
                            <span className="font-jakarta text-[9px] font-semibold text-[#34C759]">Kinevo AI</span>
                        </div>
                    )}
                    <p className="font-jakarta text-[11px] text-white/70 leading-relaxed">{msg.text}</p>
                </motion.div>
            ))}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Agent orb — animated glow icon                                    */
/* ------------------------------------------------------------------ */

function AgentOrb({ agent, isActive }: { agent: Agent; isActive: boolean }) {
    return (
        <div className="relative">
            {/* Outer glow */}
            <motion.div
                animate={{
                    scale: isActive ? [1, 1.2, 1] : 1,
                    opacity: isActive ? [0.3, 0.6, 0.3] : 0.2,
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full blur-xl"
                style={{ backgroundColor: agent.accentGlow }}
            />
            {/* Inner orb */}
            <div
                className="relative w-12 h-12 rounded-full flex items-center justify-center border"
                style={{
                    backgroundColor: `${agent.accentColor}10`,
                    borderColor: `${agent.accentColor}25`,
                }}
            >
                <agent.icon className="w-5 h-5" style={{ color: agent.accentColor }} />
            </div>
            {/* Status dot */}
            {isActive && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: agent.accentColor }}
                    />
                    <span
                        className="relative inline-flex rounded-full h-3 w-3 border-2 border-[#0A0A0B]"
                        style={{ backgroundColor: agent.accentColor }}
                    />
                </span>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Capability cards (bottom bento)                                   */
/* ------------------------------------------------------------------ */

const capabilities = [
    {
        icon: Shield,
        title: 'Você aprova tudo',
        description: 'Cada programa é um rascunho. Nada chega ao aluno sem sua revisão.',
    },
    {
        icon: Brain,
        title: 'Aprende seu estilo',
        description: 'Analisa suas edições e adapta futuras sugestões ao seu método.',
    },
    {
        icon: Activity,
        title: 'Dados reais',
        description: 'Sugestões baseadas em cargas, aderência e histórico — não templates.',
    },
    {
        icon: BellRing,
        title: 'Proativo',
        description: 'Detecta problemas antes que virem desistência.',
    },
]

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function LandingAiAssistant() {
    const [activeAgent, setActiveAgent] = useState(0)
    const current = agents[activeAgent]

    const demoComponents: Record<string, React.ReactNode> = {
        vigil: <VigilDemo />,
        forge: <ForgeDemo />,
        pulse: <PulseDemo />,
    }

    return (
        <section className="relative bg-[#0A0A0B] py-24 md:py-32 overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(124,58,237,0.08),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_80%_100%,rgba(0,122,255,0.05),transparent)]" />

            <div className="relative mx-auto max-w-7xl px-6">
                {/* Header — minimal like salte */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <div className="inline-flex items-center gap-2 font-jakarta text-sm font-medium text-[#A855F7] bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-full px-4 py-2 mb-6">
                        <Sparkles className="w-4 h-4" />
                        Inteligência Artificial
                    </div>

                    <h2 className="font-jakarta text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.05]">
                        Agentes que observam,{'\n'}
                        <span className="bg-gradient-to-r from-[#007AFF] via-[#7C3AED] to-[#34C759] bg-clip-text text-transparent">
                            aprendem e agem.
                        </span>
                    </h2>

                    <p className="font-jakarta text-base md:text-lg text-white/40 mt-5 max-w-xl mx-auto">
                        Três agentes de IA trabalhando nos bastidores para que você foque no que faz melhor: treinar pessoas.
                    </p>
                </motion.div>

                {/* Agent selector — avatar row like salte */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                    className="flex items-center justify-center gap-6 md:gap-10 mb-12"
                >
                    {agents.map((agent, i) => (
                        <button
                            key={agent.id}
                            onClick={() => setActiveAgent(i)}
                            className="flex flex-col items-center gap-2.5 group"
                        >
                            <AgentOrb agent={agent} isActive={activeAgent === i} />
                            <div className="text-center">
                                <p className={`font-jakarta text-sm font-bold transition-colors ${
                                    activeAgent === i ? 'text-white' : 'text-white/30 group-hover:text-white/50'
                                }`}>
                                    {agent.name}
                                </p>
                                <p className={`font-jakarta text-[10px] transition-colors ${
                                    activeAgent === i ? 'text-white/50' : 'text-white/20'
                                }`}>
                                    {agent.role}
                                </p>
                            </div>
                            {/* Active indicator */}
                            <div
                                className={`h-0.5 w-8 rounded-full transition-all duration-300 ${
                                    activeAgent === i ? 'opacity-100' : 'opacity-0'
                                }`}
                                style={{ backgroundColor: agent.accentColor }}
                            />
                        </button>
                    ))}
                </motion.div>

                {/* Agent showcase — large card like salte */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={current.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="relative rounded-2xl border overflow-hidden max-w-4xl mx-auto"
                        style={{
                            borderColor: `${current.accentColor}15`,
                            background: `linear-gradient(135deg, ${current.accentGlow}, rgba(10,10,11,0.95) 50%)`,
                        }}
                    >
                        {/* Top glow bar */}
                        <div
                            className="absolute top-0 left-0 right-0 h-px"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${current.accentColor}40, transparent)`,
                            }}
                        />

                        <div className="flex flex-col md:flex-row">
                            {/* Left — info */}
                            <div className="flex-1 p-8 md:p-10">
                                <div className="flex items-center gap-3 mb-5">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${current.accentColor}15` }}
                                    >
                                        <current.icon className="w-4 h-4" style={{ color: current.accentColor }} />
                                    </div>
                                    <div>
                                        <span className="font-jakarta text-base font-bold text-white">{current.name}</span>
                                        <span
                                            className="ml-2 font-jakarta text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                            style={{
                                                color: current.accentColor,
                                                backgroundColor: `${current.accentColor}15`,
                                            }}
                                        >
                                            IA
                                        </span>
                                    </div>
                                </div>

                                <h3 className="font-jakarta text-2xl md:text-3xl font-bold text-white leading-tight">
                                    {current.tagline}
                                </h3>

                                {/* Agent-specific short features */}
                                <div className="mt-6 space-y-2.5">
                                    {current.id === 'vigil' && (
                                        <>
                                            <Feature text="Detecta gaps de treino e estagnação de carga" />
                                            <Feature text="Monitora relatos de dor em check-ins pós-treino" />
                                            <Feature text="Alerta de programas prestes a vencer" />
                                        </>
                                    )}
                                    {current.id === 'forge' && (
                                        <>
                                            <Feature text="Gera programas com periodização real em 4 fases" />
                                            <Feature text="Aprende seu estilo após 10+ prescrições editadas" />
                                            <Feature text="Motor de regras valida volume e frequência" />
                                        </>
                                    )}
                                    {current.id === 'pulse' && (
                                        <>
                                            <Feature text="Contexto completo do aluno em cada conversa" />
                                            <Feature text="Analisa progressão de carga e aderência" />
                                            <Feature text="Gera programas direto no chat com dados reais" />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right — live demo mock */}
                            <div className="flex-1 p-6 md:p-8 md:pl-0">
                                <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-white/[0.05] p-4 h-full">
                                    {/* Demo header */}
                                    <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/[0.05]">
                                        <span className="flex h-2 w-2 relative">
                                            <span
                                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                                style={{ backgroundColor: current.accentColor }}
                                            />
                                            <span
                                                className="relative inline-flex rounded-full h-2 w-2"
                                                style={{ backgroundColor: current.accentColor }}
                                            />
                                        </span>
                                        <span className="font-jakarta text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                                            {current.name} — Ativo agora
                                        </span>
                                    </div>

                                    {/* Demo content */}
                                    {demoComponents[current.id]}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Capability bento grid — bottom */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="mt-16"
                >
                    <p className="font-jakarta text-center text-sm font-semibold text-white/30 uppercase tracking-widest mb-8">
                        IA que trabalha com o treinador, não no lugar dele
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
                        {capabilities.map((cap, i) => (
                            <motion.div
                                key={cap.title}
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-20px' }}
                                transition={{ duration: 0.4, delay: i * 0.06 }}
                                className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.08] transition-all text-center"
                            >
                                <cap.icon className="w-5 h-5 text-[#A855F7]/60 mx-auto mb-3" />
                                <p className="font-jakarta text-xs font-bold text-white/80">{cap.title}</p>
                                <p className="font-jakarta text-[10px] text-white/30 mt-1 leading-relaxed">{cap.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                     */
/* ------------------------------------------------------------------ */

function Feature({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
            <span className="font-jakarta text-sm text-white/50">{text}</span>
        </div>
    )
}

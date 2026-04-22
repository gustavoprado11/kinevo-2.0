'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
    ArrowRight,
    Play,
    Sparkles,
    LayoutDashboard,
    Users,
    MessageCircle,
    FileText,
    Wallet,
    Calendar,
    Dumbbell,
    Settings,
    ChevronRight,
    Search,
    Bell,
    UserPlus,
    ClipboardList,
    Monitor,
    Activity,
    Target,
    Eye,
    Send,
    X,
} from 'lucide-react'

/* ================================================================== */
/*  Dashboard Replica — pixel-perfect, embedded in hero browser frame  */
/* ================================================================== */

type HeroScene = 'overview' | 'assistant-acting'

/* Sidebar */
function DashSidebar() {
    return (
        <div className="w-[200px] shrink-0 bg-white border-r border-[#E8E8ED] flex flex-col h-full">
            <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold text-[10px]">K</span>
                </div>
                <span className="font-jakarta text-sm font-bold text-[#1D1D1F]">Kinevo</span>
            </div>
            <nav className="flex-1 px-2 py-1 space-y-0.5">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#007AFF]/10 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#007AFF] rounded-r" />
                    <LayoutDashboard className="w-[15px] h-[15px] text-[#007AFF]" strokeWidth={1.5} />
                    <span className="font-jakarta text-xs font-medium text-[#007AFF]">Dashboard</span>
                </div>
                {[
                    { icon: Users, label: 'Alunos' },
                    { icon: MessageCircle, label: 'Mensagens' },
                    { icon: FileText, label: 'Avaliações' },
                    { icon: Wallet, label: 'Financeiro' },
                ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                        <item.icon className="w-[15px] h-[15px] text-[#6E6E73]" strokeWidth={1.5} />
                        <span className="font-jakarta text-xs text-[#6E6E73]">{item.label}</span>
                    </div>
                ))}
                <div className="pt-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <ChevronRight className="w-3 h-3 text-[#AEAEB2] rotate-90" strokeWidth={1.5} />
                        <span className="font-jakarta text-[10px] font-semibold uppercase tracking-wider text-[#AEAEB2]">Biblioteca</span>
                    </div>
                    <div className="ml-2 space-y-0.5">
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                            <Calendar className="w-[15px] h-[15px] text-[#6E6E73]" strokeWidth={1.5} />
                            <span className="font-jakarta text-xs text-[#6E6E73]">Programas</span>
                        </div>
                        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                            <Dumbbell className="w-[15px] h-[15px] text-[#6E6E73]" strokeWidth={1.5} />
                            <span className="font-jakarta text-xs text-[#6E6E73]">Exercícios</span>
                        </div>
                    </div>
                </div>
            </nav>
            <div className="px-2 pb-3 space-y-0.5 border-t border-[#E8E8ED] pt-2">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                    <Settings className="w-[15px] h-[15px] text-[#6E6E73]" strokeWidth={1.5} />
                    <span className="font-jakarta text-xs text-[#6E6E73]">Configurações</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">GC</span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-jakarta text-[11px] font-medium text-[#1D1D1F] truncate">Gustavo Costa</p>
                        <p className="font-jakarta text-[9px] text-[#86868B] truncate">gustavo@kinevo.com</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* Header */
function DashHeader({ assistantOpen, glowing }: { assistantOpen: boolean; glowing: boolean }) {
    return (
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <div>
                <h2 className="font-jakarta text-[22px] font-light tracking-tight text-[#1D1D1F]">Boa tarde, Gustavo</h2>
                <p className="font-jakarta text-[11px] text-[#86868B] mt-0.5">Sábado, 28 de março</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 border border-[#D2D2D7] rounded-xl px-3 py-1.5 bg-white">
                    <Search className="w-3.5 h-3.5 text-[#86868B]" strokeWidth={1.5} />
                    <span className="font-jakarta text-[11px] text-[#86868B]">Buscar</span>
                    <span className="font-jakarta text-[9px] text-[#AEAEB2] bg-[#F5F5F7] px-1.5 py-0.5 rounded ml-3">⌘K</span>
                </div>
                <div className="w-8 h-8 rounded-xl border border-[#D2D2D7] bg-white flex items-center justify-center">
                    <Bell className="w-3.5 h-3.5 text-[#6E6E73]" strokeWidth={1.5} />
                </div>
                <div
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-500 ${
                        assistantOpen
                            ? 'border-violet-400 bg-violet-100 text-violet-700'
                            : 'border-violet-200 bg-violet-50 text-violet-700'
                    }`}
                >
                    {glowing && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: [0, 0.7, 0], scale: [0.9, 1.15, 1.2] }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className="absolute inset-0 rounded-xl border-2 border-violet-400 pointer-events-none"
                        />
                    )}
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="font-jakarta text-[11px] font-semibold">Assistente</span>
                </div>
            </div>
        </div>
    )
}

/* Quick Actions */
function DashQuickActions() {
    const actions = [
        { icon: UserPlus, label: 'Novo aluno', color: '#007AFF', bg: 'bg-blue-50' },
        { icon: Dumbbell, label: 'Novo programa', color: '#7C3AED', bg: 'bg-violet-50' },
        { icon: ClipboardList, label: 'Enviar avaliação', color: '#14B8A6', bg: 'bg-teal-50' },
        { icon: Monitor, label: 'Sala de Treino', color: '#34C759', bg: 'bg-emerald-50' },
        { icon: Wallet, label: 'Vender plano', color: '#FF9500', bg: 'bg-amber-50' },
    ]
    return (
        <div className="flex items-center gap-2 px-6 pb-4">
            {actions.map((a) => (
                <div key={a.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D2D2D7] bg-white shadow-sm">
                    <div className={`w-6 h-6 rounded-lg ${a.bg} flex items-center justify-center`}>
                        <a.icon className="w-3 h-3" style={{ color: a.color }} strokeWidth={1.5} />
                    </div>
                    <span className="font-jakarta text-[10px] font-medium text-[#1D1D1F]">{a.label}</span>
                </div>
            ))}
        </div>
    )
}

/* Stat Cards */
function DashStatCards() {
    return (
        <div className="grid grid-cols-4 gap-3 px-6 pb-4">
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Users className="w-3 h-3 text-[#007AFF]" strokeWidth={1.5} />
                    </div>
                    <span className="font-jakarta text-[9px] font-medium uppercase tracking-wide text-[#86868B]">Alunos ativos</span>
                </div>
                <p className="font-jakarta text-2xl font-bold text-[#1D1D1F] mt-2">6</p>
                <span className="font-jakarta text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1 inline-block">+2</span>
            </div>
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                        <Activity className="w-3 h-3 text-[#7C3AED]" strokeWidth={1.5} />
                    </div>
                    <span className="font-jakarta text-[9px] font-medium uppercase tracking-wide text-[#86868B]">Treinos esta semana</span>
                </div>
                <p className="font-jakarta text-2xl font-bold text-[#1D1D1F] mt-2">14<span className="text-[#86868B] text-base font-normal">/27</span></p>
                <div className="w-full h-1 bg-[#F0F0F5] rounded-full mt-2">
                    <div className="h-1 bg-[#007AFF] rounded-full" style={{ width: '52%' }} />
                </div>
            </div>
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Eye className="w-3 h-3 text-[#34C759]" strokeWidth={1.5} />
                    </div>
                    <span className="font-jakarta text-[9px] font-medium uppercase tracking-wide text-[#86868B]">Receita mensal</span>
                </div>
                <p className="font-jakarta text-2xl font-bold text-[#1D1D1F] mt-2">R$ 4.790</p>
                <span className="font-jakarta text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full mt-1 inline-block">+12%</span>
            </div>
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Target className="w-3 h-3 text-[#FF9500]" strokeWidth={1.5} />
                    </div>
                    <span className="font-jakarta text-[9px] font-medium uppercase tracking-wide text-[#86868B]">Aderência geral</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <p className="font-jakarta text-2xl font-bold text-[#1D1D1F]">60%</p>
                    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
                        <circle cx="16" cy="16" r="13" fill="none" stroke="#F0F0F5" strokeWidth="3" />
                        <circle cx="16" cy="16" r="13" fill="none" stroke="#FF9500" strokeWidth="3"
                            strokeDasharray={`${0.6 * 81.68} ${0.4 * 81.68}`}
                            strokeDashoffset="20.42" strokeLinecap="round"
                            transform="rotate(-90 16 16)"
                        />
                    </svg>
                </div>
            </div>
        </div>
    )
}

/* Widgets */
function DashWidgets() {
    return (
        <div className="grid grid-cols-2 gap-3 px-6 pb-4">
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" strokeWidth={1.5} />
                    <span className="font-jakarta text-xs font-semibold text-[#1D1D1F]">Assistente Kinevo</span>
                </div>
                <div className="space-y-2">
                    <div className="flex items-start gap-2 bg-red-50/60 rounded-lg px-2.5 py-2">
                        <span className="text-[10px] mt-0.5">🔴</span>
                        <div>
                            <p className="font-jakarta text-[10px] font-semibold text-[#1D1D1F]">Matheus Henrique sem treinar</p>
                            <p className="font-jakarta text-[9px] text-[#86868B]">Nenhum treino registrado há 14 dias</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50/60 rounded-lg px-2.5 py-2">
                        <span className="text-[10px] mt-0.5">⚠️</span>
                        <div>
                            <p className="font-jakarta text-[10px] font-semibold text-[#1D1D1F]">2 programas encerrando</p>
                            <p className="font-jakarta text-[9px] text-[#86868B]">Raquel e Pedro vencem em 3 dias</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="rounded-xl border border-[#D2D2D7] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-3.5 h-3.5 text-[#007AFF]" strokeWidth={1.5} />
                    <span className="font-jakarta text-xs font-semibold text-[#1D1D1F]">Programas encerrando</span>
                </div>
                <div className="space-y-2">
                    {[
                        { name: 'Raquel Souza', program: 'Hipertrofia 3x', days: '2 dias' },
                        { name: 'Pedro Lima', program: 'Funcional 4x', days: '3 dias' },
                    ].map((item) => (
                        <div key={item.name} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#F5F5F7]">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                                <span className="text-white text-[8px] font-bold">{item.name.split(' ').map(n => n[0]).join('')}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-jakarta text-[10px] font-semibold text-[#1D1D1F] truncate">{item.name}</p>
                                <p className="font-jakarta text-[9px] text-[#86868B]">{item.program}</p>
                            </div>
                            <span className="font-jakarta text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{item.days}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* Assistant Panel — adds typing + final reply for scene 2 */
function AssistantPanel({ open, scene }: { open: boolean; scene: HeroScene }) {
    const acting = scene === 'assistant-acting'
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    className="absolute top-0 right-0 bottom-0 w-[280px] bg-white border-l border-[#E8E8ED] flex flex-col z-10"
                >
                    <div className="px-4 pt-4 pb-3 border-b border-[#E8E8ED] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-600" strokeWidth={1.5} />
                            <span className="font-jakarta text-sm font-bold text-[#1D1D1F]">Kinevo</span>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-[#F5F5F7] flex items-center justify-center">
                            <X className="w-3 h-3 text-[#6E6E73]" strokeWidth={1.5} />
                        </div>
                    </div>
                    <div className="flex border-b border-[#E8E8ED]">
                        <div className="flex-1 text-center py-2.5 border-b-2 border-violet-600">
                            <span className="font-jakarta text-[11px] font-semibold text-violet-700 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Assistente
                            </span>
                        </div>
                        <div className="flex-1 text-center py-2.5">
                            <span className="font-jakarta text-[11px] text-[#86868B] flex items-center justify-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                Mensagens
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden px-4 pt-4 space-y-3">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                        >
                            <div className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Sparkles className="w-3 h-3 text-violet-600" />
                                </div>
                                <div className="bg-[#F5F5F7] rounded-2xl rounded-bl-md px-3 py-2.5 max-w-[90%]">
                                    <p className="font-jakarta text-[11px] text-[#1D1D1F] leading-relaxed">
                                        Vi que <span className="font-semibold">Matheus Henrique</span> ainda não realizou nenhum treino. Como posso ajudar?
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.4 }}
                            className="flex flex-wrap gap-1.5 ml-8"
                        >
                            {['Sugerir mensagem de follow-up', 'Analisar histórico do aluno'].map((chip) => (
                                <div key={chip} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-violet-200 bg-violet-50">
                                    <ChevronRight className="w-2.5 h-2.5 text-violet-600" />
                                    <span className="font-jakarta text-[9px] font-medium text-violet-700">{chip}</span>
                                </div>
                            ))}
                        </motion.div>

                        {/* Scene 2 — typing + final reply */}
                        <AnimatePresence>
                            {acting && (
                                <>
                                    <motion.div
                                        key="typing"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-start gap-2"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Sparkles className="w-3 h-3 text-violet-600" />
                                        </div>
                                        <div className="bg-[#F5F5F7] rounded-2xl rounded-bl-md px-3 py-2.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        key="reply"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.35, delay: 1 }}
                                        className="flex items-start gap-2"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Sparkles className="w-3 h-3 text-violet-600" />
                                        </div>
                                        <div className="bg-violet-50 border border-violet-100 rounded-2xl rounded-bl-md px-3 py-2.5 max-w-[90%]">
                                            <p className="font-jakarta text-[11px] text-[#1D1D1F] leading-relaxed">
                                                Rascunhei uma mensagem empática lembrando do treino de hoje. <span className="font-semibold text-violet-700">Revise antes de enviar.</span>
                                            </p>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="px-3 pb-3 pt-2">
                        <div className="flex items-center gap-2 border border-[#D2D2D7] rounded-full px-3.5 py-2 bg-white">
                            <span className="font-jakarta text-[10px] text-[#AEAEB2] flex-1">Pergunte sobre seus alunos...</span>
                            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center">
                                <Send className="w-3 h-3 text-white" strokeWidth={1.5} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/* Assembled dashboard with auto-play scene cycle */
function DashboardReplica({ paused }: { paused: boolean }) {
    const [scene, setScene] = useState<HeroScene>('overview')
    const [assistantOpen, setAssistantOpen] = useState(false)
    const [glowing, setGlowing] = useState(false)
    const reducedMotion = useReducedMotion()

    useEffect(() => {
        if (reducedMotion) return
        if (paused) return

        let cancelled = false
        const timers: ReturnType<typeof setTimeout>[] = []

        const cycle = () => {
            if (cancelled) return
            setScene('overview')
            setAssistantOpen(false)
            setGlowing(false)

            timers.push(setTimeout(() => { if (!cancelled) setGlowing(true) }, 3000))
            timers.push(setTimeout(() => {
                if (cancelled) return
                setGlowing(false)
                setAssistantOpen(true)
                setScene('assistant-acting')
            }, 4500))
            timers.push(setTimeout(cycle, 9000))
        }
        cycle()

        return () => {
            cancelled = true
            timers.forEach(clearTimeout)
        }
    }, [paused, reducedMotion])

    return (
        <div className="relative bg-[#F5F5F7] overflow-hidden" style={{ height: 520 }}>
            <div className="flex h-full">
                <DashSidebar />
                <div className="flex-1 overflow-hidden relative">
                    <motion.div
                        animate={{ marginRight: assistantOpen ? 280 : 0 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="h-full overflow-y-auto"
                    >
                        <DashHeader assistantOpen={assistantOpen} glowing={glowing} />
                        <DashQuickActions />
                        <DashStatCards />
                        <DashWidgets />
                    </motion.div>
                    <AssistantPanel open={assistantOpen} scene={scene} />
                </div>
            </div>
        </div>
    )
}

/* ================================================================== */
/*  Hero Section                                                       */
/* ================================================================== */

export function LandingHero() {
    const [showDashboard, setShowDashboard] = useState(false)
    const [paused, setPaused] = useState(false)
    const reducedMotion = useReducedMotion()

    return (
        <section className="relative min-h-screen flex flex-col items-center pt-28 pb-12 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-[#FAFAFA]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.1),transparent)]" />
            <div className="absolute inset-0 grain-overlay" />
            {reducedMotion ? (
                <>
                    <div className="absolute top-1/4 -left-40 w-96 h-96 bg-[#7C3AED]/[0.06] rounded-full blur-3xl" />
                    <div className="absolute bottom-1/3 -right-40 w-80 h-80 bg-[#A855F7]/[0.06] rounded-full blur-3xl" />
                </>
            ) : (
                <>
                    <motion.div
                        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute top-1/4 -left-40 w-96 h-96 bg-[#7C3AED]/[0.06] rounded-full blur-3xl"
                    />
                    <motion.div
                        animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
                        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                        className="absolute bottom-1/3 -right-40 w-80 h-80 bg-[#A855F7]/[0.06] rounded-full blur-3xl"
                    />
                </>
            )}

            <div className="relative mx-auto max-w-5xl px-6 w-full text-center">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <span className="inline-flex items-center gap-2 font-jakarta text-xs font-medium text-[#7C3AED] bg-white border border-[#7C3AED]/15 rounded-full px-3.5 py-1.5 shadow-sm">
                        <span className="flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C3AED] opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#7C3AED]" />
                        </span>
                        Em uso por personal trainers no Brasil
                    </span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.08 }}
                    className="font-jakarta text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#1D1D1F] mt-6"
                >
                    Tudo que o personal moderno precisa
                    <br />
                    <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                        em um só lugar.
                    </span>
                </motion.h1>

                {/* Sub */}
                <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.18 }}
                    className="font-jakarta text-lg text-[#6E6E73] mt-5 max-w-xl mx-auto"
                >
                    <strong className="font-semibold text-[#1D1D1F]">Prescreva</strong> programas com IA,{' '}
                    <strong className="font-semibold text-[#1D1D1F]">acompanhe</strong> cada treino em tempo real e seu aluno treina no{' '}
                    <strong className="font-semibold text-[#1D1D1F]">iPhone</strong>, no{' '}
                    <strong className="font-semibold text-[#1D1D1F]">Android</strong> e até no{' '}
                    <strong className="font-semibold text-[#1D1D1F]">Apple Watch</strong>.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.28 }}
                    className="mt-8 flex items-center justify-center gap-3"
                >
                    <Link
                        href="/signup"
                        className="shimmer-btn group inline-flex items-center gap-2 bg-[#1D1D1F] hover:bg-black text-white font-semibold text-sm rounded-full px-6 py-3 shadow-lg shadow-black/10 font-jakarta transition-all"
                    >
                        Comece grátis
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <a
                        href="#como-funciona"
                        className="group inline-flex items-center gap-2 bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold text-sm rounded-full px-6 py-3 border border-[#D2D2D7] shadow-sm font-jakarta transition-all"
                    >
                        <Play className="w-3.5 h-3.5 text-[#7C3AED] fill-[#7C3AED]" />
                        Como funciona
                    </a>
                </motion.div>

                {/* Microcopy */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="font-jakarta text-[#6E6E73] text-xs mt-5"
                >
                    <strong className="font-semibold text-[#1D1D1F]">7 dias grátis</strong>
                    {' • '}
                    <strong className="font-semibold text-[#1D1D1F]">cancele quando quiser</strong>
                    {' • comece em 2 minutos'}
                </motion.p>
            </div>

            {/* Product mockup — interactive dashboard replica */}
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                onAnimationComplete={() => setShowDashboard(true)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className="relative mt-12 w-full max-w-6xl mx-auto px-6"
            >
                {/* Glow */}
                <div className="absolute inset-x-0 top-8 bottom-0 bg-gradient-to-b from-[#7C3AED]/8 via-[#7C3AED]/3 to-transparent rounded-3xl blur-2xl -z-10" />

                {/* Browser frame */}
                <div className="relative rounded-xl overflow-hidden border border-black/[0.08] shadow-2xl shadow-black/10 bg-white">
                    {/* Chrome bar */}
                    <div className="bg-[#F8F8FA] border-b border-black/[0.04] px-4 py-2.5 flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                        </div>
                        <div className="flex-1 flex justify-center">
                            <div className="bg-white/80 rounded-md px-4 py-1 border border-black/[0.04] inline-flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
                                <span className="font-jakarta text-[10px] text-[#6E6E73]">app.kinevo.com.br/dashboard</span>
                            </div>
                        </div>
                        <div className="w-16" />
                    </div>

                    {/* Dashboard replica */}
                    {showDashboard ? (
                        <DashboardReplica paused={paused} />
                    ) : (
                        <div className="bg-[#F5F5F7] hero-skeleton" style={{ height: 520 }} />
                    )}
                </div>
            </motion.div>
        </section>
    )
}

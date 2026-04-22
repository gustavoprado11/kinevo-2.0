'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Timer,
    Dumbbell,
    Bell,
    Calendar,
    Smartphone,
    WifiOff,
    Share2,
    Trophy,
    Heart,
    Check,
    RefreshCw,
} from 'lucide-react'
import { WatchMockup } from '@/components/landing/landing-apple-watch'

/* ================================================================== */
/*  Para o seu aluno                                                    */
/*  Header único + tabs (No celular | No Apple Watch).                  */
/*  - Celular: pílulas de features + mockup grande                      */
/*  - Watch: card escuro com mock animado + features                    */
/* ================================================================== */

type Tab = 'celular' | 'watch'

const phoneFeatures = [
    { icon: Timer, label: 'Timer inteligente' },
    { icon: Dumbbell, label: 'Cargas automáticas' },
    { icon: Bell, label: 'Push notifications' },
    { icon: Calendar, label: 'Calendário visual' },
    { icon: Smartphone, label: 'Live Activity' },
    { icon: WifiOff, label: 'Modo offline' },
    { icon: Share2, label: 'Cards p/ Stories' },
    { icon: Trophy, label: 'Recordes pessoais' },
]

const watchFeatures = [
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

function PhonePanel() {
    return (
        <div>
            {/* Pílulas de features */}
            <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto mb-12">
                {phoneFeatures.map((f, i) => (
                    <motion.div
                        key={f.label}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04, duration: 0.3 }}
                        className="inline-flex items-center gap-2 bg-[#F5F5F7] rounded-full px-4 py-2"
                    >
                        <f.icon className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span className="font-jakarta text-xs font-medium text-[#1D1D1F]">
                            {f.label}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Mock grande */}
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative max-w-3xl mx-auto"
            >
                <div className="absolute inset-0 -inset-y-8 bg-gradient-to-b from-[#7C3AED]/8 to-transparent rounded-3xl blur-2xl -z-10" />
                <Image
                    src="/747shots_so.png"
                    alt="Kinevo — app do aluno em 3 iPhones"
                    width={1920}
                    height={1080}
                    className="w-full h-auto"
                />
            </motion.div>

            <p className="font-jakarta text-sm text-[#86868B] text-center mt-8 max-w-md mx-auto">
                5 templates de cards para Stories. Cada post é marketing gratuito para você.
            </p>
        </div>
    )
}

function WatchPanel() {
    return (
        <div className="relative bg-[#0D0D17] rounded-3xl overflow-hidden">
            {/* Glow violeta no topo */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(124,58,237,0.10),transparent)]" />

            <div className="relative max-w-5xl mx-auto px-6 md:px-10 py-14 md:py-16">
                {/* Mock + features */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <WatchMockup />
                    </motion.div>

                    <div className="space-y-3">
                        {watchFeatures.map((feature, i) => (
                            <motion.div
                                key={feature.label}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
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

                <p className="font-jakarta text-sm text-white/40 text-center mt-12 max-w-md mx-auto italic">
                    Seu aluno treina sem precisar tirar o celular do bolso.
                </p>
            </div>
        </div>
    )
}

export function LandingParaAluno() {
    const [tab, setTab] = useState<Tab>('celular')

    return (
        <section
            id="para-aluno"
            className="relative bg-white py-24 md:py-32 overflow-hidden scroll-mt-20"
        >
            <div className="mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-2xl mx-auto mb-10"
                >
                    <span className="font-jakarta text-xs font-semibold uppercase tracking-widest text-[#7C3AED]">
                        Para o seu aluno
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-3">
                        Uma experiência{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            premium
                        </span>{' '}
                        no celular e no pulso.
                    </h2>
                    <p className="font-jakarta text-base md:text-lg text-[#6E6E73] mt-5 max-w-xl mx-auto leading-relaxed">
                        O treino chega no app, é executado com timer e cargas automáticas, e
                        sincroniza com o Apple Watch — sem precisar tirar o celular do bolso.
                    </p>
                </motion.div>

                {/* Tabs */}
                <div className="flex justify-center mb-12">
                    <div className="inline-flex items-center bg-[#F5F5F7] rounded-full p-1">
                        <button
                            onClick={() => setTab('celular')}
                            className={`relative font-jakarta text-sm font-semibold px-5 py-2 rounded-full transition-colors ${
                                tab === 'celular'
                                    ? 'text-white'
                                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                            }`}
                        >
                            {tab === 'celular' && (
                                <motion.span
                                    layoutId="para-aluno-tab"
                                    className="absolute inset-0 bg-[#1D1D1F] rounded-full"
                                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                />
                            )}
                            <span className="relative inline-flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5" />
                                No celular
                            </span>
                        </button>
                        <button
                            onClick={() => setTab('watch')}
                            className={`relative font-jakarta text-sm font-semibold px-5 py-2 rounded-full transition-colors ${
                                tab === 'watch'
                                    ? 'text-white'
                                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                            }`}
                        >
                            {tab === 'watch' && (
                                <motion.span
                                    layoutId="para-aluno-tab"
                                    className="absolute inset-0 bg-[#1D1D1F] rounded-full"
                                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                />
                            )}
                            <span className="relative">No Apple Watch</span>
                        </button>
                    </div>
                </div>

                {/* Painel ativo */}
                <AnimatePresence mode="wait">
                    {tab === 'celular' ? (
                        <motion.div
                            key="celular"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.35 }}
                        >
                            <PhonePanel />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="watch"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.35 }}
                        >
                            <WatchPanel />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { m, AnimatePresence } from 'framer-motion'
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
import { IOS_APP_URL, ANDROID_APP_URL } from '@/lib/constants/app-links'

/* Badges de download das lojas — usados no fim da seção "App do Aluno". */
function StoreBadges() {
    return (
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <a
                href={IOS_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Baixar na App Store"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#1D1D1F] px-5 py-3 text-white transition-transform hover:-translate-y-0.5"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0" aria-hidden="true">
                    <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.95-.03-.01-2.72-1.04-2.75-4.12zM14.53 4.42c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.33-.58 3.05-1.45z" />
                </svg>
                <span className="flex flex-col leading-none text-left">
                    <span className="font-jakarta text-[10px] font-medium text-white/70">Baixar na</span>
                    <span className="font-jakarta text-base font-bold">App Store</span>
                </span>
            </a>
            <a
                href={ANDROID_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Disponível no Google Play"
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#1D1D1F] px-5 py-3 text-white transition-transform hover:-translate-y-0.5"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 shrink-0" aria-hidden="true">
                    <path d="M3.6 1.84c-.24.25-.38.64-.38 1.15v18.02c0 .51.14.9.39 1.15l.06.06L13.8 12.07v-.14L3.66 1.78l-.06.06z" opacity=".9" />
                    <path d="M17.18 15.52l-3.38-3.38v-.14l3.38-3.38.08.04 4 2.27c1.14.65 1.14 1.71 0 2.36l-4 2.27-.08.04z" />
                    <path d="M17.26 15.48l-3.46-3.46-10.2 10.2c.38.4 1 .45 1.71.05l11.95-6.79" opacity=".8" />
                    <path d="M17.26 8.56L5.31 1.77c-.71-.4-1.33-.35-1.71.05l10.2 10.2 3.46-3.46z" opacity=".7" />
                </svg>
                <span className="flex flex-col leading-none text-left">
                    <span className="font-jakarta text-[10px] font-medium text-white/70">Disponível no</span>
                    <span className="font-jakarta text-base font-bold">Google Play</span>
                </span>
            </a>
        </div>
    )
}

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
                    <m.div
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
                    </m.div>
                ))}
            </div>

            {/* Mock grande */}
            <m.div
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
            </m.div>

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
                    <m.div
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <WatchMockup />
                    </m.div>

                    <div className="space-y-3">
                        {watchFeatures.map((feature, i) => (
                            <m.div
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
                            </m.div>
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
                <m.div
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
                </m.div>

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
                                <m.span
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
                                <m.span
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
                        <m.div
                            key="celular"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.35 }}
                        >
                            <PhonePanel />
                        </m.div>
                    ) : (
                        <m.div
                            key="watch"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.35 }}
                        >
                            <WatchPanel />
                        </m.div>
                    )}
                </AnimatePresence>

                {/* Download nas lojas */}
                <StoreBadges />
            </div>
        </section>
    )
}

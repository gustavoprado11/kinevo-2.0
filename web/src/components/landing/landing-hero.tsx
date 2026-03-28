'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Star, Users, Zap } from 'lucide-react'

const heroMetrics = [
    { icon: Users, value: '50+', label: 'treinadores ativos' },
    { icon: Zap, value: '500+', label: 'programas prescritos' },
    { icon: Star, value: '4.9', label: 'avaliação na App Store' },
]

const fadeUp = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
}

export function LandingHero() {
    return (
        <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
            {/* Background layers */}
            <div className="absolute inset-0 bg-[#FAFAFA]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(124,58,237,0.12),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_0%,rgba(139,92,246,0.08),transparent)]" />
            <div className="absolute inset-0 grain-overlay" />

            {/* Floating accent orbs */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#7C3AED]/[0.06] rounded-full blur-3xl animate-float-slower" />
            <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#A855F7]/[0.06] rounded-full blur-3xl animate-float-slow" />

            <div className="relative mx-auto max-w-7xl px-6 w-full">
                {/* Centered text-first hero */}
                <div className="max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <motion.div
                        {...fadeUp}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <span className="inline-flex items-center gap-2 font-jakarta text-sm font-medium text-[#7C3AED] bg-white border border-[#7C3AED]/15 rounded-full px-4 py-2 shadow-sm">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C3AED] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]" />
                            </span>
                            Usado por 50+ personal trainers no Brasil
                        </span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        {...fadeUp}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                        className="font-jakarta text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold tracking-tight leading-[1.05] text-[#1D1D1F] mt-8"
                    >
                        Prescreva, acompanhe e{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#A855F7] bg-clip-text text-transparent">
                            receba sem taxas.
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        {...fadeUp}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                        className="font-jakarta text-lg md:text-xl text-[#6E6E73] mt-6 max-w-2xl mx-auto leading-relaxed"
                    >
                        O sistema completo para personal trainers que querem oferecer uma experiência profissional aos seus alunos — do programa ao pagamento.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        {...fadeUp}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.35 }}
                        className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center"
                    >
                        <motion.div
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                            <Link
                                href="/signup"
                                className="shimmer-btn group inline-flex items-center gap-2.5 bg-[#1D1D1F] hover:bg-[#000000] text-white font-semibold text-base rounded-full px-7 py-3.5 transition-all shadow-lg shadow-black/10 font-jakarta"
                            >
                                Comece grátis agora
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </motion.div>

                        <motion.div
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                            <a
                                href="#como-funciona"
                                className="group inline-flex items-center gap-2.5 bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold text-base rounded-full px-7 py-3.5 transition-all border border-[#D2D2D7] shadow-sm font-jakarta"
                            >
                                <Play className="w-4 h-4 text-[#7C3AED] fill-[#7C3AED]" />
                                Veja como funciona
                            </a>
                        </motion.div>
                    </motion.div>

                    {/* Micro-metrics */}
                    <motion.div
                        {...fadeUp}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 }}
                        className="mt-8 flex items-center justify-center gap-6 md:gap-8"
                    >
                        {heroMetrics.map((m, i) => (
                            <div key={m.label} className="flex items-center gap-2">
                                <m.icon className="w-4 h-4 text-[#7C3AED]/60" />
                                <span className="font-jakarta text-sm text-[#86868B]">
                                    <span className="font-bold text-[#1D1D1F]">{m.value}</span>{' '}
                                    <span className="hidden sm:inline">{m.label}</span>
                                </span>
                                {i < heroMetrics.length - 1 && (
                                    <span className="ml-4 md:ml-6 w-px h-4 bg-[#D2D2D7]" />
                                )}
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Product showcase — layered mockups */}
                <motion.div
                    initial={{ opacity: 0, y: 60, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                    className="relative mt-16 md:mt-20 max-w-5xl mx-auto"
                >
                    {/* Glow behind mockup */}
                    <div className="absolute inset-0 -inset-x-10 top-10 bg-gradient-to-b from-[#7C3AED]/10 via-[#7C3AED]/5 to-transparent rounded-3xl blur-2xl" />

                    {/* Main dashboard mockup */}
                    <div className="relative rounded-2xl overflow-hidden border border-black/[0.08] shadow-2xl shadow-black/10 bg-white">
                        <div className="bg-[#F5F5F7] border-b border-black/[0.05] px-4 py-3 flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                            </div>
                            <div className="flex-1 mx-16">
                                <div className="bg-white rounded-md px-3 py-1 text-xs text-[#86868B] text-center font-jakarta border border-black/[0.05]">
                                    app.kinevo.com.br
                                </div>
                            </div>
                        </div>
                        <Image
                            src="/719shots_so.png"
                            alt="Kinevo — dashboard do personal trainer"
                            width={1920}
                            height={1080}
                            priority
                            className="w-full h-auto"
                        />
                    </div>

                    {/* Floating card — left: student adherence */}
                    <motion.div
                        initial={{ opacity: 0, x: -30, y: 20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 1 }}
                        className="absolute -left-4 md:-left-8 bottom-1/4 hidden md:block"
                    >
                        <div className="bg-white rounded-xl p-4 shadow-xl shadow-black/[0.08] border border-black/[0.05] w-52 animate-float-slower">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34C759] to-[#30D158] flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">92%</span>
                                </div>
                                <div>
                                    <p className="font-jakarta text-xs font-semibold text-[#1D1D1F]">Aderência semanal</p>
                                    <p className="font-jakarta text-[10px] text-[#86868B]">12 de 13 alunos treinaram</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Floating card — right: payment received */}
                    <motion.div
                        initial={{ opacity: 0, x: 30, y: 20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 1.2 }}
                        className="absolute -right-4 md:-right-8 top-1/3 hidden md:block"
                    >
                        <div className="bg-white rounded-xl p-4 shadow-xl shadow-black/[0.08] border border-black/[0.05] w-56 animate-float-slow">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
                                    <span className="text-white text-xs">💰</span>
                                </div>
                                <div>
                                    <p className="font-jakarta text-xs font-semibold text-[#1D1D1F]">Pagamento recebido</p>
                                    <p className="font-jakarta text-[10px] text-[#86868B]">Maria Silva — R$ 350,00</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Trust line */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="font-jakarta text-[#AEAEB2] text-xs text-center mt-8 tracking-wide"
                >
                    7 dias grátis &bull; Setup em 2 minutos &bull; Sem fidelidade &bull; Cancele quando quiser
                </motion.p>
            </div>
        </section>
    )
}

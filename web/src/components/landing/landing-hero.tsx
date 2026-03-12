'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'

export function LandingHero() {
    return (
        <section className="relative mesh-gradient-hero min-h-screen flex items-center pt-20 pb-16 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 w-full">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                    {/* Text Column */}
                    <div className="flex-1 text-center lg:text-left">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        >
                            <span className="inline-flex items-center gap-1.5 font-jakarta text-sm font-medium text-[#7C3AED] bg-[#7C3AED]/10 rounded-full px-4 py-1.5">
                                <span className="animate-pulse-soft">✨</span>
                                7 dias grátis &bull; Cancele quando quiser
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                            className="font-jakarta text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#1D1D1F] mt-6"
                        >
                            Seus alunos merecem uma experiência profissional.
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.25 }}
                            className="font-jakarta text-lg md:text-xl text-[#86868B] mt-6 max-w-xl mx-auto lg:mx-0"
                        >
                            O Kinevo é o sistema completo para personal trainers que querem prescrever com precisão, acompanhar cada aluno de perto e receber sem perder dinheiro com taxas.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                            className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
                        >
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                            >
                                <Link
                                    href="/signup"
                                    className="shimmer-btn inline-block bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] text-white font-semibold text-lg rounded-full px-8 py-4 transition-all hover:shadow-[0_0_40px_rgba(124,58,237,0.3)] font-jakarta"
                                >
                                    Comece grátis agora
                                </Link>
                            </motion.div>

                            <a
                                href="#como-funciona"
                                className="font-jakarta text-[#7C3AED] font-semibold text-lg hover:text-[#6D28D9] transition-colors"
                            >
                                Veja como funciona &darr;
                            </a>
                        </motion.div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="font-jakarta text-[#86868B]/60 text-sm mt-4"
                        >
                            Setup em 2 minutos &bull; Alunos ilimitados &bull; R$ 39,90/mês após o trial
                        </motion.p>
                    </div>

                    {/* Mockup Column */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                        className="flex-1 lg:flex-[1.3] max-w-2xl animate-float-slow"
                    >
                        <Image
                            src="/719shots_so.png"
                            alt="Kinevo — app de treino para personal trainers"
                            width={1920}
                            height={1080}
                            priority
                            className="w-full h-auto drop-shadow-2xl"
                        />
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

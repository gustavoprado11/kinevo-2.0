'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'

export function LandingHero() {
    return (
        <section className="relative bg-white min-h-screen flex flex-col justify-center pt-24 pb-0 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mx-auto max-w-5xl text-center">
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="font-jakarta text-6xl md:text-8xl font-extrabold tracking-tight leading-[0.9] text-[#1D1D1F]"
                    >
                        Prescreva, acompanhe e{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            evolua
                        </span>{' '}
                        seus alunos.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        className="font-jakarta text-xl md:text-2xl text-[#86868B] mt-6"
                    >
                        O sistema completo para personal trainers.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                        className="mt-8"
                    >
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                            className="inline-block"
                        >
                            <Link
                                href="/signup"
                                className="inline-block bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] text-white font-semibold text-lg rounded-full px-8 py-4 transition-all hover:shadow-[0_0_40px_rgba(124,58,237,0.3)] font-jakarta"
                            >
                                Comece Gratuitamente &rarr;
                            </Link>
                        </motion.div>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="text-[#86868B]/60 text-sm mt-3 font-jakarta"
                        >
                            Teste grátis por 7 dias. Configure em 2 minutos.
                        </motion.p>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 60, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                    className="mx-auto max-w-4xl mt-8"
                >
                    <Image
                        src="/407shots_so.png"
                        alt="Kinevo Dashboard no MacBook"
                        width={1920}
                        height={1080}
                        priority
                        className="w-full h-auto"
                    />
                </motion.div>
            </div>
        </section>
    )
}

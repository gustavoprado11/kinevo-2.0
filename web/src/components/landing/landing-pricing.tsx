'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

function Check() {
    return <span className="text-[#34C759] mr-2">&#10003;</span>
}

export function LandingPricing() {
    return (
        <section className="bg-[#F5F5F7] min-h-screen flex items-center py-32 md:py-40">
            <div className="mx-auto max-w-7xl px-6 w-full">
                <div className="text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="font-jakarta text-4xl md:text-6xl font-bold tracking-tight text-[#1D1D1F]"
                    >
                        Simples e transparente.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                        className="font-jakarta text-xl text-[#86868B] mt-4"
                    >
                        Comece grátis, escale quando quiser.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="mt-16 mx-auto max-w-lg"
                >
                    <div className="bg-[#1D1D1F] rounded-2xl p-10 flex flex-col">
                        <p className="font-jakarta text-lg font-semibold text-white">Pro</p>
                        <div className="mt-2">
                            <span className="font-jakarta text-5xl font-extrabold text-white">R$ 39,90</span>
                            <span className="font-jakarta text-white/50 text-lg ml-1">/mês</span>
                        </div>
                        <p className="font-jakarta text-white/40 text-sm mt-2">7 dias grátis. Depois R$ 39,90/mês.</p>
                        <ul className="mt-8 space-y-3">
                            {[
                                'Alunos ilimitados',
                                'Builder de programas completo',
                                'App para alunos (iOS e Android)',
                                'Avaliações com IA',
                                'Pagamentos integrados',
                                'Métricas de adesão',
                            ].map((f) => (
                                <li key={f} className="font-jakarta text-sm text-white/80 flex items-center">
                                    <Check />{f}
                                </li>
                            ))}
                        </ul>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                            className="mt-8"
                        >
                            <Link
                                href="/signup"
                                className="block w-full text-center bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] text-white font-medium rounded-full py-3 transition-all hover:shadow-[0_0_40px_rgba(124,58,237,0.3)] font-jakarta text-sm"
                            >
                                Testar grátis por 7 dias
                            </Link>
                        </motion.div>
                    </div>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                    className="font-jakarta text-[#86868B] text-sm text-center mt-8"
                >
                    Cancele quando quiser. Sem fidelidade.
                </motion.p>
            </div>
        </section>
    )
}

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

function CheckMark() {
    return <span className="text-[#34C759] mr-2">&#10003;</span>
}

const included = [
    'Alunos ilimitados',
    'App iOS e Android',
    'Apple Watch',
    'Assistente de prescrição',
    'Formulários inteligentes',
    'Sala de Treino',
    'Pagamentos com 0% taxa',
    'Dashboard completo',
    'Suporte',
]

export function LandingPricing() {
    return (
        <section className="bg-[#F5F5F7] py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 w-full">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="text-center"
                >
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
                        Tudo isso por menos que uma sessão de treino.
                    </h2>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                    className="mt-12 mx-auto max-w-lg"
                >
                    <div className="bg-[#1D1D1F] rounded-2xl p-10 flex flex-col">
                        <div>
                            <span className="font-jakarta text-5xl font-extrabold text-white">R$ 39,90</span>
                            <span className="font-jakarta text-white/50 text-lg ml-1">/mês</span>
                        </div>

                        <p className="font-jakarta text-white/40 text-sm mt-3">
                            7 dias grátis &bull; Sem fidelidade &bull; Cancele quando quiser
                        </p>

                        <div className="w-full h-px bg-white/10 my-8" />

                        <p className="font-jakarta text-white/60 text-xs uppercase tracking-wider font-semibold mb-4">
                            Tudo incluso
                        </p>

                        <ul className="space-y-3">
                            {included.map((f) => (
                                <li key={f} className="font-jakarta text-sm text-white/80 flex items-center">
                                    <CheckMark />{f}
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
                                className="shimmer-btn block w-full text-center bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] text-white font-semibold rounded-full py-3.5 transition-all hover:shadow-[0_0_40px_rgba(124,58,237,0.3)] font-jakarta"
                            >
                                Comece grátis agora
                            </Link>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

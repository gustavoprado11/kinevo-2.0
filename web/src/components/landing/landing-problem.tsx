'use client'

import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'

const painPoints = [
    {
        emoji: '📋',
        title: 'Planilhas e PDFs',
        stat: '2h+',
        statLabel: 'perdidas por programa',
    },
    {
        emoji: '👻',
        title: 'Aluno sumiu?',
        stat: '0',
        statLabel: 'visibilidade de aderência',
    },
    {
        emoji: '💸',
        title: 'Taxas e Pix',
        stat: '10-20%',
        statLabel: 'perdido em cada cobrança',
    },
]

export function LandingProblem() {
    return (
        <section className="relative bg-[#0A0A0B] py-24 md:py-32 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(124,58,237,0.06),transparent)]" />

            <div className="relative mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-2xl mx-auto mb-16"
                >
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-white">
                        Você é profissional.{' '}
                        <span className="text-white/30">Suas ferramentas também deveriam ser.</span>
                    </h2>
                </motion.div>

                {/* Visual cards — stat-driven */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                    {painPoints.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.5, delay: i * 0.08 }}
                            className="group bg-white/[0.03] border border-white/[0.05] rounded-2xl p-6 text-center hover:bg-white/[0.05] hover:border-white/[0.08] transition-all"
                        >
                            <span className="text-4xl">{card.emoji}</span>
                            <p className="font-jakarta text-4xl md:text-5xl font-extrabold text-[#FF3B30]/80 mt-4">
                                {card.stat}
                            </p>
                            <p className="font-jakarta text-xs text-white/30 mt-1">{card.statLabel}</p>
                            <p className="font-jakarta text-sm font-semibold text-white/60 mt-4">{card.title}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Transition */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-14 text-center"
                >
                    <p className="font-jakarta text-xl md:text-2xl font-bold text-white">
                        O Kinevo muda isso.
                    </p>
                    <motion.div
                        animate={{ y: [0, 5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="mt-4"
                    >
                        <ArrowDown className="w-4 h-4 text-[#7C3AED] mx-auto" />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}

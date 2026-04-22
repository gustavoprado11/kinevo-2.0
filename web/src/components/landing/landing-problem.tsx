'use client'

import { motion } from 'framer-motion'
import { ChevronDown, FileText, UserX, MessagesSquare, type LucideIcon } from 'lucide-react'

type PainPoint = {
    Icon: LucideIcon
    title: string
    stat: string
    statLabel: string
}

const painPoints: PainPoint[] = [
    {
        Icon: FileText,
        title: 'Planilhas e PDFs',
        stat: '2h+',
        statLabel: 'perdidas por programa',
    },
    {
        Icon: UserX,
        title: 'Aluno sumiu?',
        stat: '0%',
        statLabel: 'visibilidade de aderência',
    },
    {
        Icon: MessagesSquare,
        title: 'WhatsApp sem fim',
        stat: '50+',
        statLabel: 'mensagens por dia só de dúvidas',
    },
]

export function LandingProblem() {
    return (
        <section className="relative bg-gradient-to-b from-[#0A0A0B] via-[#111113] to-[#0A0A0B] py-24 md:py-32 overflow-hidden border-t border-white/5">
            {/* Soft violet halo at top — smooths transition from bg-white above */}
            <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(124,58,237,0.08),transparent)]" />

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

                {/* Pain cards — icon-driven, unified violet palette */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                    {painPoints.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.5, delay: i * 0.08 }}
                            className="group bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center hover:bg-white/[0.05] hover:border-[#7C3AED]/20 transition-all"
                        >
                            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/20">
                                <card.Icon className="w-5 h-5 text-[#A855F7]" strokeWidth={1.8} />
                            </div>
                            <p className="font-jakarta text-sm font-semibold text-white mt-5">{card.title}</p>
                            <p className="font-jakarta text-4xl md:text-5xl font-extrabold bg-gradient-to-br from-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent mt-3 tracking-tight whitespace-nowrap">
                                {card.stat}
                            </p>
                            <p className="font-jakarta text-xs text-white/40 mt-2">{card.statLabel}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Transition */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-20 flex flex-col items-center gap-5"
                >
                    <p className="font-jakarta text-xl md:text-2xl font-bold text-white">
                        O Kinevo muda isso.
                    </p>
                    <motion.div
                        animate={{ y: [0, 4, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20"
                    >
                        <ChevronDown className="w-5 h-5 text-[#A855F7]" strokeWidth={2} />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}

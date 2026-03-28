'use client'

import { motion } from 'framer-motion'
import { ClipboardList, EyeOff, CreditCard, ArrowDown } from 'lucide-react'

const painPoints = [
    {
        icon: ClipboardList,
        title: 'Planilhas e PDFs por WhatsApp',
        description:
            'Você estudou periodização, bioquímica, biomecânica. Mas na hora de prescrever, a ferramenta é uma planilha copiada. O aluno recebe um PDF genérico e treina sozinho.',
        emoji: '📋',
    },
    {
        icon: EyeOff,
        title: 'Sem ideia de quem treinou',
        description:
            'O aluno some por semanas e você só descobre na próxima sessão. Sem dados, sem histórico, sem como mostrar evolução.',
        emoji: '👻',
    },
    {
        icon: CreditCard,
        title: 'Pix, constrangimento e taxas',
        description:
            'Cobrar aluno é desconfortável. Você manda mensagem, espera, manda de novo. Quando tenta uma plataforma, perde 10-20% em taxas.',
        emoji: '💸',
    },
]

export function LandingProblem() {
    return (
        <section className="relative bg-[#0A0A0B] py-24 md:py-32 overflow-hidden">
            {/* Subtle gradient accents */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(124,58,237,0.08),transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_80%_100%,rgba(124,58,237,0.05),transparent)]" />

            <div className="relative mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <span className="font-jakarta text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                        O problema
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-white mt-4">
                        Você é um profissional de verdade.{' '}
                        <span className="text-white/50">Suas ferramentas deveriam ser também.</span>
                    </h2>
                </motion.div>

                {/* Pain point cards */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {painPoints.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
                            className="group relative bg-white/[0.04] backdrop-blur-sm rounded-2xl p-7 border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.06] transition-all"
                        >
                            <span className="text-3xl">{card.emoji}</span>

                            <h3 className="font-jakarta text-lg font-semibold text-white mt-4">
                                {card.title}
                            </h3>
                            <p className="font-jakarta text-white/50 text-sm leading-relaxed mt-3">
                                {card.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Transition CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                    className="mt-16 text-center"
                >
                    <p className="font-jakarta text-2xl md:text-3xl font-bold text-white">
                        O Kinevo muda isso.
                    </p>
                    <p className="font-jakarta text-base text-white/40 mt-3">
                        Prescreva com precisão. Acompanhe de verdade. Receba sem perder um centavo.
                    </p>
                    <motion.div
                        animate={{ y: [0, 6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="mt-6"
                    >
                        <ArrowDown className="w-5 h-5 text-[#7C3AED] mx-auto" />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}

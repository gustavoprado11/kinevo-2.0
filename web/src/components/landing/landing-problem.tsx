'use client'

import { motion } from 'framer-motion'
import { ClipboardList, EyeOff, CreditCard } from 'lucide-react'

const painPoints = [
    {
        icon: ClipboardList,
        title: 'Planilhas e PDFs por WhatsApp',
        description:
            'Você estudou periodização, bioquímica, biomecânica. Mas na hora de prescrever, a ferramenta é uma planilha copiada. O aluno recebe um PDF genérico e treina sozinho, sem contexto.',
    },
    {
        icon: EyeOff,
        title: 'Sem ideia de quem treinou',
        description:
            'O aluno some por semanas e você só descobre na próxima sessão. Sem dados, sem histórico, sem como mostrar evolução. A aderência cai e a culpa parece sua.',
    },
    {
        icon: CreditCard,
        title: 'Pix, constrangimento e inadimplência',
        description:
            'Cobrar aluno é desconfortável. Você manda mensagem, espera, manda de novo. Quando tenta uma plataforma, perde 10-20% de cada cobrança em taxas.',
    },
]

export function LandingProblem() {
    return (
        <section className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
                        Você é um profissional de verdade. Suas ferramentas deveriam ser também.
                    </h2>
                </motion.div>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {painPoints.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
                            className="bg-[#F5F5F7] rounded-2xl p-8"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center">
                                <card.icon className="w-6 h-6 text-[#7C3AED]" />
                            </div>
                            <h3 className="font-jakarta text-lg font-semibold text-[#1D1D1F] mt-5">
                                {card.title}
                            </h3>
                            <p className="font-jakarta text-[#86868B] text-sm leading-relaxed mt-3">
                                {card.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                    className="mt-16 text-center"
                >
                    <p className="font-jakarta text-2xl md:text-3xl font-bold text-[#1D1D1F]">
                        O Kinevo muda isso.
                    </p>
                    <p className="font-jakarta text-lg text-[#86868B] mt-3">
                        Prescreva com precisão. Acompanhe de verdade. Receba sem perder um centavo.
                    </p>
                </motion.div>
            </div>
        </section>
    )
}

'use client'

import { motion } from 'framer-motion'

const steps = [
    { number: '01', title: 'Crie sua conta', description: 'Setup em 2 minutos. Adicione alunos.', color: '#7C3AED' },
    { number: '02', title: 'Monte o programa', description: 'Construtor visual + assistente IA.', color: '#007AFF' },
    { number: '03', title: 'Acompanhe e receba', description: 'Aderência real. Pagamentos com 0% taxa.', color: '#34C759' },
]

export function LandingHowItWorks() {
    return (
        <section className="bg-white py-20 md:py-28">
            <div className="mx-auto max-w-4xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-14"
                >
                    <span className="font-jakarta text-xs font-semibold uppercase tracking-widest text-[#7C3AED]">Como funciona</span>
                    <h2 className="font-jakarta text-3xl md:text-4xl font-bold tracking-tight text-[#1D1D1F] mt-3">
                        Do zero ao primeiro aluno em minutos.
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                    {/* Connector */}
                    <div className="hidden md:block absolute top-10 left-[calc(16.67%+0.75rem)] right-[calc(16.67%+0.75rem)] h-px bg-gradient-to-r from-[#7C3AED]/15 via-[#007AFF]/15 to-[#34C759]/15" />

                    {steps.map((step, i) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="text-center"
                        >
                            <div className="relative mx-auto w-12 h-12 mb-5">
                                <div className="w-full h-full rounded-xl flex items-center justify-center" style={{ backgroundColor: `${step.color}10` }}>
                                    <span className="font-jakarta text-lg font-extrabold" style={{ color: step.color }}>{step.number}</span>
                                </div>
                            </div>
                            <h3 className="font-jakarta text-base font-bold text-[#1D1D1F]">{step.title}</h3>
                            <p className="font-jakarta text-sm text-[#86868B] mt-1.5">{step.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

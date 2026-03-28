'use client'

import { motion } from 'framer-motion'
import { UserPlus, ClipboardEdit, TrendingUp } from 'lucide-react'

const steps = [
    {
        number: '01',
        icon: UserPlus,
        title: 'Crie sua conta em 2 minutos',
        description: 'Cadastre-se, configure seu perfil e adicione seus alunos. Sem burocracia, sem esperar aprovação.',
        color: '#7C3AED',
    },
    {
        number: '02',
        icon: ClipboardEdit,
        title: 'Monte o programa de treino',
        description: 'Use o construtor visual com supersets, periodização e assistente IA. Ou importe de templates prontos.',
        color: '#007AFF',
    },
    {
        number: '03',
        icon: TrendingUp,
        title: 'Acompanhe e receba',
        description: 'Veja aderência em tempo real, gerencie pagamentos com 0% de taxa e escale seu negócio.',
        color: '#34C759',
    },
]

export function LandingHowItWorks() {
    return (
        <section className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <span className="font-jakarta text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                        Como funciona
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                        Do zero ao primeiro aluno em minutos.
                    </h2>
                </motion.div>

                {/* Steps */}
                <div className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
                    {/* Connector line (desktop only) */}
                    <div className="hidden md:block absolute top-16 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-[#7C3AED]/20 via-[#007AFF]/20 to-[#34C759]/20" />

                    {steps.map((step, i) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.15 }}
                            className="relative text-center"
                        >
                            {/* Step circle */}
                            <div className="relative mx-auto w-16 h-16 mb-6">
                                <div
                                    className="absolute inset-0 rounded-2xl opacity-10"
                                    style={{ backgroundColor: step.color }}
                                />
                                <div className="relative w-full h-full rounded-2xl flex items-center justify-center">
                                    <step.icon
                                        className="w-7 h-7"
                                        style={{ color: step.color }}
                                    />
                                </div>
                                {/* Number badge */}
                                <div
                                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold font-jakarta"
                                    style={{ backgroundColor: step.color }}
                                >
                                    {step.number}
                                </div>
                            </div>

                            <h3 className="font-jakarta text-lg font-bold text-[#1D1D1F]">
                                {step.title}
                            </h3>
                            <p className="font-jakarta text-sm text-[#86868B] mt-3 max-w-xs mx-auto leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

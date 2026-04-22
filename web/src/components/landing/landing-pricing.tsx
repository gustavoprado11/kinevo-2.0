'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, X, Calculator } from 'lucide-react'

const included = [
    'Receba direto via Stripe — 0% de taxa do Kinevo',
    'Alunos ilimitados',
    'App iOS e Android',
    'Apple Watch',
    'Assistente de prescrição IA',
    'Formulários inteligentes',
    'Sala de Treino (tempo real)',
    'Dashboard completo',
    'Suporte prioritário',
]

const comparison = [
    { feature: 'Preço mensal', kinevo: 'R$ 39,90', others: 'R$ 49-199' },
    { feature: 'Taxa sobre pagamentos', kinevo: '0%', others: '5-20%' },
    { feature: 'Alunos ilimitados', kinevo: true, others: false },
    { feature: 'App nativo iOS/Android', kinevo: true, others: 'Parcial' },
    { feature: 'Apple Watch nativo', kinevo: true, others: false },
    { feature: 'Assistente IA', kinevo: true, others: false },
    { feature: 'Sala de Treino (tempo real)', kinevo: true, others: false },
    { feature: 'Modo offline', kinevo: true, others: false },
    { feature: 'Em português brasileiro', kinevo: true, others: 'Parcial' },
    { feature: 'Suporte humano em PT-BR', kinevo: true, others: false },
]

function ComparisonValue({ value }: { value: boolean | string }) {
    if (value === true) return <Check className="w-4 h-4 text-[#34C759]" />
    if (value === false) return <X className="w-4 h-4 text-[#FF3B30]/50" />
    return <span className="font-jakarta text-sm text-[#86868B]">{value}</span>
}

export function LandingPricing() {
    const [students, setStudents] = useState(15)
    const avgPrice = 350
    const competitorFee = 0.1 // 10%
    const monthlyEconomy = Math.round(students * avgPrice * competitorFee)
    const yearlyEconomy = monthlyEconomy * 12

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
                        Preços
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                        Tudo isso por menos que uma sessão de treino.
                    </h2>
                </motion.div>

                <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Pricing card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    >
                        <div className="gradient-border">
                            <div className="relative bg-[#1D1D1F] rounded-2xl p-8 md:p-10">
                                {/* Badge */}
                                <span className="inline-flex items-center font-jakarta text-xs font-semibold text-[#7C3AED] bg-[#7C3AED]/10 rounded-full px-3 py-1">
                                    Plano único — tudo incluso
                                </span>

                                <div className="mt-5">
                                    <span className="font-jakarta text-5xl md:text-6xl font-extrabold text-white">
                                        R$ 39,90
                                    </span>
                                    <span className="font-jakarta text-white/40 text-lg ml-1">/mês</span>
                                </div>

                                <p className="font-jakarta text-white/30 text-sm mt-3">
                                    7 dias grátis &bull; Sem fidelidade &bull; Cancele quando quiser
                                </p>

                                <div className="w-full h-px bg-white/10 my-7" />

                                <ul className="space-y-3">
                                    {included.map((f, i) => {
                                        const highlight = i === 0
                                        return (
                                            <li
                                                key={f}
                                                className={
                                                    highlight
                                                        ? 'font-jakarta text-sm text-white font-semibold flex items-center gap-2.5 bg-[#34C759]/10 border border-[#34C759]/25 rounded-lg px-3 py-2 -mx-1'
                                                        : 'font-jakarta text-sm text-white/70 flex items-center gap-2.5'
                                                }
                                            >
                                                <Check className="w-4 h-4 text-[#34C759] shrink-0" />
                                                {f}
                                            </li>
                                        )
                                    })}
                                </ul>

                                <motion.div
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
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
                        </div>
                    </motion.div>

                    {/* Economy calculator */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                        className="bg-[#F5F5F7] rounded-2xl p-8 md:p-10 border border-[#E8E8ED]"
                    >
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                                <Calculator className="w-4.5 h-4.5 text-[#7C3AED]" />
                            </div>
                            <h3 className="font-jakarta text-lg font-bold text-[#1D1D1F]">
                                Calculadora de economia
                            </h3>
                        </div>

                        <p className="font-jakarta text-sm text-[#6E6E73] mb-6">
                            Veja quanto você economiza por mês sem taxa de plataforma:
                        </p>

                        {/* Slider */}
                        <div className="space-y-5">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="font-jakarta text-sm font-medium text-[#1D1D1F]">
                                        Quantidade de alunos
                                    </label>
                                    <span className="font-jakarta text-sm font-bold text-[#7C3AED]">
                                        {students}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="50"
                                    value={students}
                                    onChange={(e) => setStudents(Number(e.target.value))}
                                    className="w-full h-2 bg-[#D2D2D7] rounded-full appearance-none cursor-pointer accent-[#7C3AED]"
                                />
                                <div className="flex justify-between mt-1">
                                    <span className="font-jakarta text-xs text-[#AEAEB2]">5</span>
                                    <span className="font-jakarta text-xs text-[#AEAEB2]">50</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-5 border border-[#34C759]/20">
                                <p className="font-jakarta text-xs text-[#86868B] uppercase tracking-wider font-semibold">
                                    Quanto você economiza por mês
                                </p>
                                <p className="font-jakarta text-3xl font-extrabold text-[#34C759] mt-2">
                                    +R$ {monthlyEconomy.toLocaleString('pt-BR')}
                                </p>
                                <p className="font-jakarta text-sm text-[#86868B] mt-1">
                                    vs. plataformas com 10% de taxa — R$ {yearlyEconomy.toLocaleString('pt-BR')} por ano
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Comparison table */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="mt-16 bg-[#F5F5F7] rounded-2xl border border-[#E8E8ED] overflow-hidden"
                >
                    <div className="p-6 md:p-8">
                        <h3 className="font-jakarta text-xl font-bold text-[#1D1D1F]">
                            Kinevo vs. alternativas
                        </h3>
                        <p className="font-jakarta text-xs text-[#86868B] mt-2">
                            Comparação com plataformas de personal training disponíveis no Brasil, em planos profissionais equivalentes. Valores e taxas verificados em abril/2026.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-t border-[#E8E8ED]">
                                    <th className="font-jakarta text-xs font-semibold text-[#86868B] uppercase tracking-wider text-left px-6 md:px-8 py-4 w-1/2">
                                        Feature
                                    </th>
                                    <th className="font-jakarta text-xs font-semibold text-[#7C3AED] uppercase tracking-wider text-center px-4 py-4 w-1/4">
                                        Kinevo
                                    </th>
                                    <th className="font-jakarta text-xs font-semibold text-[#86868B] uppercase tracking-wider text-center px-4 py-4 w-1/4">
                                        Outros
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparison.map((row) => (
                                    <tr key={row.feature} className="border-t border-[#E8E8ED]">
                                        <td className="font-jakarta text-sm text-[#1D1D1F] px-6 md:px-8 py-4">
                                            {row.feature}
                                        </td>
                                        <td className="text-center px-4 py-4">
                                            <div className="flex justify-center">
                                                <ComparisonValue value={row.kinevo} />
                                            </div>
                                        </td>
                                        <td className="text-center px-4 py-4">
                                            <div className="flex justify-center">
                                                <ComparisonValue value={row.others} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}

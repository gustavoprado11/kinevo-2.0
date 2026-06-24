'use client'

import { useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { Check, X, Calculator, Sparkles } from 'lucide-react'
import { TIER_DISPLAY, type TierDisplay, type TierFeature } from '@/lib/billing/tiers'

const comparison = [
    { feature: 'Taxa sobre pagamentos', kinevo: '0%', others: '5-20%' },
    { feature: 'Alunos ilimitados (planos pagos)', kinevo: true, others: false },
    { feature: 'App nativo iOS/Android', kinevo: true, others: 'Parcial' },
    { feature: 'Apple Watch nativo', kinevo: true, others: false },
    { feature: 'Assistente IA agêntico (⌘K + voz)', kinevo: true, others: false },
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

/** Linha de feature do card de tier (on=incluído, off=indisponível, star=premium). */
function TierFeatureRow({ feature, dark }: { feature: TierFeature; dark: boolean }) {
    const state = feature.state ?? 'on'
    const muted = dark ? 'text-white/35' : 'text-[#8A8A8E]'
    const normal = dark ? 'text-white/80' : 'text-[#3A3A40]'
    return (
        <li className="font-jakarta flex items-start gap-2.5 text-[13px] leading-snug">
            <span
                className={`mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
                    state === 'off'
                        ? dark
                            ? 'bg-white/10 text-white/30'
                            : 'bg-[#EDEDF0] text-[#8A8A8E]'
                        : state === 'star'
                          ? 'bg-[#7C3AED]/15 text-[#A855F7]'
                          : 'bg-[#34C759]/15 text-[#34C759]'
                }`}
            >
                {state === 'off' ? (
                    <X className="h-[9px] w-[9px]" strokeWidth={2.5} />
                ) : state === 'star' ? (
                    <Sparkles className="h-[9px] w-[9px]" strokeWidth={2.5} />
                ) : (
                    <Check className="h-[10px] w-[10px]" strokeWidth={3} />
                )}
            </span>
            <span className={state === 'off' ? muted : normal}>{feature.label}</span>
        </li>
    )
}

/** Card de um tier na landing. O featured (Pro IA) é escuro e em destaque. */
function TierColumn({ card, index }: { card: TierDisplay; index: number }) {
    const dark = !!card.featured
    const href = card.free ? '/signup' : `/signup?tier=${card.tier}`

    return (
        <m.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.07 }}
            className={`relative flex flex-col rounded-2xl p-6 ${
                dark
                    ? 'bg-[#1D1D1F] shadow-[0_0_0_1px_rgba(124,58,237,0.4),0_24px_60px_-28px_rgba(124,58,237,0.55)]'
                    : 'bg-white border border-[#E8E8ED] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-18px_rgba(0,0,0,0.14)]'
            }`}
        >
            {card.featured && (
                <span className="font-jakarta absolute -top-3 left-6 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Recomendado
                </span>
            )}

            <div
                className={`font-jakarta text-[12px] font-bold uppercase tracking-wide ${
                    dark ? 'text-[#A855F7]' : card.free ? 'text-[#8A8A8E]' : 'text-[#7C3AED]'
                }`}
            >
                {card.name}
            </div>

            <div className={`font-jakarta mt-2 ${dark ? 'text-white' : 'text-[#1D1D1F]'}`}>
                <span className="text-[30px] font-extrabold tracking-tight">{card.price}</span>
                {card.priceSuffix && (
                    <span className={`text-[13px] font-medium ${dark ? 'text-white/40' : 'text-[#8A8A8E]'}`}>
                        {card.priceSuffix}
                    </span>
                )}
            </div>

            <p className={`font-jakarta mt-2 mb-5 min-h-[38px] text-[13px] ${dark ? 'text-white/55' : 'text-[#6E6E73]'}`}>
                {card.credits}
            </p>

            <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                {card.features.map((f) => (
                    <TierFeatureRow key={f.label} feature={f} dark={dark} />
                ))}
            </ul>

            <m.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                <Link
                    href={href}
                    className={`font-jakarta block w-full rounded-full py-3 text-center text-[14px] font-semibold transition-all ${
                        dark
                            ? 'shimmer-btn bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:from-[#6D28D9] hover:to-[#9333EA] hover:shadow-[0_0_36px_rgba(124,58,237,0.35)]'
                            : card.free
                              ? 'border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7]'
                              : 'bg-[#1D1D1F] text-white hover:bg-[#000]'
                    }`}
                >
                    {card.cta}
                </Link>
            </m.div>
        </m.div>
    )
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
                <m.div
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
                        Escolha o plano do seu momento.
                    </h2>
                    <p className="font-jakarta text-[#6E6E73] text-base md:text-lg mt-4">
                        Comece grátis. Quando quiser a IA trabalhando junto, é só assinar — 7 dias grátis, sem fidelidade.
                    </p>
                </m.div>

                {/* 4-tier grid */}
                <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {TIER_DISPLAY.map((card, i) => (
                        <TierColumn key={card.tier} card={card} index={i} />
                    ))}
                </div>

                <p className="font-jakarta text-center text-[12.5px] text-[#86868B] mt-6">
                    Créditos de IA renovam a cada ciclo e não acumulam. Acabou a cota? O resto do Kinevo continua
                    funcionando normalmente — você só perde o atalho da IA até o próximo ciclo.
                </p>

                <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Economy calculator */}
                    <m.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
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
                    </m.div>

                    {/* Comparison table */}
                    <m.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                        className="bg-[#F5F5F7] rounded-2xl border border-[#E8E8ED] overflow-hidden"
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
                    </m.div>
                </div>
            </div>
        </section>
    )
}

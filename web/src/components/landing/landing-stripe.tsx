'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, CreditCard, Repeat, Lock } from 'lucide-react'

const STRIPE_RATE = 0.0399
const STRIPE_FIXED = 0.50
const COMPETITOR_RATE = 0.10
const STUDENTS = 15
const PRICE = 350

const gross = STUDENTS * PRICE
const stripeFee = gross * STRIPE_RATE + STRIPE_FIXED * STUDENTS
const competitorFee = gross * COMPETITOR_RATE
const netCompetitor = gross - competitorFee - stripeFee
const netKinevo = gross - stripeFee
const monthlyDiff = netKinevo - netCompetitor
const yearlyDiff = monthlyDiff * 12

function formatBRL(n: number): string {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Row = {
    label: string
    value: string
    negative?: boolean
    highlight?: boolean
}

type ComparisonCardProps = {
    variant: 'bad' | 'good'
    title: string
    subtitle?: string
    rows: Row[]
    totalLabel: string
    totalValue: string
}

function ComparisonCard({ variant, title, subtitle, rows, totalLabel, totalValue }: ComparisonCardProps) {
    const isBad = variant === 'bad'
    const accentColor = isBad ? '#FF3B30' : '#34C759'
    const bgAccent = isBad ? 'bg-[#FF3B30]/5' : 'bg-[#34C759]/5'
    const textAccent = isBad ? 'text-[#FF3B30]' : 'text-[#34C759]'

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: isBad ? 0 : 0.15 }}
            className="border border-[#E8E8ED] rounded-2xl overflow-hidden bg-white"
        >
            <div className={`${bgAccent} px-6 py-5 border-b border-[#E8E8ED]`}>
                <h3 className={`font-jakarta font-semibold text-lg ${textAccent}`}>{title}</h3>
                {subtitle && <p className="font-jakarta text-sm text-[#6E6E73] mt-1">{subtitle}</p>}
            </div>

            <div className="px-6 py-6">
                <div className="space-y-4">
                    {rows.map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                            <span className="font-jakarta text-sm text-[#1D1D1F]">{row.label}</span>
                            <span
                                className={`font-mono text-sm font-semibold ${
                                    row.highlight
                                        ? 'text-[#34C759] font-extrabold'
                                        : row.negative
                                          ? 'text-[#FF3B30]'
                                          : 'text-[#1D1D1F]'
                                }`}
                            >
                                {row.value}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="border-t border-[#E8E8ED] mt-6 pt-6">
                    <div className="flex justify-between items-center">
                        <span className="font-jakarta text-base font-semibold text-[#1D1D1F]">{totalLabel}</span>
                        <span className="font-jakarta text-2xl font-extrabold text-[#1D1D1F]">{totalValue}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export function LandingStripe() {
    const badCardRows: Row[] = [
        { label: '15 alunos × R$ 350', value: formatBRL(gross) },
        { label: 'Taxa da plataforma (10%)', value: `-${formatBRL(competitorFee)}`, negative: true },
        { label: 'Taxa Stripe (3,99% + R$ 0,50)', value: `-${formatBRL(stripeFee)}` },
    ]

    const goodCardRows: Row[] = [
        { label: '15 alunos × R$ 350', value: formatBRL(gross) },
        { label: 'Taxa Kinevo', value: '0%', highlight: true },
        { label: 'Taxa Stripe (3,99% + R$ 0,50)', value: `-${formatBRL(stripeFee)}` },
    ]

    return (
        <section id="stripe" className="bg-white py-24 md:py-32 scroll-mt-20">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="text-center max-w-3xl mx-auto px-4 md:px-6 mb-16"
            >
                <p className="font-jakarta text-xs font-semibold uppercase tracking-widest text-[#34C759]/70">
                    Pagamentos
                </p>

                <h2 className="font-jakarta text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#1D1D1F] mt-4 leading-[1.05]">
                    <span className="bg-gradient-to-r from-[#34C759] to-[#30B350] bg-clip-text text-transparent">
                        0%
                    </span>{' '}
                    taxa Kinevo. Você fica com seu dinheiro.
                </h2>

                <p className="font-jakarta text-base md:text-lg text-[#6E6E73] mt-5 max-w-xl mx-auto">
                    Cobramos só o plano. As taxas são as do próprio Stripe — as mesmas que qualquer gateway
                    profissional cobra.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto px-4 md:px-6">
                <ComparisonCard
                    variant="bad"
                    title="Outras plataformas"
                    rows={badCardRows}
                    totalLabel="Você recebe"
                    totalValue={formatBRL(netCompetitor)}
                />

                <ComparisonCard
                    variant="good"
                    title="Kinevo"
                    rows={goodCardRows}
                    totalLabel="Você recebe"
                    totalValue={formatBRL(netKinevo)}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-8 max-w-md mx-auto px-4 md:px-6"
            >
                <div className="bg-[#34C759]/8 border border-[#34C759]/20 rounded-2xl py-6 px-8 text-center">
                    <p className="font-jakarta text-xs font-semibold uppercase tracking-widest text-[#34C759] mb-2">
                        Diferença a seu favor
                    </p>
                    <p className="text-3xl md:text-4xl font-extrabold text-[#34C759]">
                        +{formatBRL(monthlyDiff)}/mês
                    </p>
                    <p className="font-jakarta text-sm text-[#6E6E73] mt-3">
                        {formatBRL(yearlyDiff)} a mais no seu bolso por ano
                    </p>
                </div>
            </motion.div>

            <div className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 px-4 md:px-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#86868B]" />
                    <span className="font-jakarta text-xs text-[#6E6E73]">Processamento Stripe oficial</span>
                </div>

                <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#86868B]" />
                    <span className="font-jakarta text-xs text-[#6E6E73]">PIX, cartão e boleto</span>
                </div>

                <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-[#86868B]" />
                    <span className="font-jakarta text-xs text-[#6E6E73]">Recorrência automática</span>
                </div>

                <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#86868B]" />
                    <span className="font-jakarta text-xs text-[#6E6E73]">Bloqueio por inadimplência</span>
                </div>
            </div>
        </section>
    )
}

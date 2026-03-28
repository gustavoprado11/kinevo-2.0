'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

interface Testimonial {
    name: string
    role: string
    avatar: string
    quote: string
    metric?: string
    metricLabel?: string
}

const testimonials: Testimonial[] = [
    {
        name: 'Rafael Mendes',
        role: 'Personal Trainer — SP',
        avatar: 'RM',
        quote: 'Antes eu perdia 2 horas montando planilha. Com o Kinevo, monto um programa completo em 15 minutos. Meus alunos dizem que agora parece que têm um personal de verdade no bolso.',
        metric: '15 min',
        metricLabel: 'para montar um programa',
    },
    {
        name: 'Camila Ferreira',
        role: 'Coach Online — RJ',
        avatar: 'CF',
        quote: 'O dashboard de aderência mudou minha forma de trabalhar. Agora sei exatamente quem treinou, quem precisa de atenção e consigo agir antes do aluno desistir.',
        metric: '92%',
        metricLabel: 'aderência dos alunos',
    },
    {
        name: 'Lucas Oliveira',
        role: 'Personal & Studio — MG',
        avatar: 'LO',
        quote: 'Estava pagando 15% de taxa em outra plataforma. Com o Kinevo, recebo 100%. Em 3 meses, a economia já pagou mais de um ano de assinatura.',
        metric: '0%',
        metricLabel: 'taxa sobre pagamentos',
    },
]

function StarRating() {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-[#FFCC00] text-[#FFCC00]" />
            ))}
        </div>
    )
}

export function LandingTestimonials() {
    return (
        <section className="bg-[#F5F5F7] py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
                        Quem usa, recomenda.
                    </h2>
                </motion.div>

                {/* Testimonial cards — bento grid */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={t.name}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
                            className={`relative bg-white rounded-2xl p-7 border border-[#E8E8ED] shadow-sm hover:shadow-apple-hover transition-shadow ${
                                i === 0 ? 'md:row-span-1' : ''
                            }`}
                        >
                            {/* Quote icon */}
                            <Quote className="w-8 h-8 text-[#7C3AED]/10 mb-4" />

                            {/* Quote text */}
                            <p className="font-jakarta text-[#1D1D1F] text-sm leading-relaxed">
                                &ldquo;{t.quote}&rdquo;
                            </p>

                            {/* Metric highlight */}
                            {t.metric && (
                                <div className="mt-5 pt-5 border-t border-[#E8E8ED]">
                                    <p className="font-jakarta text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                                        {t.metric}
                                    </p>
                                    <p className="font-jakarta text-xs text-[#86868B] mt-0.5">
                                        {t.metricLabel}
                                    </p>
                                </div>
                            )}

                            {/* Author */}
                            <div className="flex items-center gap-3 mt-5">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
                                    <span className="font-jakarta text-xs font-bold text-white">
                                        {t.avatar}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-jakarta text-sm font-semibold text-[#1D1D1F]">
                                        {t.name}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-jakarta text-xs text-[#86868B]">
                                            {t.role}
                                        </p>
                                        <StarRating />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

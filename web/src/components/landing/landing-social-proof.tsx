'use client'

import { motion } from 'framer-motion'

const badges = [
    { label: 'Prescrição em minutos', emoji: '⚡' },
    { label: 'Apple Watch no pulso do aluno', emoji: '⌚' },
    { label: 'IA que aprende seu estilo', emoji: '🤖' },
    { label: 'Aplicativo para iPhone e Android', emoji: '📱' },
    { label: 'Funciona sem internet', emoji: '🔋' },
    { label: 'Receba direto na sua conta', emoji: '💳' },
]

// Duplicate for seamless marquee loop
const marqueeItems = [...badges, ...badges]

export function LandingSocialProof() {
    return (
        <section className="relative py-12 md:py-16 bg-white border-y border-[#E8E8ED] overflow-hidden">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

            <div className="flex items-center">
                <div className="animate-marquee flex items-center gap-8 md:gap-12 whitespace-nowrap">
                    {marqueeItems.map((badge, i) => (
                        <div
                            key={`${badge.label}-${i}`}
                            className="flex items-center gap-2.5 px-2"
                        >
                            <span className="text-xl">{badge.emoji}</span>
                            <span className="font-jakarta text-sm md:text-base font-medium text-[#6E6E73]">
                                {badge.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

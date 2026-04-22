'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Timer, Dumbbell, Bell, Calendar, Smartphone, WifiOff, Share2, Trophy } from 'lucide-react'

const features = [
    { icon: Timer, label: 'Timer inteligente' },
    { icon: Dumbbell, label: 'Cargas automáticas' },
    { icon: Bell, label: 'Push notifications' },
    { icon: Calendar, label: 'Calendário visual' },
    { icon: Smartphone, label: 'Live Activity' },
    { icon: WifiOff, label: 'Modo offline' },
    { icon: Share2, label: 'Cards p/ Stories' },
    { icon: Trophy, label: 'Recordes pessoais' },
]

export function LandingStudentApp() {
    return (
        <section className="bg-white py-24 md:py-32 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6">
                {/* Header — centered */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-2xl mx-auto mb-14"
                >
                    <span className="font-jakarta text-xs font-semibold uppercase tracking-widest text-[#7C3AED]">
                        O App do seu aluno
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-3">
                        O aluno abre e sente que tem{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            o melhor personal.
                        </span>
                    </h2>
                </motion.div>

                {/* Feature pills — horizontal scrollable on mobile */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto mb-14"
                >
                    {features.map((f, i) => (
                        <motion.div
                            key={f.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04, duration: 0.3 }}
                            className="inline-flex items-center gap-2 bg-[#F5F5F7] rounded-full px-4 py-2"
                        >
                            <f.icon className="w-3.5 h-3.5 text-[#7C3AED]" />
                            <span className="font-jakarta text-xs font-medium text-[#1D1D1F]">{f.label}</span>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Mockup — large and immersive */}
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative max-w-3xl mx-auto"
                >
                    <div className="absolute inset-0 -inset-y-8 bg-gradient-to-b from-[#7C3AED]/8 to-transparent rounded-3xl blur-2xl -z-10" />
                    <Image
                        src="/747shots_so.png"
                        alt="Kinevo — app do aluno em 3 iPhones"
                        width={1920}
                        height={1080}
                        className="w-full h-auto"
                    />
                </motion.div>

                {/* Marketing hook */}
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="font-jakarta text-sm text-[#86868B] text-center mt-8 max-w-md mx-auto"
                >
                    5 templates de cards para Stories. Cada post é marketing gratuito para você.
                </motion.p>
            </div>
        </section>
    )
}

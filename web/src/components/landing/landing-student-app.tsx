'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Timer, Dumbbell, Watch, Calendar, Smartphone, WifiOff, Share2, Trophy } from 'lucide-react'

const features = [
    { icon: Timer, title: 'Timer de descanso inteligente', description: 'Conta regressiva automática entre séries' },
    { icon: Dumbbell, title: 'Cargas automáticas', description: 'Última sessão carregada automaticamente' },
    { icon: Watch, title: 'Apple Watch', description: 'Acompanhe o treino do pulso' },
    { icon: Calendar, title: 'Calendário visual', description: 'Visão semanal do programa completo' },
    { icon: Smartphone, title: 'Live Activity', description: 'Treino visível na tela de bloqueio' },
    { icon: WifiOff, title: 'Modo offline', description: 'Funciona sem internet na academia' },
    { icon: Share2, title: 'Cards compartilháveis', description: '5 templates para Instagram Stories' },
    { icon: Trophy, title: 'Recordes pessoais', description: 'Celebração automática de PRs' },
]

export function LandingStudentApp() {
    return (
        <section className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
                    {/* Left — text + feature grid */}
                    <div className="flex-1">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                        >
                            <span className="font-jakarta text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                                O App do seu aluno
                            </span>
                            <h2 className="font-jakarta text-3xl md:text-4xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                                Quando o aluno abre o app, ele sente que tem{' '}
                                <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                                    o melhor personal.
                                </span>
                            </h2>
                            <p className="font-jakarta text-base text-[#6E6E73] mt-4 leading-relaxed">
                                App nativo para iOS e Android com design premium. Cada detalhe foi pensado para que o aluno tenha a melhor experiência de treino possível — e divulgue você.
                            </p>
                        </motion.div>

                        {/* Bento feature grid */}
                        <div className="mt-10 grid grid-cols-2 gap-3">
                            {features.map((f, i) => (
                                <motion.div
                                    key={f.title}
                                    initial={{ opacity: 0, y: 16 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-30px' }}
                                    transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.05 }}
                                    className="group flex items-start gap-3 bg-[#F5F5F7] rounded-xl p-4 hover:bg-[#ECECF0] transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                                        <f.icon className="w-4 h-4 text-[#7C3AED]" />
                                    </div>
                                    <div>
                                        <p className="font-jakarta text-sm font-semibold text-[#1D1D1F]">
                                            {f.title}
                                        </p>
                                        <p className="font-jakarta text-xs text-[#86868B] mt-0.5">
                                            {f.description}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Right — mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.96 }}
                        whileInView={{ opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="flex-1 max-w-lg lg:max-w-xl"
                    >
                        <div className="relative">
                            {/* Glow */}
                            <div className="absolute inset-0 -inset-y-10 bg-gradient-to-b from-[#7C3AED]/10 to-transparent rounded-3xl blur-2xl" />
                            <Image
                                src="/747shots_so.png"
                                alt="Kinevo — app do aluno em 3 iPhones"
                                width={1920}
                                height={1080}
                                className="relative w-full h-auto"
                            />
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

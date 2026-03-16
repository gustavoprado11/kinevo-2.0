'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Timer, Dumbbell, Watch, Calendar, Smartphone, WifiOff } from 'lucide-react'

const features = [
    { icon: Timer, title: 'Timer de descanso inteligente' },
    { icon: Dumbbell, title: 'Cargas automáticas da última sessão' },
    { icon: Watch, title: 'Apple Watch integrado' },
    { icon: Calendar, title: 'Calendário semanal visual' },
    { icon: Smartphone, title: 'Live Activity no iOS' },
    { icon: WifiOff, title: 'Modo offline completo' },
]

export function LandingStudentApp() {
    return (
        <section className="bg-[#F5F5F7] py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <span className="font-jakarta text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                        O APP DO SEU ALUNO
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                        Quando o aluno abre o app, ele sente que tem o melhor personal.
                    </h2>
                    <p className="font-jakarta text-lg text-[#86868B] mt-5">
                        App nativo para iOS e Android com design premium. Timer de descanso, cargas automáticas da última sessão, calendário semanal e modo offline. Integração com Apple Watch e Live Activity no iOS. E quando o aluno bate um recorde pessoal, ele compartilha nas redes — e divulga você.
                    </p>
                </motion.div>

                <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
                    {features.map((f, i) => (
                        <motion.div
                            key={f.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
                            className="bg-white rounded-xl p-5 text-center"
                        >
                            <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center mx-auto">
                                <f.icon className="w-5 h-5 text-[#7C3AED]" />
                            </div>
                            <p className="font-jakarta text-sm font-medium text-[#1D1D1F] mt-3">
                                {f.title}
                            </p>
                        </motion.div>
                    ))}
                </div>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                    className="font-jakarta text-[#86868B] text-sm text-center mt-10 max-w-lg mx-auto"
                >
                    5 templates de cards para o aluno compartilhar: foto, highlights, resumo, PR e treino completo. Cada post é marketing gratuito para você.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    className="mt-12 max-w-3xl mx-auto"
                >
                    <Image
                        src="/747shots_so.png"
                        alt="Kinevo — app do aluno em 3 iPhones"
                        width={1920}
                        height={1080}
                        className="w-full h-auto"
                    />
                </motion.div>
            </div>
        </section>
    )
}

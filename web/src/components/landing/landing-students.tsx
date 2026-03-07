'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

const features = [
    {
        title: 'Design Premium',
        description: 'Interface intuitiva feita para o ambiente real da academia.',
    },
    {
        title: 'Cargas Automáticas',
        description: 'O app preenche as cargas da última sessão. Seu aluno só treina.',
    },
    {
        title: 'Calendário e Histórico',
        description: 'Visão completa da semana, metas e evolução de treinos.',
    },
]

export function LandingStudents() {
    return (
        <section className="bg-white overflow-hidden">
            {/* Desktop: side-by-side, image LEFT text RIGHT */}
            <div className="hidden md:flex md:flex-row-reverse md:items-center md:min-h-screen">
                {/* Right: text */}
                <div className="flex-1 py-32 pr-8 md:pr-16 lg:pr-24 pl-8">
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="text-[#7C3AED] text-sm font-semibold uppercase tracking-wider font-jakarta"
                    >
                        Para Alunos
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-4"
                    >
                        Uma experiência que eles{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            vão amar
                        </span>.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                        className="font-jakarta text-lg text-[#86868B] mt-4"
                    >
                        Tudo que o seu aluno precisa para treinar com qualidade.
                    </motion.p>

                    <div className="mt-10 flex flex-col gap-6">
                        {features.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.15 }}
                            >
                                <h3 className="font-jakarta text-[#1D1D1F] font-semibold text-base">{f.title}</h3>
                                <p className="font-jakarta text-[#86868B] text-sm mt-1">{f.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Left: image bleeding to left edge */}
                <motion.div
                    initial={{ opacity: 0, x: -100 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="w-[58%] flex-shrink-0 self-center"
                >
                    <Image
                        src="/747shots_so.png"
                        alt="Kinevo App em 3 iPhones"
                        width={1920}
                        height={1080}
                        className="w-full h-auto"
                    />
                </motion.div>
            </div>

            {/* Mobile: stacked */}
            <div className="md:hidden py-16 px-6">
                <div className="text-center">
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="text-[#7C3AED] text-sm font-semibold uppercase tracking-wider font-jakarta"
                    >
                        Para Alunos
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        className="font-jakarta text-4xl font-bold tracking-tight text-[#1D1D1F] mt-4"
                    >
                        Uma experiência que eles{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            vão amar
                        </span>.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                        className="font-jakarta text-lg text-[#86868B] mt-4"
                    >
                        Tudo que o seu aluno precisa para treinar com qualidade.
                    </motion.p>
                </div>

                <div className="mt-10 flex flex-col gap-6">
                    {features.map((f, i) => (
                        <motion.div
                            key={f.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.15 }}
                            className="text-center"
                        >
                            <h3 className="font-jakarta text-[#1D1D1F] font-semibold text-base">{f.title}</h3>
                            <p className="font-jakarta text-[#86868B] text-sm mt-1">{f.description}</p>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 80, scale: 0.9 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="mt-12"
                >
                    <Image
                        src="/747shots_so.png"
                        alt="Kinevo App em 3 iPhones"
                        width={1920}
                        height={1080}
                        className="w-full h-auto"
                    />
                </motion.div>
            </div>
        </section>
    )
}

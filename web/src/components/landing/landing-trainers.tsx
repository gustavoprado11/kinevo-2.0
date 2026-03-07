'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

const features = [
    {
        title: 'Prescrição Inteligente',
        description: 'Monte treinos com facilidade e com os detalhes que você precisa.',
    },
    {
        title: 'Avaliações com IA',
        description: 'Crie anamneses em segundos com Inteligência Artificial.',
    },
    {
        title: 'Pagamentos',
        description: 'Zero taxa do Kinevo. Apenas taxas do Stripe.',
    },
]

export function LandingTrainers() {
    return (
        <section className="bg-[#dee2e6] overflow-hidden">
            {/* Desktop: side-by-side */}
            <div className="hidden md:flex md:items-center md:min-h-screen">
                {/* Left: text */}
                <div className="flex-1 py-32 pl-8 md:pl-16 lg:pl-24 pr-8">
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="text-[#7C3AED] text-sm font-semibold uppercase tracking-wider font-jakarta"
                    >
                        Para Treinadores
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-4"
                    >
                        Seu painel de controle.
                        <br />{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            Sem limites
                        </span>.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                        className="font-jakarta text-lg text-[#86868B] mt-4"
                    >
                        Tudo que você precisa o Kinevo tem.
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

                {/* Right: image bleeding to edge */}
                <motion.div
                    initial={{ opacity: 0, x: 100 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="w-[58%] flex-shrink-0 self-center"
                >
                    <Image
                        src="/836shots_so.png"
                        alt="Kinevo Builder no MacBook"
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
                        Para Treinadores
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        className="font-jakarta text-4xl font-bold tracking-tight text-[#1D1D1F] mt-4"
                    >
                        Seu painel de controle.
                        <br />{' '}
                        <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                            Sem limites
                        </span>.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                        className="font-jakarta text-lg text-[#86868B] mt-4"
                    >
                        Tudo que você precisa o Kinevo tem.
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
                        src="/836shots_so.png"
                        alt="Kinevo Builder no MacBook"
                        width={1920}
                        height={1080}
                        className="w-full h-auto"
                    />
                </motion.div>
            </div>
        </section>
    )
}

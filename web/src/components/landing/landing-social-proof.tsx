'use client'

import { motion } from 'framer-motion'

const metrics = [
    { value: '50+', label: 'treinadores já usam o Kinevo' },
    { value: '500+', label: 'programas prescritos na plataforma' },
    { value: '0%', label: 'taxa sobre seus pagamentos' },
]

export function LandingSocialProof() {
    return (
        <section className="bg-[#F5F5F7] py-16 md:py-20">
            <div className="mx-auto max-w-5xl px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center">
                    {metrics.map((m, i) => (
                        <motion.div
                            key={m.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
                        >
                            <p className="font-jakarta text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                                {m.value}
                            </p>
                            <p className="font-jakarta text-sm text-[#86868B] mt-2">{m.label}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { faqs } from './faqs-data'

export function LandingFaq() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    return (
        <section className="bg-[#F5F5F7] py-24 md:py-32">
            <div className="mx-auto max-w-3xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center mb-12"
                >
                    <span className="font-jakarta text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                        FAQ
                    </span>
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                        Perguntas frequentes
                    </h2>
                </motion.div>

                <div className="bg-white rounded-2xl border border-[#E8E8ED] overflow-hidden shadow-sm">
                    {faqs.map((faq, i) => {
                        const isOpen = openIndex === i
                        const isLast = i === faqs.length - 1
                        const buttonId = `faq-button-${i}`
                        const panelId = `faq-panel-${i}`

                        return (
                            <motion.div
                                key={faq.question}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-20px' }}
                                transition={{ duration: 0.3, ease: 'easeOut', delay: i * 0.03 }}
                                className={!isLast ? 'border-b border-[#E8E8ED]' : ''}
                            >
                                <button
                                    id={buttonId}
                                    onClick={() => setOpenIndex(isOpen ? null : i)}
                                    aria-expanded={isOpen}
                                    aria-controls={panelId}
                                    className="w-full flex items-center justify-between py-5 px-6 text-left hover:bg-[#F5F5F7]/50 transition-colors focus-visible:bg-[#F5F5F7]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40"
                                >
                                    <span className="font-jakarta text-sm md:text-base font-semibold text-[#1D1D1F] pr-4">
                                        {faq.question}
                                    </span>
                                    <motion.span
                                        animate={{ rotate: isOpen ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="shrink-0"
                                        aria-hidden
                                    >
                                        <ChevronDown className="w-4 h-4 text-[#86868B]" />
                                    </motion.span>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            id={panelId}
                                            role="region"
                                            aria-labelledby={buttonId}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: 'easeOut' }}
                                            className="overflow-hidden"
                                        >
                                            <p className="font-jakarta text-[#6E6E73] text-sm leading-relaxed px-6 pb-5">
                                                {faq.answer}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
    {
        question: 'Preciso pagar para testar?',
        answer: 'Não. Você tem 7 dias grátis com acesso completo. Cancele a qualquer momento se não gostar.',
    },
    {
        question: 'Quanto o Kinevo cobra sobre meus pagamentos?',
        answer: 'Zero. Nós não cobramos nenhum percentual. Você paga apenas as taxas padrão do Stripe (processador de pagamentos internacional).',
    },
    {
        question: 'Meus alunos precisam pagar algo?',
        answer: 'Não. O app do aluno é 100% gratuito. Eles baixam, criam a conta e já podem treinar.',
    },
    {
        question: 'O assistente de prescrição substitui o personal trainer?',
        answer: 'De jeito nenhum. Ele gera rascunhos de programas baseados no perfil do aluno para você ganhar tempo. Você edita, ajusta e aprova tudo antes de chegar ao aluno. E quanto mais você edita, mais ele aprende o seu estilo de prescrever.',
    },
    {
        question: 'Funciona para treino presencial e online?',
        answer: 'Sim. Para presencial, você tem a Sala de Treino — um modo exclusivo para acompanhar múltiplos alunos na academia em tempo real. Para online, o app + dashboard de aderência te dão visibilidade total.',
    },
    {
        question: 'Posso cancelar quando quiser?',
        answer: 'Sim. Sem fidelidade, sem multa. Cancele direto no painel, sem precisar falar com ninguém.',
    },
    {
        question: 'O app funciona no iPhone e Android?',
        answer: 'Sim. App nativo para ambos, com Apple Watch e Live Activity no iOS.',
    },
    {
        question: 'E se a internet da academia for ruim?',
        answer: 'O app funciona offline. O aluno treina normalmente e os dados sincronizam quando a conexão volta.',
    },
    {
        question: 'O Kinevo usa inteligência artificial?',
        answer: 'Sim, mas como ferramenta, não como substituto. O assistente de prescrição gera rascunhos de programas para agilizar seu trabalho. Você sempre tem a palavra final. Também usamos IA nos formulários, gerando anamneses e check-ins em segundos a partir de templates.',
    },
]

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
                                    onClick={() => setOpenIndex(isOpen ? null : i)}
                                    className="w-full flex items-center justify-between py-5 px-6 text-left hover:bg-[#F5F5F7]/50 transition-colors"
                                >
                                    <span className="font-jakarta text-sm md:text-base font-semibold text-[#1D1D1F] pr-4">
                                        {faq.question}
                                    </span>
                                    <motion.span
                                        animate={{ rotate: isOpen ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="shrink-0"
                                    >
                                        <ChevronDown className="w-4 h-4 text-[#86868B]" />
                                    </motion.span>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
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

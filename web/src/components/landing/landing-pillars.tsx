'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Check, DollarSign, Users, Heart, AlertTriangle } from 'lucide-react'

interface Pillar {
    label: string
    title: string
    description: string
    bullets: string[]
    image: string | null
    imageAlt: string
}

const pillars: Pillar[] = [
    {
        label: 'PRESCRIÇÃO',
        title: 'Monte programas completos em minutos, não em horas.',
        description:
            'Construtor visual de programas com supersets, notas por exercício e substituições pré-aprovadas. Formulários inteligentes para anamnese, check-in e reavaliação. E quando você quiser agilizar, conte com um assistente que gera rascunhos de programas baseados no perfil de cada aluno — e que aprende com cada edição que você faz.',
        bullets: [
            'Construtor visual com supersets, notas e substituições',
            'Periodização real em 4 fases: adaptação, consolidação, sobrecarga e deload',
            'Assistente de prescrição que aprende o seu estilo a cada edição',
            '4 templates de formulário prontos (anamnese, check-in, reavaliação, feedback)',
            'Biblioteca de exercícios com vídeos, grupos musculares e equipamento',
        ],
        image: '/836shots_so.png',
        imageAlt: 'Kinevo — construtor de programas de treino',
    },
    {
        label: 'ACOMPANHAMENTO',
        title: 'Saiba quem treinou, quem faltou e quem precisa da sua atenção.',
        description:
            'Dashboard de aderência com percentuais, streaks e sparklines diários. Na academia, use a Sala de Treino para acompanhar múltiplos alunos ao mesmo tempo, em tempo real. Depois, acompanhe de qualquer lugar pelo painel ou pelas notificações push.',
        bullets: [
            'Dashboard com % de aderência, treinos da semana e histórico completo',
            'Sala de Treino: acompanhe sets e cargas em tempo real na academia',
            'Notificações push: treino concluído, formulário respondido, pagamento recebido',
            'Inbox do aluno: hub unificado com formulários, feedback e alertas',
        ],
        image: '/407shots_so.png',
        imageAlt: 'Kinevo — dashboard de acompanhamento',
    },
    {
        label: 'FINANCEIRO',
        title: 'Receba 100% do que é seu. Zero taxa Kinevo.',
        description:
            'Cobranças automáticas via Stripe, direto na sua conta. Crie planos personalizados, acompanhe inadimplência com grace period e bloqueio automático, e veja seu MRR em tempo real. O Kinevo não fica com nenhum percentual dos seus pagamentos.',
        bullets: [
            '0% taxa Kinevo — apenas as taxas padrão do Stripe',
            'Cobranças recorrentes, cortesia, manual ou avulso',
            'Controle de inadimplência com bloqueio automático',
            'Dashboard financeiro com MRR e histórico de transações',
        ],
        image: null,
        imageAlt: 'Kinevo — dashboard financeiro',
    },
]

const financialCards = [
    {
        icon: DollarSign,
        iconBg: 'bg-[#34C759]/10',
        iconColor: 'text-[#34C759]',
        label: 'Receita do mês',
        value: 'R$ 4.790,00',
    },
    {
        icon: Users,
        iconBg: 'bg-[#007AFF]/10',
        iconColor: 'text-[#007AFF]',
        label: 'Alunos pagantes',
        value: '12',
    },
    {
        icon: Heart,
        iconBg: 'bg-[#007AFF]/10',
        iconColor: 'text-[#007AFF]',
        label: 'Em cortesia',
        value: '3',
    },
    {
        icon: AlertTriangle,
        iconBg: 'bg-[#FF3B30]/10',
        iconColor: 'text-[#FF3B30]',
        label: 'Atenção',
        value: '1',
    },
]

function FinancialCards() {
    return (
        <div className="w-full grid grid-cols-2 gap-3">
            {financialCards.map((card, i) => (
                <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
                    className="bg-white rounded-xl border border-[#E5E5EA] p-5"
                >
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                            <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                        </div>
                        <span className="font-jakarta text-xs text-[#86868B]">{card.label}</span>
                    </div>
                    <p className="font-jakarta text-2xl font-bold text-[#1D1D1F] mt-3">
                        {card.value}
                    </p>
                </motion.div>
            ))}
        </div>
    )
}

export function LandingPillars() {
    return (
        <section>
            {pillars.map((pillar, index) => {
                const isReversed = index % 2 === 1
                const bgColor = index % 2 === 0 ? 'bg-white' : 'bg-[#F5F5F7]'

                return (
                    <div key={pillar.label} className={`${bgColor} py-24 md:py-32`}>
                        <div className="mx-auto max-w-7xl px-6">
                            <div className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20`}>
                                {/* Text */}
                                <div className="flex-1">
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, margin: '-100px' }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                    >
                                        <span className="font-jakarta text-sm font-semibold uppercase tracking-widest text-[#7C3AED]">
                                            {pillar.label}
                                        </span>
                                        <h2 className="font-jakarta text-3xl md:text-4xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                                            {pillar.title}
                                        </h2>
                                        <p className="font-jakarta text-[#86868B] text-base leading-relaxed mt-5">
                                            {pillar.description}
                                        </p>
                                        <ul className="mt-8 space-y-3">
                                            {pillar.bullets.map((bullet) => (
                                                <li key={bullet} className="flex items-start gap-3">
                                                    <Check className="w-5 h-5 text-[#34C759] mt-0.5 shrink-0" />
                                                    <span className="font-jakarta text-sm text-[#1D1D1F]">
                                                        {bullet}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                </div>

                                {/* Image */}
                                <motion.div
                                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                    viewport={{ once: true, margin: '-100px' }}
                                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                                    className="flex-1 w-full"
                                >
                                    {pillar.image ? (
                                        <Image
                                            src={pillar.image}
                                            alt={pillar.imageAlt}
                                            width={1920}
                                            height={1080}
                                            className="w-full h-auto rounded-2xl"
                                        />
                                    ) : (
                                        <FinancialCards />
                                    )}
                                </motion.div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </section>
    )
}

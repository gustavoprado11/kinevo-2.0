'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Check,
    ClipboardEdit,
    BarChart3,
    DollarSign,
    Users,
    Heart,
    AlertTriangle,
} from 'lucide-react'

interface Pillar {
    id: string
    icon: typeof ClipboardEdit
    label: string
    title: string
    description: string
    bullets: string[]
    image: string | null
    imageAlt: string
    accentColor: string
}

const pillars: Pillar[] = [
    {
        id: 'prescricao',
        icon: ClipboardEdit,
        label: 'Prescrição',
        title: 'Monte programas completos em minutos, não em horas.',
        description:
            'Construtor visual de programas com supersets, notas por exercício e substituições pré-aprovadas. Formulários inteligentes para anamnese, check-in e reavaliação. E quando você quiser agilizar, conte com um assistente que gera rascunhos baseados no perfil de cada aluno.',
        bullets: [
            'Construtor visual com supersets, notas e substituições',
            'Periodização real em 4 fases: adaptação, consolidação, sobrecarga e deload',
            'Assistente de prescrição que aprende o seu estilo a cada edição',
            '4 templates de formulário prontos (anamnese, check-in, reavaliação, feedback)',
            'Biblioteca de exercícios com vídeos, grupos musculares e equipamento',
        ],
        image: '/836shots_so.png',
        imageAlt: 'Kinevo — construtor de programas de treino',
        accentColor: '#7C3AED',
    },
    {
        id: 'acompanhamento',
        icon: BarChart3,
        label: 'Acompanhamento',
        title: 'Saiba quem treinou, quem faltou e quem precisa da sua atenção.',
        description:
            'Dashboard de aderência com percentuais, streaks e sparklines diários. Na academia, use a Sala de Treino para acompanhar múltiplos alunos ao mesmo tempo, em tempo real.',
        bullets: [
            'Dashboard com % de aderência, treinos da semana e histórico completo',
            'Sala de Treino: acompanhe sets e cargas em tempo real na academia',
            'Notificações push: treino concluído, formulário respondido, pagamento recebido',
            'Inbox do aluno: hub unificado com formulários, feedback e alertas',
        ],
        image: '/407shots_so.png',
        imageAlt: 'Kinevo — dashboard de acompanhamento',
        accentColor: '#007AFF',
    },
    {
        id: 'financeiro',
        icon: DollarSign,
        label: 'Financeiro',
        title: 'Receba 100% do que é seu. Zero taxa Kinevo.',
        description:
            'Cobranças automáticas via Stripe, direto na sua conta. Crie planos personalizados, acompanhe inadimplência com grace period e bloqueio automático, e veja seu MRR em tempo real.',
        bullets: [
            '0% taxa Kinevo — apenas as taxas padrão do Stripe',
            'Cobranças recorrentes, cortesia, manual ou avulso',
            'Controle de inadimplência com bloqueio automático',
            'Dashboard financeiro com MRR e histórico de transações',
        ],
        image: null,
        imageAlt: 'Kinevo — dashboard financeiro',
        accentColor: '#34C759',
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
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.08 }}
                    className="bg-white rounded-xl border border-[#E8E8ED] p-5 shadow-sm"
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
    const [activeTab, setActiveTab] = useState(0)
    const activePillar = pillars[activeTab]

    return (
        <section className="bg-[#F5F5F7] py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-[#1D1D1F]">
                        Tudo que você precisa.{' '}
                        <span className="text-[#86868B]">Nada que você não precisa.</span>
                    </h2>
                </motion.div>

                {/* Tab navigation */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    className="mt-12 flex justify-center"
                >
                    <div className="inline-flex items-center bg-white rounded-full p-1.5 border border-[#E8E8ED] shadow-sm">
                        {pillars.map((pillar, i) => {
                            const isActive = activeTab === i
                            return (
                                <button
                                    key={pillar.id}
                                    onClick={() => setActiveTab(i)}
                                    className={`relative flex items-center gap-2 font-jakarta text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 ${
                                        isActive
                                            ? 'text-white'
                                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                                    }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="pillar-tab-bg"
                                            className="absolute inset-0 rounded-full bg-[#1D1D1F]"
                                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative flex items-center gap-2">
                                        <pillar.icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{pillar.label}</span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </motion.div>

                {/* Tab content */}
                <div className="mt-12 md:mt-16">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePillar.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20"
                        >
                            {/* Text */}
                            <div className="flex-1">
                                <span
                                    className="inline-flex items-center gap-1.5 font-jakarta text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                                    style={{
                                        color: activePillar.accentColor,
                                        backgroundColor: `${activePillar.accentColor}15`,
                                    }}
                                >
                                    {activePillar.label}
                                </span>

                                <h3 className="font-jakarta text-2xl md:text-3xl font-bold tracking-tight text-[#1D1D1F] mt-4">
                                    {activePillar.title}
                                </h3>

                                <p className="font-jakarta text-[#6E6E73] text-base leading-relaxed mt-4">
                                    {activePillar.description}
                                </p>

                                <ul className="mt-6 space-y-3">
                                    {activePillar.bullets.map((bullet, i) => (
                                        <motion.li
                                            key={bullet}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3, delay: i * 0.06 }}
                                            className="flex items-start gap-3"
                                        >
                                            <div
                                                className="w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                                                style={{ backgroundColor: `${activePillar.accentColor}15` }}
                                            >
                                                <Check
                                                    className="w-3 h-3"
                                                    style={{ color: activePillar.accentColor }}
                                                />
                                            </div>
                                            <span className="font-jakarta text-sm text-[#1D1D1F]">
                                                {bullet}
                                            </span>
                                        </motion.li>
                                    ))}
                                </ul>
                            </div>

                            {/* Visual */}
                            <div className="flex-1 w-full">
                                {activePillar.image ? (
                                    <div className="relative rounded-2xl overflow-hidden border border-black/[0.06] shadow-xl shadow-black/[0.06] bg-white">
                                        <Image
                                            src={activePillar.image}
                                            alt={activePillar.imageAlt}
                                            width={1920}
                                            height={1080}
                                            className="w-full h-auto"
                                        />
                                    </div>
                                ) : (
                                    <FinancialCards />
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}

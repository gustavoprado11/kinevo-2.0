'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GripVertical, BarChart3, Shuffle, FileText, DollarSign, Smartphone, Crown } from 'lucide-react';

const features = [
    {
        icon: GripVertical,
        title: 'Prescreva Treinos com Facilidade',
        description: 'Monte programas completos com drag & drop, supersets, notas tecnicas e organizacao por dias. O canvas mais intuitivo do mercado.',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        span: 'col-span-1 md:col-span-2',
    },
    {
        icon: BarChart3,
        title: 'Volume em Tempo Real',
        description: 'Visualize o calculo automatico de series por grupo muscular enquanto prescreve o treino.',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        span: 'col-span-1',
    },
    {
        icon: Shuffle,
        title: 'Exercicios Substitutos',
        description: 'Defina alternativas para cada exercicio. O aluno troca sozinho no app entre as opcoes pre-definidas por voce.',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-500',
        span: 'col-span-1',
    },
    {
        icon: FileText,
        title: 'Avaliacoes com IA ou Manuais',
        description: 'Crie anamneses e avaliacoes do zero ou com ajuda de inteligencia artificial. Envie para o aluno responder direto no aplicativo.',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        span: 'col-span-1 md:col-span-2',
    },
    {
        icon: DollarSign,
        title: 'Planos e Pagamentos',
        description: 'Crie planos personalizados e receba pagamentos de forma automatica. As unicas taxas cobradas sao as do Stripe — zero taxa do Kinevo.',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        span: 'col-span-1 md:col-span-2',
    },
    {
        icon: Smartphone,
        title: 'App Premium para Alunos',
        description: 'Seus alunos treinam com um app nativo para iOS e Android com cargas automaticas, timer de descanso e Apple Watch.',
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-600',
        span: 'col-span-1',
    },
    {
        icon: Crown,
        title: 'Agregue Valor ao Trabalho',
        description: 'Eleve o nivel da sua consultoria com uma plataforma profissional que transmite credibilidade e qualidade para seus alunos.',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        span: 'col-span-1 md:col-span-3',
    },
];

export const BentoFeatures = () => {
    return (
        <section id="funcionalidades" className="py-24 sm:py-32 bg-[#FAFAFA]">
            <div className="max-w-7xl mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center max-w-2xl mx-auto mb-16"
                >
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-[-0.03em] mb-4">
                        Tudo que voce precisa.{' '}
                        <span className="text-slate-400">Nada que nao precisa.</span>
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed">
                        Ferramentas poderosas para prescrever treinos, acompanhar alunos e escalar sua consultoria fitness.
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.06, duration: 0.5 }}
                                className={`group bg-white rounded-2xl p-6 border border-black/[0.04] hover:border-violet-100 hover:shadow-lg hover:shadow-violet-500/[0.03] transition-all duration-300 ${feature.span}`}
                            >
                                <div className={`w-11 h-11 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon className={feature.iconColor} size={20} />
                                </div>
                                <h3 className="text-[16px] font-bold text-slate-900 mb-1.5">{feature.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, GripVertical, BarChart3, Shuffle, FileText, Sparkle, DollarSign } from 'lucide-react';
import { MacbookMockup } from './mockups/MacbookMockup';
import NextImage from 'next/image';

const features = [
    {
        icon: GripVertical,
        title: 'Crie Programas com Facilidade',
        description: 'Monte treinos completos com drag & drop. Supersets, notas técnicas e organização por dias — tudo em um canvas intuitivo.',
    },
    {
        icon: BarChart3,
        title: 'Volume em Tempo Real',
        description: 'Visualize o cálculo de séries por grupo muscular automaticamente enquanto prescreve. Controle total da periodização.',
    },
    {
        icon: Shuffle,
        title: 'Exercícios Substitutos',
        description: 'Defina alternativas para cada exercício. Seu aluno troca sozinho no app sem precisar te chamar.',
    },
    {
        icon: FileText,
        title: 'Avaliações com IA',
        description: 'Crie anamneses e avaliações manualmente ou com ajuda de IA. Envie para o aluno responder direto no aplicativo.',
    },
    {
        icon: DollarSign,
        title: 'Planos e Pagamentos',
        description: 'Crie planos e receba pagamentos de forma automática. As únicas taxas cobradas são as do Stripe — zero taxa do Kinevo.',
    },
    {
        icon: Sparkle,
        title: 'Agregue Valor ao Trabalho',
        description: 'Eleve o nível da sua consultoria com uma plataforma profissional que transmite credibilidade e qualidade.',
    },
];

export const TrainerManagement = () => {
    return (
        <section id="treinador" className="py-24 sm:py-32 bg-white relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-2xl mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-600 font-bold text-[11px] mb-6 uppercase tracking-wider">
                        <Sparkles size={13} />
                        Para Treinadores
                    </div>

                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-[-0.03em] leading-[1.1] mb-5">
                        Seu painel de controle.{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                            Sem limites.
                        </span>
                    </h2>

                    <p className="text-slate-500 text-lg leading-relaxed">
                        O dashboard web mais completo para prescrever treinos, gerenciar alunos e controlar
                        seu financeiro. Monte programas em minutos, não em horas.
                    </p>
                </motion.div>

                {/* Main Screenshot: Program Builder */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-12"
                >
                    <div className="relative">
                        <div className="absolute -inset-8 bg-gradient-to-br from-violet-100/40 to-purple-100/20 blur-3xl rounded-3xl pointer-events-none" />
                        <div className="relative">
                            <MacbookMockup
                                src="/Tela_prescricao.png"
                                alt="Builder de Programas — Prescrição com cálculo de volume em tempo real"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Secondary Screenshots Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                    {/* Substituições Screenshot */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="relative bg-[#1C1C1E] rounded-2xl overflow-hidden border border-white/[0.06] shadow-xl"
                    >
                        <div className="p-2">
                            <div className="relative aspect-[16/11] rounded-lg overflow-hidden">
                                <NextImage
                                    src="/exemplo_exercicio_substituto.png"
                                    alt="Exercícios Substitutos — Defina alternativas para cada exercício"
                                    fill
                                    className="object-cover object-top"
                                    unoptimized
                                />
                            </div>
                        </div>
                        <div className="px-5 pb-5 pt-2">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Shuffle className="text-violet-400" size={14} />
                                <span className="text-white font-bold text-sm">Exercícios Substitutos</span>
                            </div>
                            <p className="text-white/40 text-xs leading-relaxed">
                                Seu aluno escolhe entre alternativas pré-definidas por você, sem precisar te chamar.
                            </p>
                        </div>
                    </motion.div>

                    {/* Avaliações Screenshot */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="relative bg-[#1C1C1E] rounded-2xl overflow-hidden border border-white/[0.06] shadow-xl"
                    >
                        <div className="p-2">
                            <div className="relative aspect-[16/11] rounded-lg overflow-hidden">
                                <NextImage
                                    src="/formulario.png"
                                    alt="Avaliações — Crie templates com IA ou manualmente"
                                    fill
                                    className="object-cover object-top"
                                    unoptimized
                                />
                            </div>
                        </div>
                        <div className="px-5 pb-5 pt-2">
                            <div className="flex items-center gap-2 mb-1.5">
                                <FileText className="text-violet-400" size={14} />
                                <span className="text-white font-bold text-sm">Avaliações Inteligentes</span>
                            </div>
                            <p className="text-white/40 text-xs leading-relaxed">
                                Crie manualmente ou com IA. O aluno responde direto no aplicativo.
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.08, duration: 0.5 }}
                                className="group p-5 rounded-2xl border border-black/[0.04] hover:border-violet-100 hover:bg-violet-50/30 transition-all duration-300"
                            >
                                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Icon className="text-violet-600" size={18} />
                                </div>
                                <h4 className="text-slate-900 font-bold text-[15px] mb-1">{feature.title}</h4>
                                <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

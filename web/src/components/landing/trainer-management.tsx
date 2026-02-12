'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, GripVertical, Shuffle, BarChart3 } from 'lucide-react';
import { MacbookMockup } from './mockups/MacbookMockup';

const features = [
    {
        icon: GripVertical,
        title: 'Drag & Drop intuitivo',
        description: 'Arraste exercícios da biblioteca direto para o canvas. Reordene blocos e crie supersets em segundos.',
    },
    {
        icon: Shuffle,
        title: 'Exercícios Substitutos',
        description: 'Defina alternativas inteligentes para cada exercício. Seu aluno troca no app sem precisar te chamar.',
    },
    {
        icon: BarChart3,
        title: 'Volume Summary Bar',
        description: 'Visualize o volume de séries por grupo muscular em tempo real enquanto monta o treino.',
    },
];

export const TrainerManagement = () => {
    return (
        <section id="features" className="py-24 bg-white relative overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    {/* Text Section (Left) */}
                    <div className="flex-1 order-2 lg:order-1">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="max-w-xl"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-200/60 text-violet-600 font-bold text-xs mb-6 uppercase tracking-wider">
                                <Sparkles size={14} />
                                Builder Pro
                            </div>

                            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tighter mb-6">
                                Monte treinos em minutos,{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                                    não em horas.
                                </span>
                            </h2>

                            <p className="text-slate-500 text-lg leading-relaxed mb-10">
                                O Canvas de Treino mais avançado do mercado. Monte programas complexos com facilidade e
                                deixe a inteligência do sistema trabalhar por você.
                            </p>

                            <div className="space-y-6">
                                {features.map((feature, index) => {
                                    const Icon = feature.icon;
                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: index * 0.1 }}
                                            className="flex items-start gap-4"
                                        >
                                            <div className="mt-0.5 w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                                                <Icon className="text-violet-600" size={16} />
                                            </div>
                                            <div>
                                                <h4 className="text-slate-900 font-bold">{feature.title}</h4>
                                                <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{feature.description}</p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>

                    {/* Visual Section (Right) — MacBook Mockup */}
                    <div className="flex-1 order-1 lg:order-2 relative">
                        <motion.div
                            initial={{ opacity: 0, x: 40 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="relative z-10"
                        >
                            <div className="relative max-w-2xl mx-auto">
                                <MacbookMockup
                                    src="/treino.png"
                                    alt="Canvas de Treino — Builder Pro"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

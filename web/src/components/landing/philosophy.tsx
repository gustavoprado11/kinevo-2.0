'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Target, Layers } from 'lucide-react';

const pillars = [
    {
        icon: Heart,
        iconColor: 'text-rose-500',
        iconBg: 'bg-rose-50',
        title: 'Simplicidade Radical',
        description: 'Eliminamos a complexidade. O software deve ser invisivel — permitindo que o foco total seja no treino e no resultado do aluno.',
    },
    {
        icon: Target,
        iconColor: 'text-violet-600',
        iconBg: 'bg-violet-50',
        title: 'Valor para o Treinador',
        description: 'Cada funcionalidade foi pensada para agregar valor real ao seu trabalho. Transmita profissionalismo e credibilidade em cada interacao com o aluno.',
    },
    {
        icon: Layers,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
        title: 'De Treinador para Treinador',
        description: 'Nao somos apenas uma empresa de tech. Entendemos as dores reais do salao de musculacao e da consultoria online.',
    },
];

export const Philosophy = () => {
    return (
        <section id="philosophy" className="py-24 sm:py-32 bg-white relative overflow-hidden">
            {/* Subtle background accent */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-violet-50/50 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] mb-6 uppercase tracking-wider">
                        Nossa Filosofia
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-[-0.03em] leading-[1.1] mb-5">
                        Tecnologia que potencializa{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                            a inteligencia do treinador.
                        </span>
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed">
                        Acreditamos que o melhor software e aquele que voce esquece que esta usando.
                        Ele simplesmente funciona — e eleva o nivel do seu trabalho.
                    </p>
                </motion.div>

                {/* Pillar Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {pillars.map((pillar, index) => {
                        const Icon = pillar.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                className="group relative"
                            >
                                <div className="bg-white border border-black/[0.04] hover:border-violet-100 rounded-2xl p-8 hover:shadow-lg hover:shadow-violet-500/[0.04] transition-all duration-300 h-full">
                                    <div className={`mb-6 w-14 h-14 rounded-2xl ${pillar.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <Icon className={pillar.iconColor} size={26} />
                                    </div>
                                    <h3 className="font-display text-xl font-extrabold text-slate-900 tracking-tight mb-3">
                                        {pillar.title}
                                    </h3>
                                    <p className="text-slate-500 leading-relaxed">
                                        {pillar.description}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Quote */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-16 text-center max-w-2xl mx-auto"
                >
                    <blockquote className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight leading-snug italic">
                        &ldquo;O primeiro sistema feito por treinadores para treinadores.&rdquo;
                    </blockquote>
                    <div className="mt-4 text-sm text-slate-400 font-semibold uppercase tracking-wider">
                        Equipe Kinevo
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

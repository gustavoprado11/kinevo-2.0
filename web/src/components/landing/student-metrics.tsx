'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PenLine, Smartphone, Crown, ArrowRight } from 'lucide-react';

const steps = [
    {
        number: '01',
        icon: PenLine,
        title: 'Prescreva',
        heading: 'Monte programas com facilidade e controle total',
        description: 'Use o Builder Pro com drag & drop, calculo de volume em tempo real por grupo muscular, exercicios substitutos e avaliacoes com IA — tudo em um canvas intuitivo.',
        color: 'violet',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
    },
    {
        number: '02',
        icon: Smartphone,
        title: 'Entregue',
        heading: 'Seus alunos treinam com um app premium',
        description: 'App nativo para iOS e Android com cargas automaticas, timer de descanso, historico completo, calendario inteligente e Apple Watch. Uma experiencia premium.',
        color: 'emerald',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
    },
    {
        number: '03',
        icon: Crown,
        title: 'Escale',
        heading: 'Agregue valor e profissionalize sua consultoria',
        description: 'Receba pagamentos com zero taxa do Kinevo, acompanhe metricas de adesao, envie avaliacoes e ofereca uma experiencia que transmite credibilidade.',
        color: 'amber',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
    },
];

export const StudentMetrics = () => {
    return (
        <section id="como-funciona" className="py-24 sm:py-32 bg-[#FAFAFA]">
            <div className="max-w-7xl mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center max-w-2xl mx-auto mb-20"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] mb-6 uppercase tracking-wider">
                        Como Funciona
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-[-0.03em] leading-[1.1]">
                        Simples para voce.{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                            Premium para o aluno.
                        </span>
                    </h2>
                    <p className="mt-5 text-slate-500 text-lg leading-relaxed">
                        Tres etapas para transformar sua consultoria fitness em uma experiencia profissional.
                    </p>
                </motion.div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                className="relative group"
                            >
                                <div className="bg-white rounded-2xl p-8 border border-black/[0.04] hover:shadow-lg hover:shadow-violet-500/[0.04] transition-all duration-300 h-full">
                                    {/* Step Number */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`w-12 h-12 rounded-2xl ${step.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <Icon className={step.iconColor} size={22} />
                                        </div>
                                        <span className="font-display text-5xl font-extrabold text-slate-100 tracking-tight select-none">
                                            {step.number}
                                        </span>
                                    </div>

                                    {/* Label */}
                                    <div className={`text-xs font-bold uppercase tracking-wider ${step.iconColor} mb-3`}>
                                        {step.title}
                                    </div>

                                    {/* Content */}
                                    <h3 className="font-display text-xl font-extrabold text-slate-900 tracking-tight mb-3 leading-snug">
                                        {step.heading}
                                    </h3>
                                    <p className="text-slate-500 text-[15px] leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>

                                {/* Arrow between steps (desktop only) */}
                                {index < steps.length - 1 && (
                                    <div className="hidden md:flex absolute -right-4 lg:-right-5 top-1/2 -translate-y-1/2 z-10">
                                        <ArrowRight size={18} className="text-slate-300" />
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Dumbbell, Flame, TrendingUp } from 'lucide-react';
import { MacbookMockup } from './mockups/MacbookMockup';

const metrics = [
    {
        label: 'Treinos Totais',
        value: '142',
        change: '+12 este mês',
        icon: Dumbbell,
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        changeBg: 'bg-emerald-50',
        changeColor: 'text-emerald-600',
    },
    {
        label: 'Streak Semanal',
        value: '4/5',
        change: '80% de adesão',
        icon: Flame,
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-500',
        changeBg: 'bg-orange-50',
        changeColor: 'text-orange-600',
    },
    {
        label: 'Taxa de Adesão',
        value: '94%',
        change: '+3% vs. mês anterior',
        icon: TrendingUp,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        changeBg: 'bg-emerald-50',
        changeColor: 'text-emerald-600',
    },
];

export const StudentMetrics = () => {
    return (
        <section className="py-24 bg-[#F9F9FB]">
            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center max-w-2xl mx-auto mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-200/60 text-violet-600 font-bold text-xs mb-6 uppercase tracking-wider">
                        <TrendingUp size={14} />
                        Monitoramento Inteligente
                    </div>
                    <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tighter mb-4">
                        O Aluno em Dados.
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed">
                        Monitore o progresso de cada aluno com métricas reais.
                        Saiba exatamente quem está treinando, quem parou e quem precisa de atenção.
                    </p>
                </motion.div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
                    {metrics.map((metric, index) => {
                        const Icon = metric.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white rounded-2xl p-6 border border-black/[0.06] shadow-apple-card hover:shadow-apple-elevated transition-shadow"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-10 h-10 rounded-xl ${metric.iconBg} flex items-center justify-center`}>
                                        <Icon className={metric.iconColor} size={20} />
                                    </div>
                                    <span className={`text-[11px] font-semibold ${metric.changeColor} ${metric.changeBg} px-2.5 py-0.5 rounded-full`}>
                                        {metric.change}
                                    </span>
                                </div>
                                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                    {metric.value}
                                </div>
                                <div className="text-sm text-slate-500 mt-1 font-medium">
                                    {metric.label}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Real Screenshot — Student Detail */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, duration: 0.7 }}
                    className="mt-16 max-w-5xl mx-auto"
                >
                    <MacbookMockup
                        src="/treino.png"
                        alt="Painel do aluno — Métricas, calendário semanal e histórico"
                    />
                </motion.div>
            </div>
        </section>
    );
};

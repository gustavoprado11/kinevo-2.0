'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bell, DollarSign, BarChart3, Shuffle, Watch, Monitor } from 'lucide-react';

const features = [
    {
        icon: Bell,
        title: 'Notificações Inteligentes',
        description: 'Alertas automáticos quando um aluno completa o treino, pula um dia ou precisa de atenção.',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
    },
    {
        icon: DollarSign,
        title: 'Gestão Financeira',
        description: 'Controle de pagamentos, planos e assinaturas dos seus alunos em um só lugar.',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
    },
    {
        icon: BarChart3,
        title: 'Relatórios de Desempenho',
        description: 'Gráficos detalhados de volume, intensidade e progressão para cada aluno.',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
    },
    {
        icon: Shuffle,
        title: 'Exercícios Substitutos',
        description: 'O aluno troca exercícios no app entre alternativas pré-definidas por você.',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-500',
    },
    {
        icon: Watch,
        title: 'Apple Watch',
        description: 'Timer de descanso e marcação de séries direto no pulso. Sem pegar o celular.',
        iconBg: 'bg-red-50',
        iconColor: 'text-red-500',
    },
    {
        icon: Monitor,
        title: 'Multi-plataforma',
        description: 'Dashboard web para o treinador, app mobile para o aluno. Tudo sincronizado em tempo real.',
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-600',
    },
];

export const BentoFeatures = () => {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center max-w-2xl mx-auto mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tighter mb-4">
                        Tudo que você precisa.
                    </h2>
                    <p className="text-slate-500 text-lg leading-relaxed">
                        Ferramentas poderosas que funcionam juntas para escalar sua consultoria.
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.08 }}
                                className="group bg-white rounded-2xl p-6 border border-black/[0.06] hover:border-violet-200 hover:shadow-apple-elevated transition-all duration-300"
                            >
                                <div className={`w-12 h-12 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon className={feature.iconColor} size={22} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

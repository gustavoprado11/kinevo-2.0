'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Moon, History, TrendingUp, MessageCircle, Watch } from 'lucide-react';
import { IphoneMockup } from './mockups/IphoneMockup';

const features = [
    {
        icon: Moon,
        title: 'Dark Mode Nativo',
        description: 'Interface premium otimizada para uso na academia. Elegante, legível e sem distrações.',
    },
    {
        icon: History,
        title: 'Histórico de Cargas',
        description: 'Acesso completo a todas as cargas de sessões anteriores. O app preenche automaticamente.',
    },
    {
        icon: TrendingUp,
        title: 'Progressão Visual',
        description: 'Recordes pessoais, volume total e gráficos de evolução para manter o aluno motivado.',
    },
    {
        icon: MessageCircle,
        title: 'Feedback & PSE',
        description: 'Avaliação pós-treino com escala de esforço. Você recebe os dados em tempo real.',
    },
    {
        icon: Watch,
        title: 'Apple Watch',
        description: 'Timer de descanso no pulso e marcação de séries sem pegar o celular.',
    },
];

export const StudentExperience = () => {
    return (
        <section className="py-24 bg-[#F9F9FB]">
            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    {/* Visual Section — iPhone Mockup (Left) */}
                    <div className="flex-1 relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative flex justify-center"
                        >
                            {/* iPhone with workout screenshot */}
                            <div className="relative w-[240px] md:w-[280px]">
                                <IphoneMockup
                                    src="/mobile-workout.png"
                                    alt="App do Aluno — Execução de treino"
                                />
                            </div>

                            {/* Floating Badge — Top Left */}
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-12 -left-2 md:left-4 bg-white rounded-xl p-3 shadow-apple-elevated border border-black/[0.06] flex items-center gap-2.5 z-10"
                            >
                                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                    <TrendingUp className="text-violet-600" size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Progresso</div>
                                    <div className="text-slate-900 font-bold text-sm">+15% Volume</div>
                                </div>
                            </motion.div>

                            {/* Floating Badge — Bottom Right */}
                            <motion.div
                                animate={{ y: [0, 8, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="absolute bottom-20 -right-2 md:right-4 bg-white rounded-xl p-3 shadow-apple-elevated border border-black/[0.06] flex items-center gap-2.5 z-10"
                            >
                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                                    <MessageCircle className="text-orange-500" size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">PSE</div>
                                    <div className="text-slate-900 font-bold text-sm">7 — Intenso</div>
                                </div>
                            </motion.div>

                            {/* Floating Badge — Mid Left */}
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                className="absolute bottom-40 -left-4 md:left-0 bg-white rounded-xl p-3 shadow-apple-elevated border border-black/[0.06] flex items-center gap-2.5 z-10"
                            >
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Watch className="text-emerald-600" size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Watch</div>
                                    <div className="text-slate-900 font-bold text-sm">Descanso: 1:30</div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* Text Section (Right) */}
                    <div className="flex-1">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="max-w-xl"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-200/60 text-violet-600 font-bold text-xs mb-6 uppercase tracking-wider">
                                <Moon size={14} />
                                A Experiência do Aluno
                            </div>

                            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tighter mb-6">
                                Premium no bolso{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                                    do seu aluno.
                                </span>
                            </h2>

                            <p className="text-slate-500 text-lg leading-relaxed mb-10">
                                Um aplicativo que seus alunos vão amar usar. Design premium, cargas automáticas e
                                feedback inteligente em um app nativo para iOS e Android.
                            </p>

                            <div className="space-y-5">
                                {features.map((feature, index) => {
                                    const Icon = feature.icon;
                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: index * 0.08 }}
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
                </div>
            </div>
        </section>
    );
};

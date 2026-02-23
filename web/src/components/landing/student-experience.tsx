'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Moon, History, TrendingUp, MessageCircle, Watch, Timer, Share2, CalendarDays } from 'lucide-react';
import { IphoneMockup } from './mockups/IphoneMockup';

const features = [
    {
        icon: Moon,
        title: 'Design Premium',
        description: 'Interface elegante e intuitiva, feita para o ambiente real da academia.',
        iconBg: 'bg-slate-800',
        iconColor: 'text-white',
    },
    {
        icon: History,
        title: 'Cargas Automáticas',
        description: 'O app preenche as cargas da última sessão. Seu aluno só precisa treinar.',
        iconBg: 'bg-violet-500',
        iconColor: 'text-white',
    },
    {
        icon: Timer,
        title: 'Timer de Descanso',
        description: 'Countdown automático entre séries com notificação sonora.',
        iconBg: 'bg-orange-500',
        iconColor: 'text-white',
    },
    {
        icon: TrendingUp,
        title: 'Recordes Pessoais',
        description: 'PRs destacados e evolução visual para manter a motivação em alta.',
        iconBg: 'bg-emerald-500',
        iconColor: 'text-white',
    },
    {
        icon: CalendarDays,
        title: 'Calendário Inteligente',
        description: 'Visão semanal e mensal com treinos concluídos, pendentes e meta semanal.',
        iconBg: 'bg-blue-500',
        iconColor: 'text-white',
    },
    {
        icon: Watch,
        title: 'Apple Watch',
        description: 'Timer e marcação de séries direto no pulso. Sem pegar o celular.',
        iconBg: 'bg-red-500',
        iconColor: 'text-white',
    },
    {
        icon: MessageCircle,
        title: 'Feedback & PSE',
        description: 'Avaliação pós-treino com escala de esforço percebido em tempo real.',
        iconBg: 'bg-cyan-500',
        iconColor: 'text-white',
    },
    {
        icon: Share2,
        title: 'Compartilhamento',
        description: 'Compartilhe treinos concluídos nas redes sociais com templates prontos.',
        iconBg: 'bg-pink-500',
        iconColor: 'text-white',
    },
];

export const StudentExperience = () => {
    return (
        <section id="aluno" className="py-24 sm:py-32 mesh-gradient-dark relative overflow-hidden grain-overlay">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
                    {/* Phone Mockup (Left) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-shrink-0 relative"
                    >
                        <div className="relative">
                            {/* Main phone — Home screen */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                                className="w-[240px] sm:w-[280px] md:w-[300px] relative z-10"
                            >
                                <IphoneMockup
                                    src="/mobile-home.png"
                                    alt="App do Aluno — Tela inicial com calendário e programa atual"
                                />
                            </motion.div>
                        </div>

                        {/* Floating metric badges */}
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute -top-4 -right-4 bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/10 shadow-2xl"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <TrendingUp className="text-emerald-400" size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wide">Meta</div>
                                    <div className="text-white font-bold text-sm">1 / 5 treinos</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 6, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                            className="absolute bottom-20 -left-6 bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/10 shadow-2xl"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                    <Watch className="text-violet-400" size={14} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wide">Descanso</div>
                                    <div className="text-white font-bold text-sm">1:30</div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Text + Feature Grid (Right) */}
                    <div className="flex-1">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-violet-300 font-bold text-[11px] mb-6 uppercase tracking-wider">
                                <Moon size={13} />
                                Experiência Premium
                            </div>

                            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-[-0.03em] leading-[1.1] mb-5">
                                Ofereça uma experiência{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-300">
                                    que seus alunos vão amar.
                                </span>
                            </h2>

                            <p className="text-white/50 text-lg leading-relaxed mb-10 max-w-lg">
                                Um app nativo para iOS e Android com design premium, cargas automáticas
                                e feedback inteligente. Agregue valor real ao seu trabalho.
                            </p>
                        </motion.div>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {features.map((feature, index) => {
                                const Icon = feature.icon;
                                return (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 12 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.06, duration: 0.4 }}
                                        className="flex items-start gap-3 p-3.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                                    >
                                        <div className={`w-9 h-9 rounded-lg ${feature.iconBg} flex items-center justify-center flex-shrink-0`}>
                                            <Icon className={feature.iconColor} size={16} />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">{feature.title}</h4>
                                            <p className="text-white/40 text-[13px] mt-0.5 leading-relaxed">{feature.description}</p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

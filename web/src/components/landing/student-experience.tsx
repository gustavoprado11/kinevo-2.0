'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Video, TrendingUp } from 'lucide-react';
import { IphoneMockup } from './mockups/IphoneMockup';

export const StudentExperience = () => {
    const features = [
        {
            icon: <Zap className="text-emerald-400" size={24} />,
            title: "Smart Auto-fill",
            description: "O app preenche as cargas automaticamente baseado no histórico. Adeus anotações manuais e perda de tempo."
        },
        {
            icon: <Video className="text-violet-400" size={24} />,
            title: "Vídeo Nativo",
            description: "Aulas de execução perfeitas sem sair da tela do treino. Seu aluno nunca mais terá dúvida no movimento."
        },
        {
            icon: <TrendingUp className="text-blue-400" size={24} />,
            title: "Gamificação Real",
            description: "Histórico de cargas e recordes pessoais visuais que motivam o aluno a bater suas próprias metas."
        }
    ];

    return (
        <section id="features" className="py-24 bg-slate-950">
            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    {/* Text Section */}
                    <div className="flex-1 order-2 lg:order-1">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="max-w-xl"
                        >
                            <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-8">
                                Seu aluno nunca viu <br />
                                <span className="text-emerald-500 italic font-serif">nada igual.</span>
                            </h2>

                            <div className="space-y-10">
                                {features.map((feature, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex gap-5"
                                    >
                                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg shadow-black/50">
                                            {feature.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-100 mb-2">{feature.title}</h3>
                                            <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Visual Section — Real iPhone Mockup */}
                    <div className="flex-1 order-1 lg:order-2 relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                            whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                            viewport={{ once: true }}
                            className="relative flex justify-center"
                        >
                            {/* Glow behind mobile */}
                            <div className="absolute -inset-10 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />

                            {/* iPhone with workout screenshot */}
                            <div className="relative w-[240px] md:w-[280px]">
                                <IphoneMockup
                                    src="/mobile-workout.png"
                                    alt="Tela de execução de treino com vídeo integrado"
                                />
                            </div>

                            {/* Floating Badge */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute bottom-16 -right-2 md:right-4 lg:right-8 bg-slate-800 border border-slate-700 p-3 rounded-2xl shadow-2xl flex items-center gap-3 z-10"
                            >
                                <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                                    <TrendingUp size={20} className="text-white" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 font-black uppercase">Progresso</div>
                                    <div className="text-white font-bold text-sm">+15% Volume</div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

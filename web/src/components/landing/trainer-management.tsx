'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { MacbookMockup } from './mockups/MacbookMockup';

export const TrainerManagement = () => {
    return (
        <section className="py-24 bg-slate-950 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/2 left-0 -translate-x-1/2 w-96 h-96 bg-violet-600/5 blur-[100px] rounded-full" />

            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    {/* Visual Section (Left) — MacBook Mockup */}
                    <div className="flex-1 relative order-2 lg:order-1">
                        <motion.div
                            initial={{ opacity: 0, x: -40 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="relative z-10"
                        >
                            {/* Glow */}
                            <div className="absolute -inset-10 bg-violet-500/10 blur-[80px] rounded-full pointer-events-none" />

                            {/* MacBook with dashboard screenshot */}
                            <div className="relative max-w-2xl mx-auto">
                                <MacbookMockup
                                    src="/dashboard-main.png"
                                    alt="Dashboard Kinevo — Gestão de alunos"
                                />
                            </div>
                        </motion.div>
                    </div>

                    {/* Text Section (Right) */}
                    <div className="flex-1 order-1 lg:order-2">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="max-w-xl"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold text-xs mb-6 uppercase tracking-wider">
                                <BarChart3 size={14} />
                                Visão Web Dashboard
                            </div>

                            <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-8">
                                Visão de Águia sobre <br />
                                <span className="text-violet-500">sua Consultoria.</span>
                            </h2>

                            <p className="text-slate-400 text-lg leading-relaxed mb-10">
                                Abandone o gerenciamento por mensagens e planilhas soltas. O Kinevo centraliza o desempenho de todos os seus alunos em um dashboard intuitivo e veloz.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">Feed em Tempo Real</h4>
                                        <p className="text-slate-500 text-sm">Saiba quem treinou hoje e como foi o desempenho (RPE) instantaneamente.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">Monitoramento de Carga</h4>
                                        <p className="text-slate-500 text-sm">Controle de volume, intensidade e adesão total com gráficos detalhados por aluno.</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

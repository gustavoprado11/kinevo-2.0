'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { ProDisplayMockup } from './mockups/ProDisplayMockup';
import { IphoneMockup } from './mockups/IphoneMockup';

export const Hero = () => {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-white">
            {/* Subtle top gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-violet-50/40 via-transparent to-transparent pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10 flex flex-col items-center">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200/60 text-violet-600 text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2"
                >
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    O Futuro da Consultoria Fitness
                </motion.div>

                {/* H1 */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-slate-900 text-center leading-[1.05] tracking-tighter max-w-4xl"
                >
                    A Evolução da Prescrição{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-violet-400">
                        de Treinos.
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 text-lg md:text-xl text-slate-500 text-center max-w-2xl leading-relaxed"
                >
                    O primeiro sistema feito por treinadores para treinadores.
                    Entregue uma experiência viciante para seus alunos e ganhe tempo na gestão.
                </motion.p>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-10 flex flex-col sm:flex-row items-center gap-4"
                >
                    <Link
                        href="/signup"
                        className="shimmer-btn w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 text-white font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-violet-500/20 flex items-center justify-center gap-2"
                    >
                        Começar Agora
                        <ChevronRight size={20} />
                    </Link>
                </motion.div>

                {/* Device Mockup Composition */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="mt-20 relative w-full max-w-5xl px-4"
                >
                    {/* Pro Display — centered */}
                    <div className="relative z-0">
                        <ProDisplayMockup
                            src="/dashboard-main.png"
                            alt="Dashboard Kinevo — Visão geral do treinador"
                        />
                    </div>

                    {/* iPhone — floating bottom-right */}
                    <motion.div
                        animate={{ y: [0, -12, 0] }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute -bottom-8 right-0 md:right-8 lg:right-16 w-[120px] sm:w-[150px] md:w-[190px] lg:w-[220px] z-10"
                    >
                        <div className="relative">
                            <IphoneMockup
                                src="/mobile-home.png"
                                alt="App do Aluno — Tela inicial"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

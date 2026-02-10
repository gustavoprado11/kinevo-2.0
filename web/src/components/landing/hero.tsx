'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Play } from 'lucide-react';
import { MacbookMockup } from './mockups/MacbookMockup';
import { IphoneMockup } from './mockups/IphoneMockup';

export const Hero = () => {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden bg-slate-950">
            {/* Background Glows */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10 flex flex-col items-center">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-violet-400 text-xs font-bold tracking-wider uppercase inline-flex items-center gap-2"
                >
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    O Futuro da Consultoria Fitness
                </motion.div>

                {/* Main Content */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-7xl font-extrabold text-white text-center leading-tight tracking-tight max-w-4xl"
                >
                    A Evolução da Prescrição <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-500">
                        de Treinos.
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 text-lg md:text-xl text-slate-400 text-center max-w-2xl leading-relaxed"
                >
                    O primeiro sistema feito por treinadores para treinadores.
                    Entregue uma experiência viciante para seus alunos e ganhe tempo na gestão.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-10 flex flex-col sm:flex-row items-center gap-4"
                >
                    <Link href="/signup" className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-violet-500/25 flex items-center justify-center gap-2">
                        Começar Agora
                        <ChevronRight size={20} />
                    </Link>
                    <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-900 border border-slate-800 text-slate-200 font-bold text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        Ver Demonstração
                        <Play size={18} fill="currentColor" />
                    </button>
                </motion.div>

                {/* Hybrid Device Mockup Composition */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="mt-20 relative w-full max-w-5xl px-4"
                >
                    {/* Neon glow behind devices */}
                    <div className="absolute -inset-8 bg-violet-500/10 blur-[80px] rounded-[40px] pointer-events-none" />
                    <div className="absolute -inset-4 bg-blue-500/5 blur-[60px] rounded-[40px] pointer-events-none" />

                    {/* MacBook — Main, centered */}
                    <div className="relative z-0">
                        <MacbookMockup
                            src="/treino.png"
                            alt="Dashboard Kinevo — Visão geral do treinador"
                        />
                    </div>

                    {/* iPhone — Overlapping bottom-right */}
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
                            {/* Shadow/glow behind iPhone */}
                            <div className="absolute -inset-4 bg-violet-500/20 blur-[30px] rounded-[40px] pointer-events-none" />
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

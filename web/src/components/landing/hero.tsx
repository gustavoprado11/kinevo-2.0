'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ProDisplayMockup } from './mockups/ProDisplayMockup';
import { IphoneMockup } from './mockups/IphoneMockup';

export const Hero = () => {
    return (
        <section className="relative pt-28 sm:pt-36 pb-8 overflow-hidden mesh-gradient-hero">
            {/* Subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                    backgroundSize: '64px 64px',
                }}
            />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Content */}
                <div className="flex flex-col items-center text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50/80 border border-violet-100 text-violet-700 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                            </span>
                            <span className="text-xs font-bold tracking-wide uppercase">
                                Plataforma para Treinadores de Elite
                            </span>
                        </div>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="font-display mt-8 text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[5.25rem] font-extrabold text-slate-900 leading-[1.02] tracking-[-0.04em] max-w-5xl"
                    >
                        Prescreva, acompanhe e{' '}
                        <span className="relative">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-violet-500 to-purple-500">
                                evolua
                            </span>
                            {/* Underline decoration */}
                            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
                                <motion.path
                                    d="M2 6C50 2 150 2 198 6"
                                    stroke="url(#underline-gradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: 0.8, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                />
                                <defs>
                                    <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                                        <stop stopColor="#7C3AED" />
                                        <stop offset="1" stopColor="#a78bfa" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </span>
                        {' '}seus alunos.
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-7 text-lg sm:text-xl text-slate-500 max-w-2xl leading-relaxed font-medium"
                    >
                        O sistema completo para consultoria fitness. Dashboard web para o treinador,
                        app premium para o aluno. Tudo conectado em tempo real.
                    </motion.p>

                    {/* CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-10"
                    >
                        <Link
                            href="/signup"
                            className="shimmer-btn group inline-flex px-10 py-4 rounded-full bg-slate-900 text-white font-bold text-base hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-900/15 items-center gap-2.5"
                        >
                            Comece Gratuitamente
                            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </motion.div>

                    {/* Social Proof Micro */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="mt-8 flex items-center gap-3 text-sm text-slate-400"
                    >
                        <div className="flex -space-x-2">
                            {[
                                'bg-violet-400',
                                'bg-emerald-400',
                                'bg-amber-400',
                                'bg-rose-400',
                            ].map((bg, i) => (
                                <div
                                    key={i}
                                    className={`w-7 h-7 rounded-full ${bg} border-2 border-white flex items-center justify-center text-white text-[10px] font-bold`}
                                >
                                    {['G', 'M', 'R', 'L'][i]}
                                </div>
                            ))}
                        </div>
                        <span className="font-medium">
                            Usado por <span className="text-slate-600 font-semibold">treinadores exigentes</span> no Brasil
                        </span>
                    </motion.div>
                </div>

                {/* Device Composition */}
                <motion.div
                    initial={{ opacity: 0, y: 60 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-16 sm:mt-20 relative w-full max-w-6xl mx-auto"
                >
                    {/* Glow behind mockup */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-gradient-to-r from-violet-300/20 via-purple-300/10 to-violet-300/20 blur-3xl rounded-full pointer-events-none" />

                    {/* Pro Display — centered */}
                    <div className="relative z-0">
                        <ProDisplayMockup
                            src="/dashboard-main.png"
                            alt="Dashboard Kinevo - Visão geral do treinador"
                        />
                    </div>

                    {/* iPhone — floating bottom-right */}
                    <motion.div
                        animate={{ y: [0, -14, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -bottom-6 right-0 md:right-6 lg:right-12 w-[110px] sm:w-[140px] md:w-[180px] lg:w-[210px] z-10"
                    >
                        <div className="relative">
                            {/* Shadow under phone */}
                            <div className="absolute -inset-4 bg-violet-500/10 blur-2xl rounded-3xl" />
                            <IphoneMockup
                                src="/mobile-home.png"
                                alt="App do Aluno - Tela inicial"
                            />
                        </div>
                    </motion.div>

                    {/* Floating notification card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1, duration: 0.6 }}
                        className="hidden lg:block absolute top-16 -left-4 z-20"
                    >
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                            className="bg-white rounded-2xl p-4 shadow-xl shadow-black/[0.06] border border-black/[0.04] flex items-center gap-3"
                        >
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Agora</div>
                                <div className="text-slate-800 font-bold text-sm">Treino A concluído</div>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

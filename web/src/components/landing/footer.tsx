'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export const Footer = () => {
    return (
        <footer className="bg-white">
            {/* CTA Section */}
            <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative bg-slate-900 rounded-[2rem] p-12 md:p-20 text-center overflow-hidden"
                >
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-purple-600/10 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/3" />

                    {/* Grid pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                            backgroundSize: '48px 48px',
                        }}
                    />

                    <div className="relative z-10">
                        <h2 className="font-display text-3xl sm:text-4xl md:text-6xl font-extrabold text-white tracking-[-0.03em] leading-[1.05] mb-6">
                            Pronto para transformar{' '}
                            <br className="hidden sm:block" />
                            sua consultoria?
                        </h2>
                        <p className="text-white/50 text-lg md:text-xl font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
                            Junte-se aos treinadores que ja elevaram o nivel da prescricao
                            e do acompanhamento de treinos.
                        </p>
                        <Link
                            href="/signup"
                            className="shimmer-btn group inline-flex items-center gap-2.5 px-10 py-5 bg-white text-slate-900 rounded-full font-extrabold text-lg hover:bg-slate-50 active:scale-[0.98] transition-all shadow-2xl shadow-black/20"
                        >
                            Criar Conta Gratis
                            <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        <p className="mt-5 text-white/30 text-sm font-medium">
                            Sem cartao de credito. Configure em 2 minutos.
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Footer Links */}
            <div className="max-w-7xl mx-auto px-6 pb-16">
                <div className="border-t border-black/[0.04] pt-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                        {/* Brand */}
                        <div className="md:col-span-2">
                            <Link href="/" className="flex items-center gap-2.5 mb-5">
                                <Image
                                    src="/logo-icon.png"
                                    alt="Kinevo Logo"
                                    width={36}
                                    height={36}
                                    className="rounded-xl"
                                />
                                <span className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                                    Kinevo
                                </span>
                            </Link>
                            <p className="text-slate-400 max-w-sm text-[15px] leading-relaxed font-medium">
                                A tecnologia definitiva para o treinador de alta performance.
                                Evolucao constante, resultados extraordinarios.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-5">Links Rapidos</h4>
                            <ul className="space-y-3">
                                {[
                                    { href: '/login', label: 'Login Treinador' },
                                    { href: '#como-funciona', label: 'Como Funciona' },
                                    { href: '#treinador', label: 'Para Treinadores' },
                                    { href: '#aluno', label: 'Para Alunos' },
                                ].map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-slate-500 text-sm font-medium hover:text-violet-600 transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-5">Legal</h4>
                            <ul className="space-y-3">
                                {[
                                    { href: '/privacy', label: 'Privacidade' },
                                    { href: '/terms', label: 'Termos de Uso' },
                                ].map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-slate-500 text-sm font-medium hover:text-violet-600 transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-12 pt-8 border-t border-black/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
                        &copy; 2026 Kinevo System Inc.
                    </span>
                    <div className="flex gap-6">
                        <Link href="#" className="text-xs text-slate-400 font-semibold uppercase tracking-widest hover:text-violet-600 transition-colors">
                            Instagram
                        </Link>
                        <Link href="#" className="text-xs text-slate-400 font-semibold uppercase tracking-widest hover:text-violet-600 transition-colors">
                            Twitter
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

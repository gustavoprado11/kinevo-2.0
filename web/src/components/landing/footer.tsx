'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export const Footer = () => {
    return (
        <footer className="bg-slate-950 border-t border-slate-900 pt-24 pb-12">
            <div className="container mx-auto px-6">
                {/* CTA Final */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative bg-gradient-to-br from-violet-600 to-blue-700 rounded-[40px] p-12 md:p-20 text-center overflow-hidden mb-24"
                >
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">
                        Pronto para elevar <br /> o nível?
                    </h2>
                    <p className="text-white/80 text-lg md:text-xl font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
                        Junte-se a centenas de treinadores que já transformaram a forma como prescrevem e acompanham resultados.
                    </p>
                    <Link
                        href="/login"
                        className="inline-flex px-10 py-5 bg-white text-violet-600 rounded-full font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20"
                    >
                        Começar Agora
                    </Link>
                </motion.div>

                {/* Footer Content */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-16 border-b border-slate-900">
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/" className="flex items-center gap-2 mb-6 text-white font-bold text-2xl tracking-tighter">
                            <Image
                                src="/logo-icon.png"
                                alt="Kinevo Logo"
                                width={40}
                                height={40}
                                className="rounded-xl border border-white/10"
                            />
                            Kinevo
                        </Link>
                        <p className="text-slate-500 max-w-xs font-medium leading-relaxed">
                            A tecnologia definitiva para o treinador de alta performance.
                            Evolução constante, resultados extraordinários.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6">Links Rápidos</h4>
                        <ul className="space-y-4 text-slate-500 font-medium">
                            <li><Link href="/login" className="hover:text-violet-400">Login Treinador</Link></li>
                            <li><Link href="/login" className="hover:text-violet-400">Suporte</Link></li>
                            <li><Link href="/login" className="hover:text-violet-400">Painel Aluno</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-6">Legal</h4>
                        <ul className="space-y-4 text-slate-500 font-medium">
                            <li><Link href="#" className="hover:text-violet-400">Privacidade</Link></li>
                            <li><Link href="#" className="hover:text-violet-400">Termos de Uso</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-600 text-sm font-bold uppercase tracking-widest">
                    <span>© 2026 Kinevo System Inc.</span>
                    <div className="flex gap-8">
                        <Link href="#" className="hover:text-slate-400 transition-colors">Instagram</Link>
                        <Link href="#" className="hover:text-slate-400 transition-colors">Twitter</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

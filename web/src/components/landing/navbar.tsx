'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export const Navbar = () => {
    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-xl bg-white/70 border-b border-black/[0.06]"
        >
            <Link href="/" className="flex items-center gap-2">
                <Image
                    src="/logo-icon.png"
                    alt="Kinevo Logo"
                    width={32}
                    height={32}
                    className="rounded-lg"
                />
                <span className="text-xl font-bold text-slate-900 tracking-tight">Kinevo</span>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
                <Link href="#features" className="hover:text-violet-600 transition-colors">Funcionalidades</Link>
                <Link href="#philosophy" className="hover:text-violet-600 transition-colors">Filosofia</Link>
                <Link href="/login" className="text-slate-700 hover:text-slate-900 transition-colors">Entrar</Link>
                <Link
                    href="/signup"
                    className="shimmer-btn px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-violet-500/15"
                >
                    Começar Agora
                </Link>
            </div>

            {/* Mobile CTA */}
            <div className="md:hidden">
                <Link
                    href="/signup"
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 text-sm font-bold text-white shadow-lg shadow-violet-500/15"
                >
                    Começar
                </Link>
            </div>
        </motion.nav>
    );
};

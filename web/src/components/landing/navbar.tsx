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
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md bg-slate-950/50 border-b border-slate-800/50"
        >
            <Link href="/" className="flex items-center gap-2">
                <Image
                    src="/logo-icon.png"
                    alt="Kinevo Logo"
                    width={32}
                    height={32}
                    className="rounded-lg shadow-lg shadow-violet-500/20"
                />
                <span className="text-xl font-bold text-slate-50 tracking-tight">Kinevo</span>
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                <Link href="#features" className="hover:text-violet-400 transition-colors">Funcionalidades</Link>
                <Link href="#philosophy" className="hover:text-violet-400 transition-colors">Filosofia</Link>
                <Link href="/login" className="hover:text-white transition-colors">Entrar</Link>
                <Link
                    href="/signup"
                    className="px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:scale-105 active:scale-95 transition-all shadow-lg shadow-violet-500/25"
                >
                    Começar Agora
                </Link>
            </div>

            {/* Mobile Menu Icon (Simplified for Landing) */}
            <div className="md:hidden">
                <Link
                    href="/signup"
                    className="px-4 py-2 rounded-full bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-500/20"
                >
                    Começar
                </Link>
            </div>
        </motion.nav>
    );
};

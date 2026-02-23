'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navLinks = [
    { href: '#como-funciona', label: 'Como Funciona' },
    { href: '#treinador', label: 'Para Treinadores' },
    { href: '#aluno', label: 'Para Alunos' },
    { href: '#funcionalidades', label: 'Funcionalidades' },
];

export const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            <motion.nav
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled
                        ? 'py-3 backdrop-blur-2xl bg-white/80 border-b border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                        : 'py-5 bg-transparent'
                }`}
            >
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <Image
                            src="/logo-icon.png"
                            alt="Kinevo Logo"
                            width={32}
                            height={32}
                            className="rounded-lg group-hover:scale-105 transition-transform"
                        />
                        <span className="font-display text-xl font-extrabold text-slate-900 tracking-tight">
                            Kinevo
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-4 py-2 text-[13px] font-semibold text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-all"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTAs */}
                    <div className="hidden lg:flex items-center gap-3">
                        <Link
                            href="/login"
                            className="px-5 py-2.5 text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            Entrar
                        </Link>
                        <Link
                            href="/signup"
                            className="shimmer-btn px-6 py-2.5 rounded-full bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/10"
                        >
                            Criar Conta Grátis
                        </Link>
                    </div>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="lg:hidden p-2 -mr-2 text-slate-700 hover:text-slate-900 transition-colors"
                        aria-label="Menu"
                    >
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </motion.nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-white pt-20"
                    >
                        <div className="px-6 py-8 flex flex-col gap-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="px-4 py-3.5 text-lg font-semibold text-slate-700 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                                >
                                    {link.label}
                                </Link>
                            ))}

                            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
                                <Link
                                    href="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="px-4 py-3.5 text-center text-lg font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                                >
                                    Entrar
                                </Link>
                                <Link
                                    href="/signup"
                                    onClick={() => setMobileOpen(false)}
                                    className="px-4 py-3.5 text-center text-lg font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all"
                                >
                                    Criar Conta Grátis
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

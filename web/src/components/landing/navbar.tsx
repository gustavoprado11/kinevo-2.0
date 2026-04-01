'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight } from 'lucide-react'

const navLinks = [
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'App do Aluno', href: '#app-aluno' },
    { label: 'Assistente IA', href: '#assistente-ia' },
    { label: 'Preços', href: '#precos' },
    { label: 'FAQ', href: '#faq' },
]

export function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [mobileOpen])

    return (
        <>
            <motion.nav
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className={`fixed top-0 left-0 right-0 z-modal h-16 transition-all duration-300 ${
                    scrolled
                        ? 'bg-white/70 backdrop-blur-2xl border-b border-black/[0.04] shadow-sm'
                        : 'bg-transparent'
                }`}
            >
                <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5">
                        <Image
                            src="/logo-icon.png"
                            alt="Kinevo"
                            width={28}
                            height={28}
                            className="rounded-lg"
                        />
                        <span className="font-jakarta text-lg font-bold text-[#1D1D1F] tracking-tight">
                            Kinevo
                        </span>
                    </Link>

                    {/* Center links — desktop */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                className="font-jakarta text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors px-3.5 py-2 rounded-lg hover:bg-black/[0.03]"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    {/* Right CTAs */}
                    <div className="flex items-center gap-3">
                        <Link
                            href="/login"
                            className="hidden md:inline-block font-jakarta text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors px-3 py-2"
                        >
                            Entrar
                        </Link>
                        <motion.div
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                            <Link
                                href="/signup"
                                className="hidden md:inline-flex items-center gap-1.5 font-jakarta bg-[#1D1D1F] hover:bg-black text-white text-sm font-semibold rounded-full px-5 py-2.5 transition-all shadow-sm"
                            >
                                Começar grátis
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </motion.div>

                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="md:hidden p-2 text-[#1D1D1F] rounded-lg hover:bg-black/[0.03] transition-colors"
                            aria-label="Menu"
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile menu overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-dropdown md:hidden"
                            onClick={() => setMobileOpen(false)}
                            aria-hidden
                        />

                        {/* Menu panel */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-x-4 top-20 z-modal bg-white rounded-2xl shadow-xl shadow-black/10 border border-black/[0.05] md:hidden overflow-hidden"
                        >
                            <div className="p-5 flex flex-col gap-1">
                                {navLinks.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className="font-jakarta text-base font-medium text-[#1D1D1F] py-3 px-3 rounded-xl hover:bg-[#F5F5F7] transition-colors"
                                    >
                                        {link.label}
                                    </a>
                                ))}
                                <div className="h-px bg-[#E8E8ED] my-2" />
                                <Link
                                    href="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="font-jakarta text-base text-[#6E6E73] py-3 px-3 rounded-xl hover:bg-[#F5F5F7] transition-colors"
                                >
                                    Entrar
                                </Link>
                                <Link
                                    href="/signup"
                                    onClick={() => setMobileOpen(false)}
                                    className="font-jakarta bg-[#1D1D1F] text-white text-base font-semibold rounded-full px-6 py-3 text-center mt-2"
                                >
                                    Começar grátis
                                </Link>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

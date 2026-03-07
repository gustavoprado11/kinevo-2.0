'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

export function Navbar() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
                scrolled
                    ? 'bg-white/80 backdrop-blur-xl border-b border-black/5'
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

                {/* Center links — desktop only */}
                <div className="hidden md:flex items-center gap-8">
                    <a href="#treinadores" className="font-jakarta text-sm text-[#1D1D1F]/60 hover:text-[#1D1D1F] transition-colors">
                        Treinadores
                    </a>
                    <a href="#alunos" className="font-jakarta text-sm text-[#1D1D1F]/60 hover:text-[#1D1D1F] transition-colors">
                        Alunos
                    </a>
                    <a href="#precos" className="font-jakarta text-sm text-[#1D1D1F]/60 hover:text-[#1D1D1F] transition-colors">
                        Preços
                    </a>
                </div>

                {/* Right CTAs */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/login"
                        className="hidden md:inline-block font-jakarta text-sm text-[#1D1D1F]/60 hover:text-[#1D1D1F] transition-colors"
                    >
                        Entrar
                    </Link>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                        <Link
                            href="/signup"
                            className="font-jakarta bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] text-white text-sm font-semibold rounded-full px-5 py-2 transition-all hover:shadow-[0_0_40px_rgba(124,58,237,0.3)]"
                        >
                            Começar grátis
                        </Link>
                    </motion.div>
                </div>
            </div>
        </motion.nav>
    )
}

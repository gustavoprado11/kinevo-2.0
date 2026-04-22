'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const footerLinks = {
    produto: [
        { label: 'Como funciona', href: '#como-funciona' },
        { label: 'Assistente IA', href: '#assistente-ia' },
        { label: 'App do Aluno', href: '#para-aluno' },
        { label: 'Preços', href: '#precos' },
    ],
    recursos: [
        { label: 'Central de Ajuda', href: '#' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Status', href: '#' },
    ],
    empresa: [
        { label: 'Sobre', href: '#' },
        { label: 'Instagram', href: 'https://www.instagram.com/kinevo.app', external: true },
    ],
    legal: [
        { label: 'Termos de Uso', href: '/terms' },
        { label: 'Privacidade', href: '/privacy' },
    ],
}

export function LandingCtaFooter() {
    return (
        <section>
            {/* CTA Section */}
            <div className="relative bg-[#0A0A0B] py-24 md:py-32 overflow-hidden">
                {/* Background gradients */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(124,58,237,0.12),transparent)]" />

                <div className="relative mx-auto max-w-4xl px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                    >
                        <h2 className="font-jakarta text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                            Seus alunos merecem mais que uma planilha.
                        </h2>
                        <p className="font-jakarta text-xl md:text-2xl font-medium text-white/40 mt-4">
                            Você merece uma ferramenta à altura do seu trabalho.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
                        className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <motion.div
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                            <Link
                                href="/signup"
                                className="shimmer-btn group inline-flex items-center gap-2.5 bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold text-base rounded-full px-8 py-4 transition-all shadow-lg font-jakarta"
                            >
                                Criar minha conta grátis
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </motion.div>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="font-jakarta text-white/25 text-sm mt-5"
                    >
                        7 dias grátis &bull; Setup em 2 minutos &bull; Sem fidelidade &bull; Cancele quando quiser
                    </motion.p>

                    {/* Trust badges */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="mt-10 flex items-center justify-center gap-5 flex-wrap"
                    >
                        {['Pagamentos via Stripe', 'iOS & Android', 'Apple Watch'].map((badge) => (
                            <span
                                key={badge}
                                className="font-jakarta text-xs text-white/20 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-1.5"
                            >
                                {badge}
                            </span>
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-[#0A0A0B] border-t border-white/[0.06]">
                <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                        {/* Brand column */}
                        <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2.5">
                                <Image
                                    src="/logo-icon.png"
                                    alt="Kinevo"
                                    width={24}
                                    height={24}
                                    className="rounded-md"
                                />
                                <span className="font-jakarta text-base font-bold text-white">
                                    Kinevo
                                </span>
                            </div>
                            <p className="font-jakarta text-xs text-white/30 mt-3 max-w-[200px]">
                                Sua evolução, guiada. O sistema completo para personal trainers.
                            </p>
                        </div>

                        {/* Link columns */}
                        {Object.entries(footerLinks).map(([category, links]) => (
                            <div key={category}>
                                <p className="font-jakarta text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
                                    {category}
                                </p>
                                <ul className="space-y-2.5">
                                    {links.map((link) => (
                                        <li key={link.label}>
                                            {'external' in link && link.external ? (
                                                <a
                                                    href={link.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-jakarta text-sm text-white/30 hover:text-white/60 transition-colors"
                                                >
                                                    {link.label}
                                                </a>
                                            ) : link.href.startsWith('#') ? (
                                                <a
                                                    href={link.href}
                                                    className="font-jakarta text-sm text-white/30 hover:text-white/60 transition-colors"
                                                >
                                                    {link.label}
                                                </a>
                                            ) : (
                                                <Link
                                                    href={link.href}
                                                    className="font-jakarta text-sm text-white/30 hover:text-white/60 transition-colors"
                                                >
                                                    {link.label}
                                                </Link>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Bottom bar */}
                    <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="font-jakarta text-xs text-white/20">
                            &copy; {new Date().getFullYear()} Kinevo. Todos os direitos reservados.
                        </p>
                        <div className="flex items-center gap-4">
                            <a
                                href="https://www.instagram.com/kinevo.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/20 hover:text-white/40 transition-colors"
                                aria-label="Instagram"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </section>
    )
}

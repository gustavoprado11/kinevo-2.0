'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export function LandingCtaFooter() {
    return (
        <section className="mesh-gradient-dark">
            {/* CTA */}
            <div className="py-24 md:py-32">
                <div className="mx-auto max-w-7xl px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        <h2 className="font-jakarta text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                            Seus alunos merecem mais que uma planilha.
                        </h2>
                        <p className="font-jakarta text-2xl md:text-3xl font-bold tracking-tight text-white/60 mt-2">
                            Você merece uma ferramenta à altura do seu trabalho.
                        </p>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                        className="font-jakarta text-white/50 text-lg mt-6"
                    >
                        Comece agora, grátis. Configure em 2 minutos. Veja a diferença na primeira semana.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-100px' }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        className="mt-8"
                    >
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                            className="inline-block"
                        >
                            <Link
                                href="/signup"
                                className="shimmer-btn inline-block bg-gradient-to-r from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] hover:shadow-[0_0_40px_rgba(124,58,237,0.3)] text-white font-semibold rounded-full px-10 py-4 transition-all font-jakarta text-lg"
                            >
                                Criar minha conta grátis
                            </Link>
                        </motion.div>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="font-jakarta text-white/30 text-sm mt-4"
                    >
                        7 dias grátis &bull; Sem fidelidade &bull; Cancele quando quiser
                    </motion.p>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-sm font-jakarta">
                        <p>&copy; {new Date().getFullYear()} Kinevo. Todos os direitos reservados.</p>
                        <div className="flex items-center gap-4">
                            <Link href="/terms" className="hover:text-white/60 transition-colors">Termos de Uso</Link>
                            <span>&middot;</span>
                            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacidade</Link>
                        </div>
                        <div className="flex items-center gap-3">
                            <a href="https://www.instagram.com/kinevo.app" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors" aria-label="Instagram">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
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

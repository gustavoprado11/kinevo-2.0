'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Z } from '@/lib/z-index'

interface ModalShellProps {
    open: boolean
    onClose: () => void
    title: string
    description?: string | null
    children: ReactNode
    footer?: ReactNode
    /** Tamanho máximo do modal (default 'md' = 32rem). */
    size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASS: Record<NonNullable<ModalShellProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
}

// M8/D3 — shell visual compartilhado pelos modais de Forms e Avaliações.
// Cuida de overlay, animação, header (title + close), footer slot, Esc/click-outside.
// Conteúdo específico (campos do form) fica no children.
export function ModalShell({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
}: ModalShellProps) {
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        style={{ zIndex: Z.MODAL }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="fixed inset-0 flex items-center justify-center p-4"
                        style={{ zIndex: Z.MODAL + 1 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.96 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.96 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                            className={`w-full ${SIZE_CLASS[size]} overflow-hidden rounded-2xl border border-k-border-subtle bg-surface-card shadow-xl`}
                            onClick={e => e.stopPropagation()}
                        >
                            <header className="flex items-center justify-between border-b border-k-border-subtle px-5 py-4">
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-semibold text-k-text-primary">{title}</h2>
                                    {description && (
                                        <p className="truncate text-xs text-k-text-tertiary">{description}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Fechar"
                                    className="rounded-md p-1 text-k-text-tertiary hover:bg-surface-inset hover:text-k-text-primary"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </header>

                            <div className="max-h-[70vh] overflow-y-auto">
                                {children}
                            </div>

                            {footer && (
                                <div className="border-t border-k-border-subtle px-5 py-4">
                                    {footer}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

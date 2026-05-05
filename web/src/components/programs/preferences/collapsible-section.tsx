'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

interface CollapsibleSectionProps {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
}

/**
 * Section colapsável usada no drawer de preferências. Animação de
 * height: 0 → 'auto' via framer-motion. Estado open/closed local (useState).
 */
export function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const contentId = useId()

    return (
        <section className="border-b border-k-border-subtle">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-glass-bg/30 transition-colors duration-150"
                aria-expanded={isOpen}
                aria-controls={contentId}
            >
                <span className="text-sm font-medium text-k-text-primary">{title}</span>
                <ChevronDown
                    className={`w-4 h-4 text-k-text-tertiary transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={contentId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-3">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    )
}

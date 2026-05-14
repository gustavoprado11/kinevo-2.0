'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { WelcomeMobileStep } from './welcome-mobile-step'

interface AppLinksDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Fase 17b · fix BUG 3+4 — modal centrado com QR codes do app mobile.
 * Aberto a partir dos itens "Compartilhar link do App" e "Entre no App Mobile"
 * do checklist. Reaproveita o WelcomeMobileStep (mesmo conteúdo do welcome
 * tour step 6).
 */
export function AppLinksDialog({ isOpen, onClose }: AppLinksDialogProps) {
  // Esc fecha
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-onboarding flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative bg-surface-card border border-k-border-primary rounded-2xl p-6 max-w-md w-full shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="App Mobile"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <h2 className="text-lg font-bold text-foreground pr-8">App Mobile</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Baixe o app pelos QR codes abaixo ou copie o link pra compartilhar com seus alunos.
              O login é o mesmo do web.
            </p>

            <WelcomeMobileStep />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

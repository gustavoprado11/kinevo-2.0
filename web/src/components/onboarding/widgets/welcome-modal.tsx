'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Users, Calendar, Activity, X } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'

interface WelcomeModalProps {
  trainerName: string
}

const PREVIEW_CARDS = [
  {
    icon: Users,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    title: 'Cadastre Alunos',
    desc: 'Gerencie perfis, acesso e modalidade',
  },
  {
    icon: Calendar,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    title: 'Prescreva Programas',
    desc: 'Manual, templates ou com IA',
  },
  {
    icon: Activity,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    title: 'Acompanhe Resultados',
    desc: 'Sessões, calendário e aderência',
  },
]

export function WelcomeModal({ trainerName }: WelcomeModalProps) {
  const welcomeCompleted = useOnboardingStore(
    (s) => s.state.welcome_tour_completed,
  )
  const isHydrated = useOnboardingStore((s) => s.isHydrated)
  const completeWelcomeTour = useOnboardingStore((s) => s.completeWelcomeTour)
  const startTour = useOnboardingStore((s) => s.startTour)

  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isHydrated && !welcomeCompleted) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => setIsOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [isHydrated, welcomeCompleted])

  const handleStartTour = () => {
    setIsOpen(false)
    completeWelcomeTour()
    // Start the welcome tour (Phase 2 will implement the TourRunner)
    startTour('welcome')
  }

  const handleExploreAlone = () => {
    setIsOpen(false)
    completeWelcomeTour()
  }

  // Extract first name for a friendlier greeting
  const firstName = trainerName.split(' ')[0]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative bg-surface-card border border-k-border-primary rounded-2xl p-8 max-w-lg w-full shadow-2xl overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/8 blur-3xl rounded-full pointer-events-none" />

            {/* Close button */}
            <button
              onClick={handleExploreAlone}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors"
            >
              <X size={18} />
            </button>

            {/* Icon */}
            <div className="w-20 h-20 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-violet-500/20">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Dumbbell className="w-10 h-10 text-violet-400" />
              </motion.div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black text-foreground text-center tracking-tight">
              Bem-vindo ao Kinevo, {firstName}!
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed max-w-md mx-auto">
              Vamos dar uma volta rápida pela plataforma para você começar a
              prescrever treinos em poucos minutos.
            </p>

            {/* Feature Preview Cards */}
            <div className="grid grid-cols-3 gap-3 mt-8">
              {PREVIEW_CARDS.map((card) => {
                const Icon = card.icon
                return (
                  <div
                    key={card.title}
                    className="rounded-xl bg-glass-bg border border-k-border-subtle p-4 text-center"
                  >
                    <div
                      className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center mx-auto mb-2`}
                    >
                      <Icon size={20} className={card.iconColor} />
                    </div>
                    <h3 className="text-xs font-bold text-foreground">
                      {card.title}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      {card.desc}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={handleStartTour}
                className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20 text-sm active:scale-[0.98]"
              >
                Começar Tour
              </button>
              <button
                onClick={handleExploreAlone}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-4 transition-colors mt-3"
              >
                Explorar por conta própria
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

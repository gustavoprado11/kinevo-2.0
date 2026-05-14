'use client'

import { useEffect, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Calendar,
  ClipboardList,
  Wallet,
  Smartphone,
  Dumbbell,
  Sparkles,
  ChevronLeft,
  X,
} from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { updateTrainerModality } from '@/actions/trainer/update-trainer-modality'
import type { TrainerModalityFocus } from '@kinevo/shared/types/onboarding'

interface WelcomeModalProps {
  trainerName: string
}

type Step = 'capabilities' | 'modality'

const CAPABILITY_CARDS = [
  {
    icon: Users,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    title: 'Alunos',
    desc: 'Cadastre, gerencie e acompanhe',
  },
  {
    icon: Calendar,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    title: 'Programas',
    desc: 'Manual, templates ou com IA',
  },
  {
    icon: Sparkles,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    title: 'Avaliações',
    desc: 'Antropometria e composição',
  },
  {
    icon: Wallet,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    title: 'Financeiro',
    desc: 'Stripe ou controle manual',
  },
  {
    icon: ClipboardList,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    title: 'Formulários',
    desc: 'Anamnese, check-ins, feedback',
  },
  {
    icon: Smartphone,
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-400',
    title: 'App Mobile',
    desc: 'Sala de Treino e acompanhamento',
  },
]

const MODALITY_OPTIONS: Array<{
  value: Exclude<TrainerModalityFocus, null>
  title: string
  desc: string
}> = [
  {
    value: 'presencial',
    title: 'Presencial',
    desc: 'Atendo alunos pessoalmente — Sala de Treino e captura de avaliação',
  },
  {
    value: 'online',
    title: 'Online',
    desc: 'Consultoria à distância — formulários, Stripe e mensagens',
  },
  {
    value: 'ambos',
    title: 'Os dois',
    desc: 'Atendo alunos presenciais e online',
  },
]

export function WelcomeModal({ trainerName }: WelcomeModalProps) {
  const welcomeCompleted = useOnboardingStore(
    (s) => s.state.welcome_tour_completed,
  )
  const isHydrated = useOnboardingStore((s) => s.isHydrated)
  const completeWelcomeTour = useOnboardingStore((s) => s.completeWelcomeTour)
  const snoozeChecklist = useOnboardingStore((s) => s.snoozeChecklist)
  const startTour = useOnboardingStore((s) => s.startTour)
  const setModalityFocus = useOnboardingStore((s) => s.setModalityFocus)

  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<Step>('capabilities')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (isHydrated && !welcomeCompleted) {
      const timer = setTimeout(() => setIsOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [isHydrated, welcomeCompleted])

  const firstName = trainerName.split(' ')[0]

  // Step 1 — capabilities CTAs
  const handleContinue = () => setStep('modality')

  // "Lembrar depois" — snooze 7 dias, NÃO marca welcome como completo.
  const handleRemindLater = () => {
    snoozeChecklist(7)
    setIsOpen(false)
  }

  // "Pular para sempre" — marca completo, fecha.
  const handleSkipForever = () => {
    completeWelcomeTour()
    setIsOpen(false)
  }

  // Step 2 — chosen modality
  const handleSelectModality = (focus: TrainerModalityFocus) => {
    setModalityFocus(focus)
    startTransition(async () => {
      void updateTrainerModality(focus).catch(() => {})
    })
    completeWelcomeTour()
    setIsOpen(false)
    // delay pequeno pra o modal sair antes do tour mostrar spotlight
    setTimeout(() => startTour('welcome'), 200)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-onboarding flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative bg-surface-card border border-k-border-primary rounded-2xl p-8 max-w-xl w-full shadow-2xl overflow-hidden"
          >
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/8 blur-3xl rounded-full pointer-events-none" />

            <button
              onClick={handleSkipForever}
              className="absolute top-4 right-4 p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            {step === 'capabilities' && (
              <>
                <div className="w-20 h-20 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-violet-500/20">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Dumbbell className="w-10 h-10 text-violet-400" />
                  </motion.div>
                </div>

                <h2 className="text-2xl font-black text-foreground text-center tracking-tight">
                  Bem-vindo ao Kinevo, {firstName}!
                </h2>
                <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed max-w-md mx-auto">
                  Sua plataforma completa de consultoria. Tudo o que você precisa em um só lugar:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                  {CAPABILITY_CARDS.map((card) => {
                    const Icon = card.icon
                    return (
                      <div
                        key={card.title}
                        className="rounded-xl bg-glass-bg border border-k-border-subtle p-3 text-center"
                      >
                        <div
                          className={`w-9 h-9 ${card.iconBg} rounded-lg flex items-center justify-center mx-auto mb-2`}
                        >
                          <Icon size={18} className={card.iconColor} />
                        </div>
                        <h3 className="text-xs font-bold text-foreground">{card.title}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {card.desc}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-7 flex flex-col items-center">
                  <button
                    onClick={handleContinue}
                    className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20 text-sm active:scale-[0.98]"
                  >
                    Continuar
                  </button>
                  <div className="flex items-center gap-4 mt-3">
                    <button
                      onClick={handleRemindLater}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-4 transition-colors"
                    >
                      Lembrar depois
                    </button>
                    <span className="text-muted-foreground/20">·</span>
                    <button
                      onClick={handleSkipForever}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-4 transition-colors"
                    >
                      Pular para sempre
                    </button>
                  </div>
                </div>
              </>
            )}

            {step === 'modality' && (
              <>
                <button
                  onClick={() => setStep('capabilities')}
                  className="absolute top-4 left-4 p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors flex items-center gap-1 text-xs"
                  disabled={isPending}
                  aria-label="Voltar"
                >
                  <ChevronLeft size={14} /> Voltar
                </button>

                <h2 className="text-2xl font-black text-foreground text-center tracking-tight mt-4">
                  Como você atende?
                </h2>
                <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed max-w-md mx-auto">
                  Vamos adaptar o tour e o checklist pro seu modelo de trabalho.
                </p>

                <div className="flex flex-col gap-2 mt-6">
                  {MODALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSelectModality(opt.value)}
                      disabled={isPending}
                      className="text-left w-full p-4 rounded-xl bg-glass-bg border border-k-border-subtle hover:border-violet-500/40 hover:bg-violet-500/5 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <h3 className="text-sm font-bold text-foreground">{opt.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => handleSelectModality(null)}
                    disabled={isPending}
                    className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-4 transition-colors disabled:opacity-50"
                  >
                    Não responder agora
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

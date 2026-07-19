'use client'

import { HelpCircle } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'

interface TourHelpButtonProps {
  tourId: string
  className?: string
}

/**
 * Entrada discreta para rodar o tour da tela sob demanda (modelo híbrido:
 * nenhum tour por tela auto-inicia; o usuário pede quando quiser).
 * Funciona mesmo se o tour já foi completado — reexibe do início.
 * Oculto em viewports < md (o TourRunner pula tours em telas pequenas).
 */
export function TourHelpButton({ tourId, className }: TourHelpButtonProps) {
  const startTour = useOnboardingStore((s) => s.startTour)
  const activeTourId = useOnboardingStore((s) => s.activeTourId)

  return (
    <button
      onClick={() => startTour(tourId, 'manual')}
      disabled={activeTourId !== null}
      aria-label="Conhecer esta tela"
      title="Conhecer esta tela"
      className={`hidden md:inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-glass-bg transition-colors disabled:opacity-40 ${className ?? ''}`}
    >
      <HelpCircle size={16} />
    </button>
  )
}

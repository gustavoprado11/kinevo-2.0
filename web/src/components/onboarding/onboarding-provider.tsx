'use client'

import { useEffect } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import type {
  OnboardingState,
  TrainerModalityFocus,
} from '@kinevo/shared/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'

interface OnboardingProviderProps {
  initialState: OnboardingState | null
  trainerModalityFocus?: TrainerModalityFocus
  children: React.ReactNode
}

export function OnboardingProvider({
  initialState,
  trainerModalityFocus = null,
  children,
}: OnboardingProviderProps) {
  const hydrate = useOnboardingStore((s) => s.hydrate)
  const setModalityFocus = useOnboardingStore((s) => s.setModalityFocus)

  useEffect(() => {
    // With skipHydration: true, localStorage is NOT auto-restored.
    // Server state is the single source of truth for boolean flags.
    //
    // Trainers existentes podem ter onboarding_state em DB sem os campos novos
    // adicionados em Fase 17a (checklist_snoozed_until, milestones.mobile_logged_in,
    // milestones.first_training_room_session). Mesclar contra DEFAULT_ONBOARDING_STATE
    // pra garantir shape completo antes do hydrate.
    const normalized: OnboardingState = initialState
      ? {
          ...DEFAULT_ONBOARDING_STATE,
          ...initialState,
          milestones: {
            ...DEFAULT_ONBOARDING_STATE.milestones,
            ...(initialState.milestones ?? {}),
          },
        }
      : DEFAULT_ONBOARDING_STATE
    hydrate(normalized)
    setModalityFocus(trainerModalityFocus)
  }, [initialState, trainerModalityFocus, hydrate, setModalityFocus])

  return <>{children}</>
}

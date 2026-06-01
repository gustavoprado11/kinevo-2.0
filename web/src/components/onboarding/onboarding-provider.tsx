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
    // Only hydrate when the page actually loaded the trainer's onboarding
    // state. Most pages render AppLayout WITHOUT passing it (initialState=null);
    // hydrating DEFAULT there would reset the checklist to 0/N on every
    // client-side navigation and clobber the real progress shown elsewhere.
    // Server state remains the single source of truth — we just don't wipe it
    // when a given page didn't fetch it.
    if (!initialState) return

    // With skipHydration: true, localStorage is NOT auto-restored.
    //
    // Trainers existentes podem ter onboarding_state em DB sem os campos novos
    // adicionados em Fase 17a (checklist_snoozed_until, milestones.mobile_logged_in,
    // milestones.first_training_room_session). Mesclar contra DEFAULT_ONBOARDING_STATE
    // pra garantir shape completo antes do hydrate.
    const normalized: OnboardingState = {
      ...DEFAULT_ONBOARDING_STATE,
      ...initialState,
      milestones: {
        ...DEFAULT_ONBOARDING_STATE.milestones,
        ...(initialState.milestones ?? {}),
      },
    }
    hydrate(normalized)
    setModalityFocus(trainerModalityFocus)
  }, [initialState, trainerModalityFocus, hydrate, setModalityFocus])

  return <>{children}</>
}

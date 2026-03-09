'use client'

import { useEffect } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'

interface OnboardingProviderProps {
  initialState: OnboardingState | null
  children: React.ReactNode
}

export function OnboardingProvider({
  initialState,
  children,
}: OnboardingProviderProps) {
  const hydrate = useOnboardingStore((s) => s.hydrate)

  useEffect(() => {
    // With skipHydration: true, localStorage is NOT auto-restored.
    // Server state is the single source of truth for boolean flags.
    hydrate(initialState ?? DEFAULT_ONBOARDING_STATE)
  }, [initialState, hydrate])

  return <>{children}</>
}

'use client'

import { useEffect } from 'react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'

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
    if (initialState) {
      hydrate(initialState)
    }
  }, [initialState, hydrate])

  return <>{children}</>
}

'use client'

import { useEffect, useCallback, useState } from 'react'
import { useOnboardingStore, type TourStep } from '@/stores/onboarding-store'
import { useSpotlightPosition } from '@/hooks/use-spotlight-position'
import { OnboardingSpotlight } from '../primitives/onboarding-spotlight'
import { OnboardingTooltip } from '../primitives/onboarding-tooltip'

interface TourRunnerProps {
  tourId: string
  steps: TourStep[]
  delay?: number
  autoStart?: boolean
}

const MOBILE_BREAKPOINT = 768

/**
 * Generic tour engine. Renders spotlight + tooltip for each step.
 *
 * Edge Case Rules:
 * 1. Race Conditions: If target not found in 2s, auto-skips the step.
 * 2. Click Blocking: Spotlight overlay blocks all app interaction.
 * 3. Mobile: If viewport < 768px, tour is skipped entirely (marks as completed).
 */
export function TourRunner({ tourId, steps, delay = 500, autoStart = false }: TourRunnerProps) {
  const activeTourId = useOnboardingStore((s) => s.activeTourId)
  const currentStepIndex = useOnboardingStore((s) => s.currentStepIndex)
  const isTourCompleted = useOnboardingStore((s) => s.isTourCompleted)
  const startTour = useOnboardingStore((s) => s.startTour)
  const nextStep = useOnboardingStore((s) => s.nextStep)
  const prevStep = useOnboardingStore((s) => s.prevStep)
  const skipTour = useOnboardingStore((s) => s.skipTour)
  const completeTour = useOnboardingStore((s) => s.completeTour)

  const [ready, setReady] = useState(false)

  const isActive = activeTourId === tourId
  const currentStep = isActive ? steps[currentStepIndex] : null
  const isLastStep = currentStepIndex === steps.length - 1
  const isFirstStep = currentStepIndex === 0

  // Auto-start: begin tour automatically on first visit if not yet completed
  useEffect(() => {
    if (!autoStart) return
    if (isTourCompleted(tourId)) return
    if (activeTourId !== null) return // another tour is active

    const timer = setTimeout(() => {
      // Re-check after delay (Zustand persist may have loaded by now)
      const store = useOnboardingStore.getState()
      if (!store.isTourCompleted(tourId) && store.activeTourId === null) {
        startTour(tourId)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [autoStart, tourId, delay, activeTourId, isTourCompleted, startTour])

  // Delay before showing tour
  useEffect(() => {
    if (!isActive) {
      setReady(false)
      return
    }
    const timer = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(timer)
  }, [isActive, delay])

  // Mobile check: skip tour entirely on small viewports
  useEffect(() => {
    if (isActive && typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT) {
      completeTour(tourId)
    }
  }, [isActive, tourId, completeTour])

  // Spotlight position for current step
  const { rect, timedOut } = useSpotlightPosition({
    selector: currentStep?.targetSelector ?? '',
    padding: currentStep?.spotlightPadding ?? 8,
    enabled: isActive && ready,
  })

  // Auto-skip step if target element not found (2s timeout)
  useEffect(() => {
    if (timedOut && isActive) {
      if (isLastStep) {
        completeTour(tourId)
      } else {
        nextStep()
      }
    }
  }, [timedOut, isActive, isLastStep, nextStep, completeTour, tourId])

  // Scroll target into view when step changes
  useEffect(() => {
    if (!isActive || !ready || !currentStep) return

    const el = document.querySelector(currentStep.targetSelector)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isActive, ready, currentStep])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeTour(tourId)
    } else {
      nextStep()
    }
  }, [isLastStep, completeTour, tourId, nextStep])

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      prevStep()
    }
  }, [isFirstStep, prevStep])

  const handleSkip = useCallback(() => {
    skipTour()
  }, [skipTour])

  // Don't render if tour is not active, not ready, or already completed
  if (!isActive || !ready || isTourCompleted(tourId)) return null

  return (
    <OnboardingSpotlight
      rect={rect}
      visible={!!rect}
      borderRadius={currentStep?.spotlightPadding ? 16 : 12}
    >
      {rect && currentStep && (
        <OnboardingTooltip
          targetRect={rect}
          placement={currentStep.placement}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          title={currentStep.title}
          description={currentStep.description}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
        />
      )}
    </OnboardingSpotlight>
  )
}

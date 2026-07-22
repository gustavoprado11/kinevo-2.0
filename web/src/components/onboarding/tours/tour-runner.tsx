'use client'

import { useEffect, useCallback, useMemo, useState } from 'react'
import { useOnboardingStore, type TourStep } from '@/stores/onboarding-store'
import { useSpotlightPosition } from '@/hooks/use-spotlight-position'
import { OnboardingSpotlight } from '../primitives/onboarding-spotlight'
import { OnboardingTooltip } from '../primitives/onboarding-tooltip'
import { resolveSteps } from './tour-definitions'
import { WelcomeMobileStep } from '../widgets/welcome-mobile-step'
import { SupersetDemo } from '../widgets/superset-demo'

interface TourRunnerProps {
  tourId: string
  /**
   * Steps explícitos. Quando omitido, o runner resolve via `resolveSteps(tourId, modalityFocus)`
   * — usado pelo welcome tour v2 pra filtrar por modalidade.
   */
  steps?: TourStep[]
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
export function TourRunner({ tourId, steps: stepsProp, delay = 500, autoStart = false }: TourRunnerProps) {
  const activeTourId = useOnboardingStore((s) => s.activeTourId)
  const currentStepIndex = useOnboardingStore((s) => s.currentStepIndex)
  const isTourCompleted = useOnboardingStore((s) => s.isTourCompleted)
  const startTour = useOnboardingStore((s) => s.startTour)
  const nextStep = useOnboardingStore((s) => s.nextStep)
  const prevStep = useOnboardingStore((s) => s.prevStep)
  const skipTour = useOnboardingStore((s) => s.skipTour)
  const completeTour = useOnboardingStore((s) => s.completeTour)
  const modalityFocus = useOnboardingStore((s) => s.modalityFocus)

  const [ready, setReady] = useState(false)

  const steps = useMemo<TourStep[]>(
    () => stepsProp ?? resolveSteps(tourId, modalityFocus),
    [stepsProp, tourId, modalityFocus],
  )

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

  // Global keyboard: Escape always exits; arrows navigate (unless typing in a field)
  useEffect(() => {
    if (!isActive || !ready) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        skipTour()
        return
      }
      const target = e.target as HTMLElement | null
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isActive, ready, skipTour, handleNext, handlePrev])

  // Don't render if tour is not active or not ready. Tours já completos PODEM
  // rodar de novo quando iniciados manualmente (TourHelpButton) — a gate de
  // "já visto" vale só para o auto-start acima.
  if (!isActive || !ready) return null

  return (
    <OnboardingSpotlight
      rect={rect}
      visible={!!rect}
      borderRadius={currentStep?.spotlightPadding ? 16 : 12}
      onDismiss={handleSkip}
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
          customContent={
            currentStep.customContentId === 'welcome-mobile-step'
              ? <WelcomeMobileStep />
              : currentStep.customContentId === 'superset-demo'
              ? <SupersetDemo />
              : undefined
          }
        />
      )}
    </OnboardingSpotlight>
  )
}

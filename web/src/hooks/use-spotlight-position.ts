'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface UseSpotlightPositionOptions {
  selector: string
  padding?: number
  enabled?: boolean
  timeoutMs?: number
}

interface UseSpotlightPositionResult {
  rect: SpotlightRect | null
  targetFound: boolean
  timedOut: boolean
}

/**
 * Calculates and tracks the position of a DOM element for the spotlight overlay.
 *
 * Edge Case Rules:
 * 1. Race Conditions: Uses MutationObserver + polling (100ms) to find elements
 *    that may render with delay (animations, lazy loading).
 * 2. Timeout: If element not found in `timeoutMs` (default 2000ms), sets `timedOut: true`
 *    so TourRunner can auto-skip the step.
 * 3. Recalculates on scroll, resize, and DOM mutations via ResizeObserver.
 */
export function useSpotlightPosition({
  selector,
  padding = 8,
  enabled = true,
  timeoutMs = 2000,
}: UseSpotlightPositionOptions): UseSpotlightPositionResult {
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [targetFound, setTargetFound] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elementRef = useRef<Element | null>(null)

  const calculateRect = useCallback(
    (element: Element) => {
      const domRect = element.getBoundingClientRect()
      setRect({
        top: domRect.top - padding,
        left: domRect.left - padding,
        width: domRect.width + padding * 2,
        height: domRect.height + padding * 2,
      })
    },
    [padding],
  )

  const findAndTrack = useCallback(() => {
    const el = document.querySelector(selector)
    if (!el) return false

    elementRef.current = el
    setTargetFound(true)
    setTimedOut(false)
    calculateRect(el)

    // Watch for size/position changes
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = new ResizeObserver(() => {
      if (elementRef.current) {
        calculateRect(elementRef.current)
      }
    })
    resizeObserverRef.current.observe(el)

    return true
  }, [selector, calculateRect])

  useEffect(() => {
    if (!enabled || !selector) {
      setRect(null)
      setTargetFound(false)
      setTimedOut(false)
      return
    }

    // Reset state for new selector
    setTargetFound(false)
    setTimedOut(false)
    setRect(null)
    elementRef.current = null

    // Try to find immediately
    if (findAndTrack()) {
      return
    }

    // Not found yet — start polling + MutationObserver
    pollingRef.current = setInterval(() => {
      if (findAndTrack()) {
        // Found — stop polling
        if (pollingRef.current) clearInterval(pollingRef.current)
        if (mutationObserverRef.current) mutationObserverRef.current.disconnect()
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }, 100)

    mutationObserverRef.current = new MutationObserver(() => {
      if (findAndTrack()) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        if (mutationObserverRef.current) mutationObserverRef.current.disconnect()
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    })
    mutationObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Timeout: if not found in timeoutMs, give up
    timeoutRef.current = setTimeout(() => {
      if (!elementRef.current) {
        console.warn(
          `[Onboarding] Target not found: ${selector}, skipping step`,
        )
        setTimedOut(true)
        if (pollingRef.current) clearInterval(pollingRef.current)
        if (mutationObserverRef.current) mutationObserverRef.current.disconnect()
      }
    }, timeoutMs)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (mutationObserverRef.current) mutationObserverRef.current.disconnect()
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [selector, enabled, findAndTrack, timeoutMs])

  // Recalculate on scroll and resize
  useEffect(() => {
    if (!enabled || !targetFound) return

    const handleRecalc = () => {
      if (elementRef.current) {
        calculateRect(elementRef.current)
      }
    }

    window.addEventListener('scroll', handleRecalc, { passive: true })
    window.addEventListener('resize', handleRecalc, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleRecalc)
      window.removeEventListener('resize', handleRecalc)
    }
  }, [enabled, targetFound, calculateRect])

  return { rect, targetFound, timedOut }
}

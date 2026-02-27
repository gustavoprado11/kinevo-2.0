'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { SpotlightRect } from '@/hooks/use-spotlight-position'

interface OnboardingSpotlightProps {
  rect: SpotlightRect | null
  visible: boolean
  borderRadius?: number
  children: React.ReactNode
}

/**
 * Full-screen overlay with a rectangular cutout revealing the target element.
 *
 * Edge Case Rules:
 * - pointer-events: all on overlay — blocks ALL clicks on the app underneath
 * - The cutout is VISUAL ONLY (via box-shadow inset) — no click-through
 * - Only tooltip children (z-[71]) are interactive
 * - Prevents accidental navigation during tours (e.g. clicking sidebar links)
 */
export function OnboardingSpotlight({
  rect,
  visible,
  borderRadius = 12,
  children,
}: OnboardingSpotlightProps) {
  return (
    <AnimatePresence>
      {visible && rect && (
        <>
          {/* Overlay — blocks all interaction with the app */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70]"
            style={{ pointerEvents: 'all' }}
          >
            {/* Semi-transparent overlay with cutout via box-shadow */}
            <motion.div
              className="absolute inset-0"
              animate={{
                // Using a massive box-shadow to create the overlay effect
                // with a transparent "hole" positioned at the target rect
                boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.65)`,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                borderRadius,
                pointerEvents: 'none',
              }}
            />

            {/* Subtle border around cutout for clarity */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              style={{
                position: 'absolute',
                top: rect.top - 1,
                left: rect.left - 1,
                width: rect.width + 2,
                height: rect.height + 2,
                borderRadius: borderRadius + 1,
                border: '1px solid rgba(139, 92, 246, 0.3)',
                pointerEvents: 'none',
              }}
            />
          </motion.div>

          {/* Tooltip container — sits above overlay, is interactive */}
          <div
            className="fixed inset-0 z-[71]"
            style={{ pointerEvents: 'none' }}
          >
            {children}
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

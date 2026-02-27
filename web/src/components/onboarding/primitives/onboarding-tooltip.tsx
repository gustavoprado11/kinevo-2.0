'use client'

import { useRef, useLayoutEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SpotlightRect } from '@/hooks/use-spotlight-position'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface OnboardingTooltipProps {
  targetRect: SpotlightRect
  placement: Placement
  stepIndex: number
  totalSteps: number
  title: string
  description: string
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  isLastStep: boolean
  isFirstStep: boolean
}

const TOOLTIP_GAP = 16
const ARROW_SIZE = 8
const VIEWPORT_PADDING = 16

function calculatePosition(
  targetRect: SpotlightRect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferredPlacement: Placement,
): { top: number; left: number; actualPlacement: Placement } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const placements: Record<Placement, { top: number; left: number }> = {
    bottom: {
      top: targetRect.top + targetRect.height + TOOLTIP_GAP,
      left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
    },
    top: {
      top: targetRect.top - tooltipHeight - TOOLTIP_GAP,
      left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
    },
    right: {
      top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
      left: targetRect.left + targetRect.width + TOOLTIP_GAP,
    },
    left: {
      top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
      left: targetRect.left - tooltipWidth - TOOLTIP_GAP,
    },
  }

  const fitsInViewport = (pos: { top: number; left: number }) =>
    pos.top >= VIEWPORT_PADDING &&
    pos.left >= VIEWPORT_PADDING &&
    pos.top + tooltipHeight <= vh - VIEWPORT_PADDING &&
    pos.left + tooltipWidth <= vw - VIEWPORT_PADDING

  // Try preferred placement first
  if (fitsInViewport(placements[preferredPlacement])) {
    return { ...placements[preferredPlacement], actualPlacement: preferredPlacement }
  }

  // Try all placements in priority order
  const fallbackOrder: Placement[] = ['bottom', 'right', 'top', 'left']
  for (const p of fallbackOrder) {
    if (p !== preferredPlacement && fitsInViewport(placements[p])) {
      return { ...placements[p], actualPlacement: p }
    }
  }

  // Nothing fits perfectly — use bottom clamped to viewport
  const pos = placements.bottom
  return {
    top: Math.max(VIEWPORT_PADDING, Math.min(pos.top, vh - tooltipHeight - VIEWPORT_PADDING)),
    left: Math.max(VIEWPORT_PADDING, Math.min(pos.left, vw - tooltipWidth - VIEWPORT_PADDING)),
    actualPlacement: 'bottom',
  }
}

function getArrowStyles(placement: Placement): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  }

  switch (placement) {
    case 'bottom':
      return {
        ...base,
        top: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: 'transparent transparent rgba(255,255,255,0.08) transparent',
      }
    case 'top':
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0 ${ARROW_SIZE}px`,
        borderColor: 'rgba(255,255,255,0.08) transparent transparent transparent',
      }
    case 'right':
      return {
        ...base,
        left: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderColor: 'transparent rgba(255,255,255,0.08) transparent transparent',
      }
    case 'left':
      return {
        ...base,
        right: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: 'transparent transparent transparent rgba(255,255,255,0.08)',
      }
  }
}

function getMotionInitial(placement: Placement) {
  switch (placement) {
    case 'bottom': return { opacity: 0, y: -8 }
    case 'top': return { opacity: 0, y: 8 }
    case 'right': return { opacity: 0, x: -8 }
    case 'left': return { opacity: 0, x: 8 }
  }
}

export function OnboardingTooltip({
  targetRect,
  placement: preferredPlacement,
  stepIndex,
  totalSteps,
  title,
  description,
  onNext,
  onPrev,
  onSkip,
  isLastStep,
  isFirstStep,
}: OnboardingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{
    top: number
    left: number
    actualPlacement: Placement
  } | null>(null)

  useLayoutEffect(() => {
    if (!tooltipRef.current) return
    const { width, height } = tooltipRef.current.getBoundingClientRect()
    setPosition(calculatePosition(targetRect, width, height, preferredPlacement))
  }, [targetRect, preferredPlacement])

  const actualPlacement = position?.actualPlacement ?? preferredPlacement

  return (
    <motion.div
      ref={tooltipRef}
      initial={getMotionInitial(actualPlacement)}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute bg-surface-card/95 backdrop-blur-xl border border-k-border-primary rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] max-w-sm w-80"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        pointerEvents: 'all',
      }}
      // Keyboard navigation
      onKeyDown={(e) => {
        if (e.key === 'Escape') onSkip()
        if (e.key === 'ArrowRight') onNext()
        if (e.key === 'ArrowLeft' && !isFirstStep) onPrev()
      }}
      tabIndex={0}
      role="dialog"
      aria-label={title}
    >
      {/* Arrow */}
      <div style={getArrowStyles(actualPlacement)} />

      {/* Step counter */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">
        {stepIndex + 1} de {totalSteps}
      </p>

      {/* Content */}
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
        {description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-4 transition-colors"
        >
          Pular tour
        </button>

        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-glass-bg"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-all active:scale-[0.97] shadow-sm shadow-violet-500/20"
          >
            {isLastStep ? 'Entendi!' : 'Próximo'}
            {!isLastStep && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

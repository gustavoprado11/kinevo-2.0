'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronUp, Check, Sparkles } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { CHECKLIST_ITEMS } from './checklist-items'
import { TOTAL_MILESTONES } from '@kinevo/shared/types/onboarding'

// ---------------------------------------------------------------------------
// Progress Circle SVG
// ---------------------------------------------------------------------------

function ProgressCircle({ completed, total }: { completed: number; total: number }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? completed / total : 0
  const dashOffset = circumference * (1 - progress)

  return (
    <svg width={44} height={44} viewBox="0 0 44 44" className="flex-shrink-0">
      {/* Background circle */}
      <circle
        cx={22}
        cy={22}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        className="text-k-border-primary"
      />
      {/* Progress arc */}
      <motion.circle
        cx={22}
        cy={22}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        className="text-violet-500"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        transform="rotate(-90 22 22)"
      />
      {/* Center text */}
      <text
        x={22}
        y={22}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[11px] font-bold"
      >
        {completed}/{total}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Individual Checklist Item
// ---------------------------------------------------------------------------

function ChecklistItemRow({
  item,
  isCompleted,
  justCompleted,
  onClick,
}: {
  item: (typeof CHECKLIST_ITEMS)[number]
  isCompleted: boolean
  justCompleted: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <motion.button
      onClick={isCompleted ? undefined : onClick}
      disabled={isCompleted}
      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
        isCompleted
          ? 'opacity-50 cursor-default'
          : 'hover:bg-glass-bg cursor-pointer'
      }`}
      animate={justCompleted ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Checkbox */}
      <div
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          isCompleted
            ? 'bg-violet-600 border-violet-600'
            : 'border-k-border-primary'
        }`}
      >
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <Check size={12} className="text-white" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-tight ${
            isCompleted
              ? 'line-through text-muted-foreground/60'
              : 'text-foreground'
          }`}
        >
          {item.label}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-tight">
          {item.description}
        </p>
      </div>

      {/* Icon */}
      <div
        className={`mt-0.5 flex-shrink-0 ${
          isCompleted ? 'text-muted-foreground/30' : 'text-muted-foreground/50'
        }`}
      >
        <Icon size={16} />
      </div>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Main Checklist Widget
// ---------------------------------------------------------------------------

export function OnboardingChecklist() {
  const router = useRouter()
  const isHydrated = useOnboardingStore((s) => s.isHydrated)
  const milestones = useOnboardingStore((s) => s.state.milestones)
  const checklistDismissed = useOnboardingStore(
    (s) => s.state.checklist_dismissed,
  )
  const isChecklistOpen = useOnboardingStore((s) => s.isChecklistOpen)
  const activeTourId = useOnboardingStore((s) => s.activeTourId)
  const toggleChecklist = useOnboardingStore((s) => s.toggleChecklist)
  const dismissChecklist = useOnboardingStore((s) => s.dismissChecklist)

  // Track which milestone just completed for bounce animation
  const [justCompleted, setJustCompleted] = useState<string | null>(null)
  const prevMilestonesRef = useRef(milestones)

  // Detect newly completed milestones
  useEffect(() => {
    const prev = prevMilestonesRef.current
    for (const key of Object.keys(milestones) as Array<keyof typeof milestones>) {
      if (milestones[key] && !prev[key]) {
        setJustCompleted(key)
        const timer = setTimeout(() => setJustCompleted(null), 600)
        return () => clearTimeout(timer)
      }
    }
    prevMilestonesRef.current = milestones
  }, [milestones])

  const completedCount = Object.values(milestones).filter(Boolean).length
  const allComplete = completedCount === TOTAL_MILESTONES

  // Don't render if not hydrated, dismissed, all complete, or tour active
  if (!isHydrated) return null
  if (checklistDismissed) return null
  if (allComplete) return null
  if (activeTourId) return null

  const handleItemClick = (href: string) => {
    router.push(href)
    // Collapse after navigation
    if (isChecklistOpen) {
      toggleChecklist()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[65]">
      <AnimatePresence mode="wait">
        {isChecklistOpen ? (
          // ───── Expanded Card ─────
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-80 bg-surface-card border border-k-border-primary rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-violet-500/8 blur-3xl rounded-full pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3 border-b border-k-border-subtle">
              <div className="flex items-center gap-3">
                <ProgressCircle
                  completed={completedCount}
                  total={TOTAL_MILESTONES}
                />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Primeiros Passos
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {completedCount} de {TOTAL_MILESTONES} concluídos
                  </p>
                </div>
              </div>
              <button
                onClick={dismissChecklist}
                className="p-1.5 text-muted-foreground/40 hover:text-foreground rounded-lg transition-colors"
                title="Dispensar checklist"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="px-4 pt-3">
              <div className="h-1.5 bg-k-border-primary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-violet-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(completedCount / TOTAL_MILESTONES) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Items List */}
            <div className="p-2 max-h-[360px] overflow-y-auto">
              {CHECKLIST_ITEMS.map((item) => (
                <ChecklistItemRow
                  key={item.key}
                  item={item}
                  isCompleted={milestones[item.key]}
                  justCompleted={justCompleted === item.key}
                  onClick={() => handleItemClick(item.href)}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 pb-3 pt-1 border-t border-k-border-subtle">
              <button
                onClick={dismissChecklist}
                className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-4 transition-colors"
              >
                Dispensar checklist
              </button>
            </div>
          </motion.div>
        ) : (
          // ───── Collapsed FAB ─────
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onClick={toggleChecklist}
            className="flex items-center gap-3 px-4 py-3 bg-surface-card border border-k-border-primary rounded-2xl shadow-xl hover:border-violet-500/30 transition-colors"
          >
            <ProgressCircle
              completed={completedCount}
              total={TOTAL_MILESTONES}
            />
            <div className="text-left">
              <p className="text-xs font-bold text-foreground">
                Primeiros Passos
              </p>
              <p className="text-[10px] text-muted-foreground">
                {completedCount} de {TOTAL_MILESTONES}
              </p>
            </div>
            <ChevronUp
              size={16}
              className="text-muted-foreground/40 ml-1"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

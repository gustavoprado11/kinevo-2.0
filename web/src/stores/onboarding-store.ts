import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  OnboardingState,
  OnboardingMilestones,
  TrainerModalityFocus,
} from '@kinevo/shared/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'

// ---------------------------------------------------------------------------
// Tour step type (consumed by TourRunner in Phase 2)
// ---------------------------------------------------------------------------

export interface TourStep {
  id: string
  targetSelector: string
  title: string
  description: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  spotlightPadding?: number
  /** Fase 17b — omitir step para certas modalidades. Undefined = sempre visível. */
  visibleFor?: TrainerModalityFocus[]
  /** Fase 17b — copy alternativo por modalidade. */
  byModality?: Partial<
    Record<
      Exclude<TrainerModalityFocus, null> | 'null',
      { title?: string; description?: string }
    >
  >
  /** Fase 17b — id que faz o TourRunner renderizar conteúdo customizado no tooltip. */
  customContentId?: string
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface OnboardingStore {
  // Persisted state (mirrors DB column)
  state: OnboardingState
  isHydrated: boolean

  // Ephemeral UI state (NOT persisted to DB — local only)
  activeTourId: string | null
  currentStepIndex: number
  isChecklistOpen: boolean

  // Trainer.modality_focus cached in-memory (NOT persisted — single source of
  // truth is the DB. Set by OnboardingProvider on hydrate and by widgets
  // that mutate the trainer record).
  modalityFocus: TrainerModalityFocus
  setModalityFocus: (focus: TrainerModalityFocus) => void

  // Hydration — called once by OnboardingProvider with server data
  hydrate: (serverState: OnboardingState) => void

  // Tour control
  startTour: (tourId: string) => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  completeTour: (tourId: string) => void
  isTourCompleted: (tourId: string) => boolean

  // Tips
  dismissTip: (tipId: string) => void
  isTipDismissed: (tipId: string) => boolean

  // Milestones
  completeMilestone: (key: keyof OnboardingMilestones) => void

  // Checklist
  toggleChecklist: () => void
  dismissChecklist: () => void
  snoozeChecklist: (days: number) => void
  isChecklistSnoozed: () => boolean

  // Welcome
  completeWelcomeTour: () => void

  // Internal: fire-and-forget sync to server
  _syncToServer: () => void
}

// ---------------------------------------------------------------------------
// Debounced sync helper
// ---------------------------------------------------------------------------

let syncTimer: ReturnType<typeof setTimeout> | null = null
const SYNC_DEBOUNCE_MS = 800

async function syncToServer(state: OnboardingState) {
  try {
    const { updateOnboardingState } = await import(
      '@/actions/onboarding/update-onboarding-state'
    )
    await updateOnboardingState(state)
  } catch {
    // Fire-and-forget: never block UI
    console.warn('[Onboarding] Failed to sync state to server')
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // ----- Persisted state -----
      state: DEFAULT_ONBOARDING_STATE,
      isHydrated: false,

      // ----- Ephemeral state -----
      activeTourId: null,
      currentStepIndex: 0,
      isChecklistOpen: false,
      modalityFocus: null,

      setModalityFocus(focus) {
        set({ modalityFocus: focus })
      },

      // ----- Hydration -----
      hydrate(serverState) {
        // Server is authoritative for boolean flags.
        // Arrays are unioned (additive — can't "un-complete" a tour).
        // Milestones are OR-merged (once completed, stays completed).
        const currentLocal = get().state
        const merged: OnboardingState = {
          welcome_tour_completed: serverState.welcome_tour_completed,
          checklist_dismissed: serverState.checklist_dismissed,
          // Server-wins pra snooze: usuário pode ter feito snooze em outro device.
          checklist_snoozed_until: serverState.checklist_snoozed_until ?? null,
          tours_completed: Array.from(
            new Set([
              ...serverState.tours_completed,
              ...currentLocal.tours_completed,
            ]),
          ),
          tips_dismissed: Array.from(
            new Set([
              ...serverState.tips_dismissed,
              ...currentLocal.tips_dismissed,
            ]),
          ),
          milestones: {
            ...serverState.milestones,
            ...Object.fromEntries(
              Object.entries(currentLocal.milestones).filter(([, v]) => v),
            ),
          } as OnboardingMilestones,
        }

        set({ state: merged, isHydrated: true })
      },

      // ----- Tour control -----
      startTour(tourId) {
        set({ activeTourId: tourId, currentStepIndex: 0 })
      },

      nextStep() {
        set((s) => ({ currentStepIndex: s.currentStepIndex + 1 }))
      },

      prevStep() {
        set((s) => ({
          currentStepIndex: Math.max(0, s.currentStepIndex - 1),
        }))
      },

      skipTour() {
        const { activeTourId } = get()
        if (activeTourId) {
          get().completeTour(activeTourId)
        }
      },

      completeTour(tourId) {
        set((s) => {
          const tours = s.state.tours_completed.includes(tourId)
            ? s.state.tours_completed
            : [...s.state.tours_completed, tourId]

          return {
            state: { ...s.state, tours_completed: tours },
            activeTourId: null,
            currentStepIndex: 0,
          }
        })
        get()._syncToServer()
      },

      isTourCompleted(tourId) {
        return get().state.tours_completed.includes(tourId)
      },

      // ----- Tips -----
      dismissTip(tipId) {
        set((s) => {
          if (s.state.tips_dismissed.includes(tipId)) return s
          return {
            state: {
              ...s.state,
              tips_dismissed: [...s.state.tips_dismissed, tipId],
            },
          }
        })
        get()._syncToServer()
      },

      isTipDismissed(tipId) {
        return get().state.tips_dismissed.includes(tipId)
      },

      // ----- Milestones -----
      completeMilestone(key) {
        set((s) => {
          if (s.state.milestones[key]) return s
          return {
            state: {
              ...s.state,
              milestones: { ...s.state.milestones, [key]: true },
            },
          }
        })
        get()._syncToServer()
      },

      // ----- Checklist -----
      toggleChecklist() {
        set((s) => ({ isChecklistOpen: !s.isChecklistOpen }))
      },

      dismissChecklist() {
        set((s) => ({
          state: { ...s.state, checklist_dismissed: true },
          isChecklistOpen: false,
        }))
        get()._syncToServer()
      },

      snoozeChecklist(days) {
        const until = new Date()
        until.setDate(until.getDate() + days)
        set((s) => ({
          state: { ...s.state, checklist_snoozed_until: until.toISOString() },
          isChecklistOpen: false,
        }))
        get()._syncToServer()
      },

      isChecklistSnoozed() {
        const until = get().state.checklist_snoozed_until
        if (!until) return false
        return new Date(until) > new Date()
      },

      // ----- Welcome -----
      completeWelcomeTour() {
        set((s) => ({
          state: { ...s.state, welcome_tour_completed: true },
        }))
        get()._syncToServer()
      },

      // ----- Server sync (debounced, fire-and-forget) -----
      _syncToServer() {
        if (syncTimer) clearTimeout(syncTimer)
        syncTimer = setTimeout(() => {
          syncToServer(get().state)
        }, SYNC_DEBOUNCE_MS)
      },
    }),
    {
      name: 'kinevo-onboarding',
      partialize: (s) => ({ state: s.state }),
      skipHydration: true,
    },
  ),
)

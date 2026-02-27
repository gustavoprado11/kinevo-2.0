import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  OnboardingState,
  OnboardingMilestones,
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

      // ----- Hydration -----
      hydrate(serverState) {
        const currentLocal = get().state
        // Server is source of truth — merge: server wins, but keep local
        // arrays that may have grown since last sync
        const merged: OnboardingState = {
          ...serverState,
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
    },
  ),
)

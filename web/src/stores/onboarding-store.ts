import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  OnboardingState,
  OnboardingMilestones,
  TrainerModalityFocus,
} from '@kinevo/shared/types/onboarding'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'
import { track } from '@/lib/analytics'

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
  startTour: (tourId: string, source?: 'auto' | 'manual') => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  completeTour: (tourId: string, options?: { silent?: boolean }) => void
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
const SYNC_MAX_ATTEMPTS = 3

// Marcador de sync pendente: gravado SINCRONAMENTE quando uma mutação agenda o
// sync (sobrevive a navegação/unload antes do debounce disparar) e limpo só
// após o server confirmar. Se a escrita falhar (rede, action retornando
// { error }), o snapshot fica aqui e o hydrate da próxima sessão o reenvia —
// é o que garante que "dispensei" nunca reaparece.
const PENDING_SYNC_KEY = 'kinevo-onboarding-pending'

function writePendingSync(state: OnboardingState) {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(state))
  } catch {
    // localStorage indisponível (SSR/quota) — sync ainda tenta normalmente
  }
}

function clearPendingSync() {
  try {
    localStorage.removeItem(PENDING_SYNC_KEY)
  } catch {
    // noop
  }
}

export function readPendingSync(): Partial<OnboardingState> | null {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as Partial<OnboardingState>
  } catch {
    return null
  }
}

async function syncToServer(state: OnboardingState) {
  try {
    const { updateOnboardingState } = await import(
      '@/actions/onboarding/update-onboarding-state'
    )
    for (let attempt = 1; attempt <= SYNC_MAX_ATTEMPTS; attempt++) {
      try {
        const result = await updateOnboardingState(state)
        if (!result.error) {
          clearPendingSync()
          return
        }
      } catch {
        // rede/exceção — cai no retry abaixo
      }
      if (attempt < SYNC_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1500))
      }
    }
  } catch {
    // import falhou — mantém pendência
  }
  // Todas as tentativas falharam: garante o snapshot pra próxima sessão
  writePendingSync(state)
  console.warn('[Onboarding] Failed to sync state to server — kept pending for retry on next load')
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
        // Tudo aditivo: "uma vez dispensado/concluído, fica".
        // Arrays são unidos; milestones OR-merge; e os booleanos de dispensa
        // (welcome/checklist) também são OR-merge com o estado local — antes
        // eram "server-wins", o que permitia um re-hydrate com o server defasado
        // (ex.: logo após revalidatePath, antes da escrita propagar) SOBRESCREVER
        // a dispensa otimista de volta pra false — o banner/modal reaparecia e o
        // sync seguinte ainda mandava false. OR-merge elimina esse clobber.
        // Snapshot de um sync que falhou (ou não chegou a disparar) na sessão
        // anterior: fold no estado local antes do merge com o server, e reenvia.
        // Sem isso, uma dispensa que não persistiu reapareceria aqui.
        const pending = readPendingSync()
        const rawLocal = get().state
        const currentLocal: OnboardingState = pending
          ? {
              welcome_tour_completed:
                pending.welcome_tour_completed === true || rawLocal.welcome_tour_completed,
              checklist_dismissed:
                pending.checklist_dismissed === true || rawLocal.checklist_dismissed,
              checklist_snoozed_until:
                (typeof pending.checklist_snoozed_until === 'string'
                  ? pending.checklist_snoozed_until
                  : null) ?? rawLocal.checklist_snoozed_until,
              tours_completed: Array.from(
                new Set([
                  ...(Array.isArray(pending.tours_completed) ? pending.tours_completed : []),
                  ...rawLocal.tours_completed,
                ]),
              ),
              tips_dismissed: Array.from(
                new Set([
                  ...(Array.isArray(pending.tips_dismissed) ? pending.tips_dismissed : []),
                  ...rawLocal.tips_dismissed,
                ]),
              ),
              milestones: {
                ...rawLocal.milestones,
                ...Object.fromEntries(
                  Object.entries(pending.milestones ?? {}).filter(([, v]) => v === true),
                ),
              } as OnboardingMilestones,
            }
          : rawLocal

        const merged: OnboardingState = {
          welcome_tour_completed:
            serverState.welcome_tour_completed || currentLocal.welcome_tour_completed,
          checklist_dismissed:
            serverState.checklist_dismissed || currentLocal.checklist_dismissed,
          // Server-wins pra snooze — exceto quando há pendência local (intenção
          // mais recente do usuário que ainda não chegou ao server).
          checklist_snoozed_until:
            (pending ? currentLocal.checklist_snoozed_until : null) ??
            serverState.checklist_snoozed_until ??
            null,
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

        // Reenvia a pendência da sessão anterior agora que temos sessão ativa.
        if (pending) get()._syncToServer()
      },

      // ----- Tour control -----
      startTour(tourId, source = 'auto') {
        track('tour_started', { tour: tourId, source })
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
        const { activeTourId, currentStepIndex } = get()
        if (activeTourId) {
          track('tour_skipped', { tour: activeTourId, step: currentStepIndex })
          // silent: pular marca como visto (não reaparece), mas não conta como conclusão
          get().completeTour(activeTourId, { silent: true })
        }
      },

      completeTour(tourId, options) {
        if (!options?.silent && !get().state.tours_completed.includes(tourId)) {
          track('tour_completed', { tour: tourId })
        }
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
        const already = get().state.milestones[key]
        set((s) => {
          if (s.state.milestones[key]) return s
          return {
            state: {
              ...s.state,
              milestones: { ...s.state.milestones, [key]: true },
            },
          }
        })
        // Funil de ativação (migração 266): só a PRIMEIRA conquista vira evento.
        if (!already) track(`milestone_${key}`)
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
        if (!get().state.welcome_tour_completed) track('welcome_tour_completed')
        set((s) => ({
          state: { ...s.state, welcome_tour_completed: true },
        }))
        get()._syncToServer()
      },

      // ----- Server sync (debounced; pendência persistida até confirmação) -----
      _syncToServer() {
        // Snapshot síncrono ANTES do debounce: se o usuário navegar/fechar a aba
        // nos próximos 800ms, o estado não se perde — o próximo hydrate reenvia.
        writePendingSync(get().state)
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

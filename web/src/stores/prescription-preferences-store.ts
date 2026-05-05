/**
 * Store de preferências de prescrição (espelho client-side do banco).
 *
 * Esta store NÃO chama server actions. Ela é apenas o estado UI: o componente
 * que decide mudar uma preferência é responsável por orquestrar o ciclo:
 *
 *     const previous = useStore.getState().preferences
 *     useStore.getState().updatePatch(patch)         // optimistic
 *     const result = await updatePrescriptionPreferences(patch)
 *     if (!result.success) {
 *         useStore.getState().rollback(previous)     // restaura
 *         toast({ message: result.message, type: 'error' })
 *     } else {
 *         toast({ message: 'Preferências salvas' })
 *     }
 *
 * Sem persist middleware — o estado vive no banco; a store é hidratada
 * server-side via `setPreferences(props.preferences)` no primeiro render
 * do `ProgramBuilderClient`.
 *
 * Limitação conhecida (v1): updates concorrentes (mesmo treinador editando
 * em duas abas) podem produzir last-write-wins e a outra aba ficará com
 * estado stale até refresh. Aceitável para v1.
 */

import { create } from 'zustand'
import {
    KINEVO_DEFAULT_PREFERENCES,
    mergePreferences,
    type DeepPartial,
    type PrescriptionPreferences,
} from '@/types/prescription-preferences'

interface PrescriptionPreferencesStore {
    preferences: PrescriptionPreferences
    isDrawerOpen: boolean
    isWizardOpen: boolean

    /** Substitui completamente o estado (hidratação inicial / após server action ok). */
    setPreferences: (preferences: PrescriptionPreferences) => void

    /**
     * Aplica deep-merge otimista de um patch parcial.
     * Reusa `mergePreferences` para manter paridade com o servidor.
     */
    updatePatch: (patch: DeepPartial<PrescriptionPreferences>) => void

    /**
     * Restaura um snapshot anterior das preferências.
     *
     * SÓ deve ser chamado dentro do `catch` (ou ramo `!result.success`) de
     * uma server action que falhou após `updatePatch` otimista. Em qualquer
     * outro contexto, prefira `setPreferences`.
     */
    rollback: (previous: PrescriptionPreferences) => void

    openDrawer: () => void
    closeDrawer: () => void
    openWizard: () => void
    closeWizard: () => void
}

export const usePrescriptionPreferencesStore = create<PrescriptionPreferencesStore>((set) => ({
    preferences: KINEVO_DEFAULT_PREFERENCES,
    isDrawerOpen: false,
    isWizardOpen: false,

    setPreferences: (preferences) => set({ preferences }),

    updatePatch: (patch) =>
        set((state) => ({ preferences: mergePreferences(state.preferences, patch) })),

    rollback: (previous) => set({ preferences: previous }),

    openDrawer: () => set({ isDrawerOpen: true }),
    closeDrawer: () => set({ isDrawerOpen: false }),
    openWizard: () => set({ isWizardOpen: true }),
    closeWizard: () => set({ isWizardOpen: false }),
}))

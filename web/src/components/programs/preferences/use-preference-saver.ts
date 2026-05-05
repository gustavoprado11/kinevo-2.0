'use client'

import { useCallback } from 'react'
import { updatePrescriptionPreferences } from '@/actions/trainer/update-prescription-preferences'
import { useToast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'
import type { DeepPartial, PrescriptionPreferences } from '@/types/prescription-preferences'

/**
 * Extrai o primeiro caminho leaf do patch em dot notation + valor associado.
 * Ex: { visualization: { default_view: 'compare' } } → { field: 'visualization.default_view', value: 'compare' }
 * Usado pra emitir analytics legível em vez do patch raw.
 */
function describeFirstPatchLeaf(patch: unknown): { field: string; value: unknown } | null {
    if (typeof patch !== 'object' || patch === null) return null
    const entries = Object.entries(patch as Record<string, unknown>)
    if (entries.length === 0) return null
    const [key, value] = entries[0]
    if (
        typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
    ) {
        const nested = describeFirstPatchLeaf(value)
        return nested ? { field: `${key}.${nested.field}`, value: nested.value } : { field: key, value }
    }
    return { field: key, value }
}

/**
 * Hook que centraliza o ciclo otimista de salvamento de preferências:
 * snapshot → updatePatch → server action → toast success ou rollback + toast error.
 *
 * Reusado em todas as 6 sections do drawer.
 */
export function usePreferenceSaver() {
    const { toast } = useToast()

    return useCallback(
        async (patch: DeepPartial<PrescriptionPreferences>) => {
            const leaf = describeFirstPatchLeaf(patch)
            track('prescription_preferences_changed', leaf ?? { patch })
            const previous = usePrescriptionPreferencesStore.getState().preferences
            usePrescriptionPreferencesStore.getState().updatePatch(patch)

            const result = await updatePrescriptionPreferences(patch)

            if (!result.success) {
                usePrescriptionPreferencesStore.getState().rollback(previous)
                toast({ message: result.message || 'Não foi possível salvar suas preferências.', type: 'error' })
                return
            }

            // Sincroniza com a versão canônica do servidor (deep-merge feito lá).
            usePrescriptionPreferencesStore.getState().setPreferences(result.preferences)
            toast({ message: 'Preferências salvas' })
        },
        [toast],
    )
}

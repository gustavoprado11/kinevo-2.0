'use client'

import { X } from 'lucide-react'
import { updatePrescriptionPreferences } from '@/actions/trainer/update-prescription-preferences'
import { track } from '@/lib/analytics'
import { usePrescriptionPreferencesStore } from '@/stores/prescription-preferences-store'

/**
 * Banner fino que aparece abaixo do header da tela de prescrição quando
 * o treinador pulou o wizard (wizard_dismissed=true && wizard_completed=false).
 *
 * Dispensar o banner conta como "completou implicitamente" — chama
 * updatePrescriptionPreferences({ wizard_completed: true, wizard_dismissed: false })
 * para que ele não volte a aparecer.
 */
export function PreferencesBanner() {
    const wizardCompleted = usePrescriptionPreferencesStore((s) => s.preferences.wizard_completed)
    const wizardDismissed = usePrescriptionPreferencesStore((s) => s.preferences.wizard_dismissed)
    const openWizard = usePrescriptionPreferencesStore((s) => s.openWizard)

    if (wizardCompleted || !wizardDismissed) return null

    const handleDismiss = async () => {
        track('prescription_preferences_banner_dismissed')
        const previous = usePrescriptionPreferencesStore.getState().preferences
        usePrescriptionPreferencesStore.getState().updatePatch({
            wizard_completed: true,
            wizard_dismissed: false,
        })
        const result = await updatePrescriptionPreferences({
            wizard_completed: true,
            wizard_dismissed: false,
        })
        if (!result.success) {
            usePrescriptionPreferencesStore.getState().rollback(previous)
            return
        }
        usePrescriptionPreferencesStore.getState().setPreferences(result.preferences)
    }

    return (
        <div
            role="region"
            aria-label="Configuração de preferências"
            className="bg-violet-50 dark:bg-violet-500/10 border-b border-violet-200 dark:border-violet-500/20 px-6 py-2 flex items-center justify-between"
        >
            <p className="text-xs text-violet-700 dark:text-violet-300">
                Configure suas preferências em 1 minuto pra acelerar a criação de treinos.
            </p>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        track('prescription_preferences_wizard_started', { source: 'banner' })
                        openWizard()
                    }}
                    className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline"
                >
                    Configurar agora →
                </button>
                <button
                    type="button"
                    onClick={() => void handleDismiss()}
                    aria-label="Dispensar"
                    className="text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 transition-colors duration-150"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
}

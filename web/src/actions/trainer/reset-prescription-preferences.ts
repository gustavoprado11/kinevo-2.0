'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    KINEVO_DEFAULT_PREFERENCES,
    type PrescriptionPreferences,
} from '@/types/prescription-preferences'

export type ResetPrescriptionPreferencesResult =
    | { success: true; preferences: PrescriptionPreferences }
    | { success: false; message: string }

/**
 * Reseta `trainers.prescription_preferences` para os defaults da Kinevo,
 * preservando `wizard_completed` e `wizard_dismissed` (restaurar padrões
 * não força refazer o onboarding).
 */
export async function resetPrescriptionPreferences(): Promise<ResetPrescriptionPreferencesResult> {
    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: 'Sessão inválida.' }
    }

    const { data: trainer, error: selectError } = await supabase
        .from('trainers')
        .select('prescription_preferences')
        .eq('auth_user_id', user.id)
        .maybeSingle<{ prescription_preferences: PrescriptionPreferences | null }>()

    if (selectError || !trainer) {
        console.error('[resetPrescriptionPreferences] select error:', selectError)
        return { success: false, message: 'Erro ao restaurar.' }
    }

    const current = trainer.prescription_preferences ?? KINEVO_DEFAULT_PREFERENCES
    const reset: PrescriptionPreferences = {
        ...KINEVO_DEFAULT_PREFERENCES,
        wizard_completed: current.wizard_completed,
        wizard_dismissed: current.wizard_dismissed,
    }

    const { error: updateError } = await supabase
        .from('trainers')
        .update({ prescription_preferences: reset })
        .eq('auth_user_id', user.id)

    if (updateError) {
        console.error('[resetPrescriptionPreferences] update error:', updateError)
        return { success: false, message: 'Erro ao restaurar.' }
    }

    revalidatePath('/programs', 'layout')

    return { success: true, preferences: reset }
}

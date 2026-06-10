'use server'

import { revalidatePath } from 'next/cache'
import type { Json } from '@kinevo/shared/types/database'
import { createClient } from '@/lib/supabase/server'
import {
    KINEVO_DEFAULT_PREFERENCES,
    mergePreferences,
    type PrescriptionPreferences,
} from '@/types/prescription-preferences'

export type MarkWizardAction = 'completed' | 'dismissed'

export type MarkWizardResult =
    | { success: true; preferences: PrescriptionPreferences }
    | { success: false; message: string }

/**
 * Marca o estado do wizard de onboarding de prescrição.
 * - `completed`: usuário concluiu o wizard ou dispensou o banner.
 * - `dismissed`: usuário clicou "Pular" no wizard (banner aparece depois).
 */
export async function markWizard(action: MarkWizardAction): Promise<MarkWizardResult> {
    if (action !== 'completed' && action !== 'dismissed') {
        return { success: false, message: 'Ação inválida.' }
    }

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
        console.error('[markWizard] select error:', selectError)
        return { success: false, message: 'Erro ao carregar preferências.' }
    }

    const current = trainer.prescription_preferences ?? KINEVO_DEFAULT_PREFERENCES
    const patch =
        action === 'completed'
            ? { wizard_completed: true }
            : { wizard_dismissed: true }
    const merged = mergePreferences(current, patch)

    const { error: updateError } = await supabase
        .from('trainers')
        // jsonb na fronteira: PrescriptionPreferences é estruturalmente compatível com Json
        .update({ prescription_preferences: merged as unknown as Json })
        .eq('auth_user_id', user.id)

    if (updateError) {
        console.error('[markWizard] update error:', updateError)
        return { success: false, message: 'Erro ao atualizar wizard.' }
    }

    revalidatePath('/programs', 'layout')

    return { success: true, preferences: merged }
}

'use server'

import { revalidatePath } from 'next/cache'
import type { Json } from '@kinevo/shared/types/database'
import { createClient } from '@/lib/supabase/server'
import {
    KINEVO_DEFAULT_PREFERENCES,
    mergePreferences,
    type DeepPartial,
    type PrescriptionPreferences,
} from '@/types/prescription-preferences'

export type UpdatePrescriptionPreferencesResult =
    | { success: true; preferences: PrescriptionPreferences }
    | { success: false; message: string }

const ALLOWED_TOP_LEVEL_KEYS = new Set(Object.keys(KINEVO_DEFAULT_PREFERENCES))

function isValidPatchShape(patch: unknown): patch is DeepPartial<PrescriptionPreferences> {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return false
    return Object.keys(patch).every((key) => ALLOWED_TOP_LEVEL_KEYS.has(key))
}

/**
 * Aplica um patch parcial sobre `trainers.prescription_preferences` para o
 * treinador autenticado. Faz deep-merge no servidor com fallback defensivo
 * para os defaults da Kinevo caso a coluna esteja NULL (legado).
 */
export async function updatePrescriptionPreferences(
    patch: DeepPartial<PrescriptionPreferences>,
): Promise<UpdatePrescriptionPreferencesResult> {
    if (!isValidPatchShape(patch)) {
        return { success: false, message: 'Patch inválido.' }
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
        console.error('[updatePrescriptionPreferences] select error:', selectError)
        return { success: false, message: 'Erro ao salvar.' }
    }

    const current = trainer.prescription_preferences ?? KINEVO_DEFAULT_PREFERENCES
    const merged = mergePreferences(current, patch)

    const { error: updateError } = await supabase
        .from('trainers')
        // jsonb na fronteira: PrescriptionPreferences é estruturalmente compatível com Json
        .update({ prescription_preferences: merged as unknown as Json })
        .eq('auth_user_id', user.id)

    if (updateError) {
        console.error('[updatePrescriptionPreferences] update error:', updateError)
        return { success: false, message: 'Erro ao salvar.' }
    }

    revalidatePath('/programs', 'layout')

    return { success: true, preferences: merged }
}

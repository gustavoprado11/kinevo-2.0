'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ThemePreference = 'light' | 'dark' | 'system'

export type UpdateThemeResult = {
    success: boolean
    message?: string
}

function isThemePreference(value: string): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system'
}

export async function updateTheme(theme: string): Promise<UpdateThemeResult> {
    if (!isThemePreference(theme)) {
        return { success: false, message: 'Tema inválido.' }
    }

    const supabase = await createClient()
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { success: false, message: 'Sessão inválida.' }
    }

    const { error } = await supabase
        .from('trainers')
        .update({ theme })
        .eq('auth_user_id', user.id)

    if (error) {
        return { success: false, message: error.message }
    }

    revalidatePath('/settings')

    return { success: true }
}

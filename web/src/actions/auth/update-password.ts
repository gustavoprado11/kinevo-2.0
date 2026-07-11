'use server'

import { createClient } from '@/lib/supabase/server'
import { checkPasswordPwned } from '@/lib/auth/hibp-check'
import { translateAuthError } from '@/lib/translate-auth-error'

interface UpdatePasswordResult {
    success: boolean
    error?: string
}

/**
 * Troca a senha do usuário logado (fluxo de recovery) com a MESMA política do
 * signup (AC4): mínimo 8 caracteres + blocklist local + HIBP k-anonymity.
 * Antes, o reset aceitava 6 chars sem checagem nenhuma — a recuperação era um
 * bypass da política de senha.
 */
export async function updatePasswordSecure(
    password: string,
): Promise<UpdatePasswordResult> {
    if (typeof password !== 'string' || password.length < 8) {
        return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' }
    }
    if (password.length > 256) {
        return { success: false, error: 'Senha muito longa.' }
    }

    const hibp = await checkPasswordPwned(password)
    if (!hibp.safe) {
        return { success: false, error: hibp.error || 'Senha não permitida.' }
    }

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
        return {
            success: false,
            error: 'Sessão de redefinição expirada. Peça um novo link.',
        }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
        return { success: false, error: translateAuthError(error.message) }
    }
    return { success: true }
}

import type { SupabaseClient } from '@supabase/supabase-js'

export type ThemePreference = 'light' | 'dark' | 'system'

function isThemePreference(value: unknown): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Lê a preferência de tema do treinador no login, para aplicá-la ANTES de entrar
 * na área logada (o chamador passa o resultado para o `setTheme` do next-themes).
 *
 * Por que no login: o next-themes decide o tema num script pré-paint que só lê o
 * localStorage. Num navegador novo não há nada lá — a primeira tela pintava clara
 * e só o `ThemeSync` (efeito pós-hidratação, que lê `trainers.theme`) corrigia. Era
 * o flash de tema claro que o treinador de tema escuro via ao entrar. O login é o
 * único ponto de entrada de um navegador novo, e aplicar o tema lá resolve tanto a
 * navegação client-side (estado em memória) quanto as cargas seguintes (o próprio
 * setTheme persiste no localStorage, que o script pré-paint passa a encontrar).
 *
 * Best-effort: devolve null em qualquer falha — o ThemeSync continua sendo a rede
 * de segurança, só que depois da hidratação.
 */
export async function fetchTrainerThemePreference(
    supabase: SupabaseClient,
    authUserId: string,
): Promise<ThemePreference | null> {
    try {
        const { data } = await supabase
            .from('trainers')
            .select('theme')
            .eq('auth_user_id', authUserId)
            .single()

        return isThemePreference(data?.theme) ? data.theme : null
    } catch {
        return null
    }
}

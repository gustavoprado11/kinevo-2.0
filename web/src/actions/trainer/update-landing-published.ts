'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateLandingPublishedResult =
    | { success: true; published: boolean }
    | { success: false; message: string }

/**
 * Toggle de publicação da landing pública.
 *
 * Requer que o trainer tenha `public_slug` definido — caso contrário,
 * publicar uma landing sem URL é inválido (não tem onde acessar).
 */
export async function updateLandingPublished(
    published: boolean,
): Promise<UpdateLandingPublishedResult> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return { success: false, message: 'Sessão inválida.' }

        const { data: trainer, error: tErr } = await supabase
            .from('trainers')
            .select('id, public_slug')
            .eq('auth_user_id', user.id)
            .single()
        if (tErr || !trainer) return { success: false, message: 'Treinador não encontrado.' }

        // Pre-flight: precisa de slug pra publicar.
        if (published && !(trainer as { public_slug?: string | null }).public_slug) {
            return { success: false, message: 'Defina sua URL pública antes de publicar.' }
        }

        const { error: updError } = await supabase
            .from('trainers')
            .update({ landing_published: published } as never)
            .eq('id', trainer.id)
        if (updError) {
            console.error('[updateLandingPublished] error:', updError)
            return { success: false, message: 'Não foi possível salvar agora.' }
        }

        revalidatePath('/settings')
        // Invalida a página pública também — ela tem ISR de 60s, mas
        // revalidatePath força a re-render no próximo request.
        if ((trainer as { public_slug?: string | null }).public_slug) {
            revalidatePath(`/com/${(trainer as { public_slug?: string | null }).public_slug}`)
        }
        return { success: true, published }
    } catch (err) {
        console.error('[updateLandingPublished] unexpected:', err)
        return { success: false, message: 'Erro inesperado.' }
    }
}

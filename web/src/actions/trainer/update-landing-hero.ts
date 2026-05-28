'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface UpdateLandingHeroResult {
    success: boolean
    message?: string
    heroImageUrl?: string | null
}

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
}
const MAX_FILE_SIZE = 6 * 1024 * 1024 // 6MB

function getExtension(fileName: string): string | null {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) return null
    return ext
}

/**
 * Upload da foto do hero da landing pública.
 *
 *   Reusa o bucket `avatars` (mesmo padrão do logo de marca). Aceita
 *   `hero_image` (File) no FormData; `remove=true` limpa a foto (volta a
 *   cair no avatar do trainer na landing).
 *   SVG não é aceito aqui de propósito — foto de hero é raster.
 */
export async function updateLandingHero(formData: FormData): Promise<UpdateLandingHeroResult> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, message: 'Sessão expirada.' }
        }

        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id, public_slug')
            .eq('auth_user_id', user.id)
            .single()
        if (trainerError || !trainer) {
            return { success: false, message: 'Treinador não encontrado.' }
        }
        const trainerRow = trainer as { id: string; public_slug: string | null }

        // Remoção explícita.
        if (formData.get('remove') === 'true') {
            const { error } = await supabase
                .from('trainers')
                .update({ landing_hero_image_url: null } as never)
                .eq('id', trainerRow.id)
            if (error) {
                console.error('[updateLandingHero] remove error:', error)
                return { success: false, message: 'Não foi possível remover a foto.' }
            }
            if (trainerRow.public_slug) revalidatePath(`/com/${trainerRow.public_slug}`)
            revalidatePath('/marketing/landing')
            return { success: true, heroImageUrl: null }
        }

        const file = formData.get('hero_image')
        if (!(file instanceof File) || file.size === 0) {
            return { success: false, message: 'Nenhuma imagem enviada.' }
        }
        if (file.size > MAX_FILE_SIZE) {
            return { success: false, message: 'Imagem muito grande. Máximo 6MB.' }
        }
        const ext = getExtension(file.name)
        if (!ext) {
            return { success: false, message: 'Formato não suportado. Use JPG, PNG ou WebP.' }
        }

        const filePath = `${user.id}/landing_hero_${trainerRow.id}_${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true, contentType: CONTENT_TYPES[ext] })
        if (uploadError) {
            console.error('[updateLandingHero] upload error:', uploadError)
            return { success: false, message: 'Falha no upload da imagem.' }
        }

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath)
        const heroImageUrl = publicData.publicUrl

        const { error: updateError } = await supabase
            .from('trainers')
            .update({ landing_hero_image_url: heroImageUrl } as never)
            .eq('id', trainerRow.id)
        if (updateError) {
            console.error('[updateLandingHero] update error:', updateError)
            return { success: false, message: 'Não foi possível salvar a foto.' }
        }

        if (trainerRow.public_slug) revalidatePath(`/com/${trainerRow.public_slug}`)
        revalidatePath('/marketing/landing')
        return { success: true, heroImageUrl }
    } catch (err) {
        console.error('[updateLandingHero] unexpected:', err)
        return { success: false, message: 'Erro inesperado.' }
    }
}

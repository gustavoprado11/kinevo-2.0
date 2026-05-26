'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateTrainerBrandingResult = {
    success: boolean
    message: string
    brandName?: string | null
    brandColor?: string | null
    brandLogoUrl?: string | null
}

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg']
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    svg: 'image/svg+xml',
}
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
const MAX_BRAND_NAME = 40

function getFileExtension(fileName: string): string | null {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return null
    return ext
}

export async function updateTrainerBranding(formData: FormData): Promise<UpdateTrainerBrandingResult> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, message: 'Sessão inválida. Faça login novamente.' }
        }

        // ── Nome de marca (opcional; vazio = volta a usar trainers.name) ──
        const rawName = formData.get('brand_name')
        const trimmed = typeof rawName === 'string' ? rawName.trim() : ''
        if (trimmed.length > MAX_BRAND_NAME) {
            return { success: false, message: `Nome de marca muito longo (máx. ${MAX_BRAND_NAME} caracteres).` }
        }
        const brandName = trimmed.length > 0 ? trimmed : null

        // ── Cor da marca (opcional; vazio = roxo Kinevo padrão) ──
        const rawColor = formData.get('brand_color')
        const color = typeof rawColor === 'string' ? rawColor.trim() : ''
        if (color && !HEX_COLOR.test(color)) {
            return { success: false, message: 'Cor inválida. Use o formato #RRGGBB.' }
        }
        const brandColor = color.length > 0 ? color.toUpperCase() : null

        // Nota: "powered by Kinevo" é sempre exibido (padrão da plataforma).
        // O treinador não controla isso — a coluna brand_show_powered_by fica
        // no default true e não é atualizada aqui.

        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id, brand_logo_url')
            .eq('auth_user_id', user.id)
            .single()

        if (trainerError || !trainer) {
            return { success: false, message: 'Treinador não encontrado.' }
        }

        let brandLogoUrl = (trainer as { brand_logo_url?: string | null }).brand_logo_url ?? null

        // ── Upload de logo (opcional) — reusa bucket avatars ──
        const logoFile = formData.get('brand_logo')
        if (logoFile instanceof File && logoFile.size > 0) {
            if (logoFile.size > MAX_FILE_SIZE) {
                return { success: false, message: 'Logo muito grande. Máximo 5MB.' }
            }
            const extension = getFileExtension(logoFile.name)
            if (!extension) {
                return { success: false, message: 'Formato não suportado. Use PNG, SVG, JPG ou WebP.' }
            }

            const filePath = `${user.id}/brand_logo_${trainer.id}_${Date.now()}.${extension}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, logoFile, {
                    upsert: true,
                    contentType: ALLOWED_CONTENT_TYPES[extension],
                })

            if (uploadError) {
                console.error('[updateTrainerBranding] Upload error:', uploadError)
                return { success: false, message: 'Falha no upload do logo.' }
            }

            const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath)
            brandLogoUrl = publicData.publicUrl
        }

        const { error: updateError } = await supabase
            .from('trainers')
            .update({
                brand_name: brandName,
                brand_color: brandColor,
                brand_logo_url: brandLogoUrl,
            } as never)
            .eq('id', trainer.id)

        if (updateError) {
            console.error('[updateTrainerBranding] Update error:', updateError)
            return { success: false, message: 'Erro ao salvar a marca.' }
        }

        revalidatePath('/settings')

        return {
            success: true,
            message: 'Marca atualizada. Seus alunos já verão o app personalizado.',
            brandName,
            brandColor,
            brandLogoUrl,
        }
    } catch (error) {
        console.error('[updateTrainerBranding] Unexpected error:', error)
        return { success: false, message: 'Ocorreu um erro inesperado ao salvar a marca.' }
    }
}

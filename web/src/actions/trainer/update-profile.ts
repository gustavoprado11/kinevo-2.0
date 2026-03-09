'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateTrainerProfileResult = {
    success: boolean
    message: string
    name?: string
    avatarUrl?: string | null
}

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
}
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function getFileExtension(fileName: string): string | null {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return null
    return ext
}

export async function updateTrainerProfile(formData: FormData): Promise<UpdateTrainerProfileResult> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, message: 'Sessão inválida. Faça login novamente.' }
        }

        const rawName = formData.get('name')
        const name = typeof rawName === 'string' ? rawName.trim() : ''

        if (!name || name.length < 2) {
            return { success: false, message: 'Informe um nome válido (mínimo 2 caracteres).' }
        }

        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id, avatar_url')
            .eq('auth_user_id', user.id)
            .single()

        if (trainerError || !trainer) {
            return { success: false, message: 'Treinador não encontrado.' }
        }

        let avatarUrl = trainer.avatar_url as string | null

        const avatarFile = formData.get('avatar')
        if (avatarFile instanceof File && avatarFile.size > 0) {
            // Validate file size
            if (avatarFile.size > MAX_FILE_SIZE) {
                return { success: false, message: 'Imagem muito grande. Máximo 5MB.' }
            }

            // Validate file extension (allowlist: jpg, jpeg, png, webp)
            const extension = getFileExtension(avatarFile.name)
            if (!extension) {
                return { success: false, message: 'Formato de imagem não suportado. Use JPG, PNG ou WebP.' }
            }

            const filePath = `${user.id}/avatar_${trainer.id}_${Date.now()}.${extension}`

            // Override content type from validated extension (never trust client)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile, {
                    upsert: true,
                    contentType: ALLOWED_CONTENT_TYPES[extension],
                })

            if (uploadError) {
                return { success: false, message: `Falha no upload da imagem: ${uploadError.message}` }
            }

            const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath)
            avatarUrl = publicData.publicUrl
        }

        const { error: updateError } = await supabase
            .from('trainers')
            .update({
                name,
                avatar_url: avatarUrl,
            })
            .eq('id', trainer.id)

        if (updateError) {
            return { success: false, message: `Erro ao atualizar perfil: ${updateError.message}` }
        }

        revalidatePath('/settings')
        revalidatePath('/')

        return {
            success: true,
            message: 'Perfil atualizado com sucesso.',
            name,
            avatarUrl,
        }
    } catch (error) {
        console.error('[updateTrainerProfile] Unexpected error:', error)
        return { success: false, message: 'Ocorreu um erro inesperado ao salvar seu perfil.' }
    }
}

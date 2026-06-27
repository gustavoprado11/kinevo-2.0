'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkVideoCompat, isOwnedStoragePath } from '@/lib/video-codec-server'

export type TrainerVideoResult = {
    success: boolean
    message: string
    data?: {
        video_url: string
        video_type: 'upload' | 'external_url'
    } | null
}

export async function saveTrainerVideoMetadata(params: {
    exerciseId: string
    videoType: 'upload' | 'external_url'
    videoUrl: string
    storagePath?: string
    originalFilename?: string
    fileSizeBytes?: number
}): Promise<TrainerVideoResult> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, message: 'Sessão inválida.' }
        }

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return { success: false, message: 'Treinador não encontrado.' }
        }

        // Backstop server-side: rejeita upload com codec que toca "som sem
        // imagem" no aluno (H.264 10-bit / HEVC), mesmo se a conversão no
        // navegador falhou ou foi contornada. Roda ANTES de tocar no registro
        // existente, pra não apagar um vídeo bom ao rejeitar o novo.
        if (params.videoType === 'upload' && params.storagePath) {
            // SSRF: o storagePath é entrada do cliente e passa a ser a fonte da
            // URL que o servidor busca. Ele PRECISA pertencer ao usuário e não
            // escapar do próprio prefixo — senão só trocamos "URL não-confiável"
            // por "path não-confiável".
            if (!isOwnedStoragePath(params.storagePath, user.id)) {
                return { success: false, message: 'Caminho de vídeo inválido.' }
            }
            // A URL buscada é DERIVADA no servidor a partir do storagePath (host
            // fixo do Supabase Storage via getPublicUrl). params.videoUrl NUNCA é
            // buscado — assim deixa de ser um sink de SSRF (169.254.x, hosts
            // internos, redirect 3xx, DNS rebinding: eliminados por construção).
            const { data: { publicUrl } } = supabase.storage
                .from('trainer-videos')
                .getPublicUrl(params.storagePath)
            const compat = await checkVideoCompat(publicUrl)
            if (!compat.compatible) {
                await supabase.storage.from('trainer-videos').remove([params.storagePath])
                return {
                    success: false,
                    message: `Esse vídeo (${compat.reason}) não toca em todos os dispositivos dos alunos. Envie um MP4 H.264 (8-bit) — ou regrave/exporte o vídeo e tente de novo.`,
                }
            }
        }

        // If replacing an upload, delete old file from storage
        const { data: existing } = await supabase
            .from('trainer_exercise_videos')
            .select('storage_path')
            .eq('trainer_id', trainer.id)
            .eq('exercise_id', params.exerciseId)
            .single()

        if (existing?.storage_path && existing.storage_path !== params.storagePath) {
            await supabase.storage.from('trainer-videos').remove([existing.storage_path])
        }

        const { error: upsertError } = await supabase
            .from('trainer_exercise_videos')
            .upsert({
                trainer_id: trainer.id,
                exercise_id: params.exerciseId,
                video_type: params.videoType,
                video_url: params.videoUrl,
                storage_path: params.storagePath || null,
                original_filename: params.originalFilename || null,
                file_size_bytes: params.fileSizeBytes || null,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'trainer_id,exercise_id',
            })

        if (upsertError) {
            console.error('[saveTrainerVideoMetadata] Upsert error:', upsertError)
            return { success: false, message: 'Erro ao salvar vídeo.' }
        }

        revalidatePath('/exercises')
        return {
            success: true,
            message: 'Vídeo salvo com sucesso.',
            data: { video_url: params.videoUrl, video_type: params.videoType },
        }
    } catch (error) {
        console.error('[saveTrainerVideoMetadata] Unexpected error:', error)
        return { success: false, message: 'Erro inesperado ao salvar vídeo.' }
    }
}

export async function deleteTrainerVideo(exerciseId: string): Promise<TrainerVideoResult> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { success: false, message: 'Sessão inválida.' }
        }

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) {
            return { success: false, message: 'Treinador não encontrado.' }
        }

        // Get storage path before deleting
        const { data: existing } = await supabase
            .from('trainer_exercise_videos')
            .select('storage_path')
            .eq('trainer_id', trainer.id)
            .eq('exercise_id', exerciseId)
            .single()

        if (existing?.storage_path) {
            await supabase.storage.from('trainer-videos').remove([existing.storage_path])
        }

        const { error: deleteError } = await supabase
            .from('trainer_exercise_videos')
            .delete()
            .eq('trainer_id', trainer.id)
            .eq('exercise_id', exerciseId)

        if (deleteError) {
            console.error('[deleteTrainerVideo] Delete error:', deleteError)
            return { success: false, message: 'Erro ao remover vídeo.' }
        }

        revalidatePath('/exercises')
        return { success: true, message: 'Vídeo removido.', data: null }
    } catch (error) {
        console.error('[deleteTrainerVideo] Unexpected error:', error)
        return { success: false, message: 'Erro inesperado ao remover vídeo.' }
    }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

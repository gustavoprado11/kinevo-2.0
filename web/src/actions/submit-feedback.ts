'use server'

import { createClient } from '@/lib/supabase/server'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
}
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const VALID_TYPES = ['bug', 'suggestion', 'other'] as const

export async function submitFeedback(formData: FormData): Promise<{ success: boolean; message: string }> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return { success: false, message: 'Sessão inválida. Faça login novamente.' }
        }

        const type = formData.get('type') as string
        const description = (formData.get('description') as string)?.trim()
        const pageUrl = formData.get('pageUrl') as string | null

        if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
            return { success: false, message: 'Selecione o tipo de feedback.' }
        }

        if (!description || description.length < 10) {
            return { success: false, message: 'Descreva com mais detalhes (mínimo 10 caracteres).' }
        }

        // Handle screenshot upload
        let screenshotUrl: string | null = null
        const file = formData.get('screenshot')

        if (file instanceof File && file.size > 0) {
            if (file.size > MAX_FILE_SIZE) {
                return { success: false, message: 'Imagem muito grande. Máximo 5MB.' }
            }

            const ext = file.name.split('.').pop()?.toLowerCase()
            if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
                return { success: false, message: 'Formato não suportado. Use JPG, PNG ou WebP.' }
            }

            // Never interpolate file.name directly into the storage path —
            // a client-supplied name like "../other-user/shell.jpg" can escape
            // the owner folder even though storage policies check the first
            // path segment. Use a server-generated random name + the validated
            // extension, so the stored path is always {auth_uid}/{ts}-{uuid}.{ext}.
            const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('feedback')
                .upload(filePath, file, {
                    upsert: false,
                    contentType: ALLOWED_CONTENT_TYPES[ext],
                })

            if (uploadError) {
                console.error('[submit-feedback] Upload error:', uploadError)
                return { success: false, message: 'Falha no upload da imagem.' }
            }

            const { data: publicData } = supabase.storage.from('feedback').getPublicUrl(filePath)
            screenshotUrl = publicData.publicUrl
        }

        // Insert feedback
        const { error: insertError } = await supabase
            .from('feedback')
            .insert({
                coach_id: user.id,
                type,
                description,
                screenshot_url: screenshotUrl,
                page_url: pageUrl || null,
            })

        if (insertError) {
            console.error('[submit-feedback] Insert error:', insertError)
            return { success: false, message: 'Erro ao enviar feedback. Tente novamente.' }
        }

        // Notify admin (non-blocking)
        const adminCoachId = process.env.ADMIN_COACH_ID
        if (adminCoachId) {
            const typeLabel = type === 'bug' ? 'Bug' : type === 'suggestion' ? 'Sugestão' : 'Outro'
            const preview = description.length > 100 ? description.slice(0, 100) + '...' : description
            const body = `[${typeLabel}] ${preview}`

            const notifId = await insertTrainerNotification({
                trainerId: adminCoachId,
                type: 'feedback',
                title: `Novo feedback: ${typeLabel}`,
                message: body,
                metadata: { feedback_type: type, page_url: pageUrl ?? '' },
            })

            await sendTrainerPush({
                trainerId: adminCoachId,
                type: 'feedback',
                title: `Novo feedback: ${typeLabel}`,
                body,
                notificationId: notifId ?? undefined,
            })
        }

        return { success: true, message: 'Feedback enviado com sucesso!' }
    } catch (error) {
        console.error('[submit-feedback] Unexpected error:', error)
        return { success: false, message: 'Erro inesperado. Tente novamente.' }
    }
}

'use server'

import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'

export async function createStudent(data: {
    name: string
    email: string
    phone: string
    modality: 'online' | 'presential'
}) {
    try {
        // 1. Verify caller is an authenticated trainer
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autorizado' }

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return { success: false, error: 'Treinador não encontrado' }

        // 2. Generate cryptographically secure password
        const generatedPassword = crypto.randomBytes(8).toString('base64url')

        // 3. Create auth user (requires service_role)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: generatedPassword,
            email_confirm: true,
            user_metadata: {
                name: data.name,
                phone: data.phone,
                role: 'student'
            }
        })

        if (authError) {
            console.error('Error creating auth user:', authError)
            return { success: false, error: authError.message }
        }

        const userId = authUser.user.id

        // 4. Insert student record (requires service_role)
        const { data: studentRow, error: dbError } = await supabaseAdmin
            .from('students')
            // @ts-ignore - Os tipos do projeto estão desatualizados em relação ao banco real
            .insert({
                auth_user_id: userId,
                coach_id: trainer.id,
                name: data.name.trim(),
                email: data.email.trim().toLowerCase(),
                phone: data.phone,
                modality: data.modality,
                status: 'active'
            })
            .select('id')
            .single()

        if (dbError) {
            console.error('Error creating student record:', dbError)
            await supabaseAdmin.auth.admin.deleteUser(userId)
            return { success: false, error: 'Erro ao salvar dados do aluno no banco de dados' }
        }

        revalidatePath('/students')

        // Notify trainer (fire-and-forget)
        insertTrainerNotification({
            trainerId: trainer.id,
            type: 'new_student',
            title: 'Novo aluno vinculado',
            message: `${data.name.trim()} foi adicionado à sua lista.`,
            metadata: {
                student_id: studentRow.id as string,
                student_name: data.name.trim(),
            },
        }).then((notifId) => {
            sendTrainerPush({
                trainerId: trainer.id,
                type: 'new_student',
                title: 'Novo aluno vinculado',
                body: `${data.name.trim()} foi adicionado à sua lista.`,
                notificationId: notifId ?? undefined,
                data: { type: 'new_student', student_id: studentRow.id as string },
            })
        })

        return {
            success: true,
            studentId: studentRow.id as string,
            email: data.email,
            password: generatedPassword,
            name: data.name,
            whatsapp: data.phone
        }

    } catch (error) {
        console.error('Unexpected error in createStudent:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao criar o aluno' }
    }
}

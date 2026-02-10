'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

export async function createStudent(data: {
    name: string
    email: string
    phone: string
    trainerId: string
    modality: 'online' | 'presential'
}) {
    try {
        // 1. Gerar senha aleatória de 6 dígitos
        const generatedPassword = Math.floor(100000 + Math.random() * 900000).toString()

        // 2. Criar usuário no Supabase Auth usando Admin
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

        // 3. Inserir na tabela 'students' vinculando ao userId
        // Corrigido para bater com a estrutura real do banco confirmada por print
        const { error: dbError } = await supabaseAdmin
            .from('students')
            // @ts-ignore - Os tipos do projeto estão desatualizados em relação ao banco real
            .insert({
                auth_user_id: userId,
                trainer_id: data.trainerId,
                name: data.name.trim(),
                email: data.email.trim().toLowerCase(),
                phone: data.phone,
                modality: data.modality,
                status: 'active'
            })

        if (dbError) {
            console.error('Error creating student record:', dbError)
            // Cleanup: Deletar usuário auth caso falhe o DB (opcional, mas recomendado)
            await supabaseAdmin.auth.admin.deleteUser(userId)
            return { success: false, error: 'Erro ao salvar dados do aluno no banco de dados' }
        }

        revalidatePath('/students')

        return {
            success: true,
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

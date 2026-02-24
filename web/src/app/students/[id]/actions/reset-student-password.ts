'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateSecureReadablePassword() {
    const min = 1000
    const max = 9999
    const randomNumbers = Math.floor(Math.random() * (max - min + 1)) + min
    return `Treino#${randomNumbers}`
}

export async function resetStudentPassword(studentId: string) {
    const supabase = await createClient()

    try {
        // 1. Verify caller identity
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Não autorizado.' }
        }

        // 2. Verify ownership (trainer owns the student)
        // First get the trainer's id from auth.user's id
        const { data: trainer, error: trainerError } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (trainerError || !trainer) {
            return { success: false, error: 'Perfil de treinador não encontrado.' }
        }

        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('auth_user_id, coach_id')
            .eq('id', studentId)
            .single()

        if (studentError || !student) {
            console.error('Error fetching student:', studentError)
            return { success: false, error: 'Aluno não encontrado.' }
        }

        if (student.coach_id !== trainer.id) {
            return { success: false, error: 'Acesso negado: Você não tem permissão para alterar este aluno.' }
        }

        if (!student.auth_user_id) {
            return { success: false, error: 'Aluno não possui conta de acesso associada.' }
        }

        // 3. Generate new password
        const newPassword = generateSecureReadablePassword()

        // 4. Force update using Admin API
        const supabaseAdmin = createAdminClient()
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(student.auth_user_id, {
            password: newPassword,
        })

        if (updateError) {
            console.error('Admin API error updating user block:', updateError)
            return { success: false, error: 'Falha ao redefinir a senha do aluno. Contate o suporte.' }
        }

        // 5. Return success and the new password
        return { success: true, newPassword }

    } catch (error) {
        console.error('Unexpected error resetting password:', error)
        return { success: false, error: 'Ocorreu um erro inesperado.' }
    }
}

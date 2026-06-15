'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createStudentCore } from './create-student-core'

export async function createStudent(data: {
    name: string
    email: string
    phone: string
    modality: 'online' | 'presential'
}) {
    // Verify caller is an authenticated trainer
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    const result = await createStudentCore(trainer.id, data)

    if (result.success) {
        revalidatePath('/students')
    }

    return result
}

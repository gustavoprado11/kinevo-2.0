'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function duplicateProgram(templateId: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return { success: false, error: 'Trainer not found' }

        // Cópia transacional no banco (migration 231): programa + treinos +
        // itens (com method_key/rounds) + séries por fase + filhos de superset
        // + check-ins. A versão N+1 antiga perdia prescrição avançada e
        // check-ins, e engolia erros parciais (R12, rodada 2).
        // Cast do nome até `npm run gen:types` incluir o RPC (mesma convenção
        // de create_assigned_program_tree / save_assigned_program_tree).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newId, error } = await (supabase.rpc as any)('duplicate_program_template', {
            p_trainer_id: trainer.id,
            p_template_id: templateId,
        })

        if (error || !newId) {
            console.error('Error duplicating program:', error)
            return { success: false, error: 'Failed to duplicate' }
        }

        revalidatePath('/programs')
        return { success: true, newId: newId as string }
    } catch (error) {
        console.error('Error duplicating program:', error)
        return { success: false, error: 'Failed to duplicate' }
    }
}

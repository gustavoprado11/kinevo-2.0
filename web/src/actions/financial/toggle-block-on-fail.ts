'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logContractEvent } from '@/lib/contract-events'
import { revalidatePath } from 'next/cache'

export async function toggleBlockOnFail(contractId: string, blockOnFail: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Não autorizado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { error: 'Treinador não encontrado' }
    }

    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, student_id, trainer_id')
        .eq('id', contractId)
        .single()

    if (!contract) {
        return { error: 'Contrato não encontrado' }
    }

    if (contract.trainer_id !== trainer.id) {
        return { error: 'Sem permissão' }
    }

    const { error: updateError } = await supabaseAdmin
        .from('student_contracts')
        .update({ block_on_fail: blockOnFail })
        .eq('id', contractId)

    if (updateError) {
        console.error('[toggle-block-on-fail] DB error:', updateError)
        return { error: 'Erro ao atualizar contrato' }
    }

    await logContractEvent({
        studentId: contract.student_id,
        trainerId: trainer.id,
        contractId,
        eventType: blockOnFail ? 'access_blocked' : 'access_unblocked',
    })

    revalidatePath('/financial/subscriptions')

    return { success: true }
}

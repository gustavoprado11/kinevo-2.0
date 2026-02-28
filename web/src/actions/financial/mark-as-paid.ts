'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

function addInterval(date: Date, interval: string): Date {
    const result = new Date(date)
    switch (interval) {
        case 'month':
            result.setMonth(result.getMonth() + 1)
            break
        case 'quarter':
            result.setMonth(result.getMonth() + 3)
            break
        case 'year':
            result.setFullYear(result.getFullYear() + 1)
            break
        default:
            result.setMonth(result.getMonth() + 1)
    }
    return result
}

export async function markAsPaid({ contractId }: { contractId: string }) {
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

    // Fetch contract and validate ownership
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*, trainer_plans:plan_id(interval)')
        .eq('id', contractId)
        .single()

    if (!contract) {
        return { error: 'Contrato não encontrado' }
    }

    if (contract.trainer_id !== trainer.id) {
        return { error: 'Sem permissão' }
    }

    // Calculate new period end
    const currentEnd = contract.current_period_end
        ? new Date(contract.current_period_end)
        : new Date()

    const planInterval = (contract.trainer_plans as { interval: string } | null)?.interval || 'month'
    const newPeriodEnd = addInterval(currentEnd, planInterval)

    // Update contract status
    const { error: updateError } = await supabaseAdmin
        .from('student_contracts')
        .update({
            status: 'active',
            current_period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', contractId)

    if (updateError) {
        console.error('[mark-as-paid] DB error:', updateError)
        return { error: 'Erro ao atualizar contrato' }
    }

    // Record transaction
    await supabaseAdmin
        .from('financial_transactions')
        .insert({
            coach_id: trainer.id,
            student_id: contract.student_id,
            amount_gross: contract.amount,
            amount_net: contract.amount,
            currency: 'brl',
            type: 'subscription',
            status: 'succeeded',
            stripe_payment_id: `manual_${contractId}_${Date.now()}`,
            description: 'Pagamento manual registrado',
        })

    // Update student plan status
    await supabaseAdmin
        .from('students')
        .update({ plan_status: 'active' })
        .eq('id', contract.student_id)

    revalidatePath('/financial')
    revalidatePath('/financial/subscriptions')
    revalidatePath('/dashboard')

    return { success: true }
}

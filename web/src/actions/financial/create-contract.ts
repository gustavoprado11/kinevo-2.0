'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

interface CreateContractInput {
    studentId: string
    planId: string | null
    billingType: 'manual_recurring' | 'manual_one_off' | 'courtesy'
    blockOnFail: boolean
}

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

export async function createContract(input: CreateContractInput) {
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

    // Validate student belongs to this trainer
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id, name')
        .eq('id', input.studentId)
        .single()

    if (!student) {
        return { error: 'Aluno não encontrado' }
    }

    if (student.coach_id !== trainer.id) {
        return { error: 'Este aluno não pertence a você' }
    }

    // Fetch plan details (optional for courtesy without plan)
    let plan: { id: string; title: string; price: number; interval: string; trainer_id: string } | null = null

    if (input.planId) {
        const { data: planData } = await supabaseAdmin
            .from('trainer_plans')
            .select('id, title, price, interval, trainer_id')
            .eq('id', input.planId)
            .single()

        if (!planData) {
            return { error: 'Plano não encontrado' }
        }

        if (planData.trainer_id !== trainer.id) {
            return { error: 'Este plano não pertence a você' }
        }

        plan = planData
    } else if (input.billingType !== 'courtesy') {
        return { error: 'Selecione um plano.' }
    }

    // Cancel any existing active contract for this student
    await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'canceled' })
        .eq('student_id', input.studentId)
        .eq('trainer_id', trainer.id)
        .in('status', ['active', 'past_due', 'pending'])

    const now = new Date()
    let contractData: Record<string, unknown>

    if (input.billingType === 'courtesy') {
        contractData = {
            student_id: input.studentId,
            trainer_id: trainer.id,
            plan_id: input.planId,
            amount: 0,
            status: 'active',
            billing_type: 'courtesy',
            block_on_fail: false,
            start_date: now.toISOString(),
            current_period_end: null,
        }
    } else if (input.billingType === 'manual_one_off') {
        const endDate = addInterval(now, plan!.interval || 'month')
        contractData = {
            student_id: input.studentId,
            trainer_id: trainer.id,
            plan_id: input.planId,
            amount: plan!.price,
            status: 'active',
            billing_type: 'manual_one_off',
            block_on_fail: input.blockOnFail,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            current_period_end: endDate.toISOString(),
        }
    } else {
        // manual_recurring
        const periodEnd = addInterval(now, plan!.interval || 'month')
        contractData = {
            student_id: input.studentId,
            trainer_id: trainer.id,
            plan_id: input.planId,
            amount: plan!.price,
            status: 'active',
            billing_type: 'manual_recurring',
            block_on_fail: input.blockOnFail,
            start_date: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        }
    }

    const { error: insertError } = await supabaseAdmin
        .from('student_contracts')
        .insert(contractData)

    if (insertError) {
        console.error('[create-contract] DB error:', insertError)
        return { error: 'Erro ao criar contrato' }
    }

    // Update student plan_status
    await supabaseAdmin
        .from('students')
        .update({
            plan_status: 'active',
            pending_plan_id: null,
            current_plan_name: plan?.title ?? 'Acesso Gratuito',
        })
        .eq('id', input.studentId)

    revalidatePath('/financial')
    revalidatePath('/financial/subscriptions')

    return { success: true }
}

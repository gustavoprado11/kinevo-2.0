import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logContractEvent } from '@/lib/contract-events'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    let body: { contractId?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { contractId } = body
    if (!contractId) {
        return NextResponse.json({ error: 'contractId é obrigatório' }, { status: 400 })
    }
    if (!UUID_RE.test(contractId)) {
        return NextResponse.json({ error: 'Formato de ID inválido' }, { status: 400 })
    }

    // Get trainer
    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    // Rate limit: 10/min, 50/day per trainer
    const rl = checkRateLimit(`financial:mark-paid:${trainer.id}`, { perMinute: 10, perDay: 50 })
    if (!rl.allowed) {
        return NextResponse.json({ error: rl.error }, { status: 429 })
    }
    recordRequest(`financial:mark-paid:${trainer.id}`)

    // Fetch contract with plan interval
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*, trainer_plans:plan_id(interval)')
        .eq('id', contractId)
        .single()

    if (!contract) {
        return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contract.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    try {
        if (contract.billing_type === 'manual_one_off') {
            // One-off: mark active, no period renewal
            const { error: updateError } = await supabaseAdmin
                .from('student_contracts')
                .update({ status: 'active' })
                .eq('id', contractId)

            if (updateError) {
                return NextResponse.json({ error: 'Erro ao atualizar contrato' }, { status: 500 })
            }

            await supabaseAdmin.from('financial_transactions').insert({
                coach_id: trainer.id,
                student_id: contract.student_id,
                amount_gross: contract.amount,
                amount_net: contract.amount,
                currency: 'brl',
                type: 'subscription',
                status: 'succeeded',
                stripe_payment_id: `manual_${crypto.randomUUID()}`,
                description: 'Pagamento avulso registrado',
            })

            await logContractEvent({
                studentId: contract.student_id,
                trainerId: trainer.id,
                contractId,
                eventType: 'payment_received',
                metadata: { amount: contract.amount, method: 'manual', billing_type: 'manual_one_off' },
            })

            await supabaseAdmin
                .from('students')
                .update({ plan_status: 'active' })
                .eq('id', contract.student_id)

            return NextResponse.json({ success: true })
        }

        // manual_recurring: renew period from previous due date
        const currentEnd = contract.current_period_end
            ? new Date(contract.current_period_end)
            : new Date()

        const planInterval = (contract.trainer_plans as { interval: string } | null)?.interval || 'month'
        const newPeriodEnd = addInterval(currentEnd, planInterval)

        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'active',
                current_period_end: newPeriodEnd.toISOString(),
            })
            .eq('id', contractId)

        if (updateError) {
            return NextResponse.json({ error: 'Erro ao atualizar contrato' }, { status: 500 })
        }

        await supabaseAdmin.from('financial_transactions').insert({
            coach_id: trainer.id,
            student_id: contract.student_id,
            amount_gross: contract.amount,
            amount_net: contract.amount,
            currency: 'brl',
            type: 'subscription',
            status: 'succeeded',
            stripe_payment_id: `manual_${crypto.randomUUID()}`,
            description: 'Pagamento manual registrado',
        })

        await logContractEvent({
            studentId: contract.student_id,
            trainerId: trainer.id,
            contractId,
            eventType: 'payment_received',
            metadata: { amount: contract.amount, method: 'manual', billing_type: 'manual_recurring' },
        })

        await supabaseAdmin
            .from('students')
            .update({ plan_status: 'active' })
            .eq('id', contract.student_id)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[mark-paid] Error:', err)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { logContractEvent } from '@/lib/contract-events'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    let body: { contractId?: string; cancelAtPeriodEnd?: boolean }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { contractId, cancelAtPeriodEnd } = body
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

    // Rate limit: 5/min, 20/day per trainer
    const rl = checkRateLimit(`financial:cancel:${trainer.id}`, { perMinute: 5, perDay: 20 })
    if (!rl.allowed) {
        return NextResponse.json({ error: rl.error }, { status: 429 })
    }
    recordRequest(`financial:cancel:${trainer.id}`)

    // Fetch contract
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*')
        .eq('id', contractId)
        .single()

    if (!contract) {
        return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contract.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    try {
        // Stripe subscription: cancel via Stripe API
        if (contract.billing_type === 'stripe_auto' && contract.stripe_subscription_id) {
            const { data: settings } = await supabaseAdmin
                .from('payment_settings')
                .select('stripe_connect_id')
                .eq('user_id', trainer.id)
                .single()

            if (settings?.stripe_connect_id) {
                if (cancelAtPeriodEnd) {
                    // Schedule cancellation at period end
                    await stripe.subscriptions.update(
                        contract.stripe_subscription_id,
                        { cancel_at_period_end: true },
                        { stripeAccount: settings.stripe_connect_id }
                    )

                    await supabaseAdmin
                        .from('student_contracts')
                        .update({
                            cancel_at_period_end: true,
                            canceled_by: 'trainer',
                            canceled_at: new Date().toISOString(),
                        })
                        .eq('id', contractId)

                    await logContractEvent({
                        studentId: contract.student_id,
                        trainerId: trainer.id,
                        contractId,
                        eventType: 'contract_canceled',
                        metadata: { canceled_by: 'trainer', scheduled: true },
                    })

                    return NextResponse.json({ success: true, scheduledCancellation: true })
                } else {
                    // Immediate cancellation via Stripe
                    await stripe.subscriptions.cancel(
                        contract.stripe_subscription_id,
                        { stripeAccount: settings.stripe_connect_id }
                    )
                }
            }
        }

        // Immediate cancel: update DB
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({
                status: 'canceled',
                cancel_at_period_end: false,
                canceled_by: 'trainer',
                canceled_at: new Date().toISOString(),
            })
            .eq('id', contractId)

        if (updateError) {
            return NextResponse.json({ error: 'Erro ao cancelar contrato' }, { status: 500 })
        }

        await logContractEvent({
            studentId: contract.student_id,
            trainerId: trainer.id,
            contractId,
            eventType: 'contract_canceled',
            metadata: { canceled_by: 'trainer' },
        })

        await supabaseAdmin
            .from('students')
            .update({
                plan_status: 'canceled',
                current_plan_name: null,
            })
            .eq('id', contract.student_id)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[cancel-contract] Error:', err)
        return NextResponse.json({ error: 'Erro ao cancelar contrato' }, { status: 500 })
    }
}

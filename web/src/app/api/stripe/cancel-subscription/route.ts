import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/cancel-subscription
 * Called by the mobile app to schedule a subscription cancellation.
 * Auth: Bearer token (Supabase access token from mobile session).
 */
export async function POST(request: NextRequest) {
    // --- Auth via Bearer token (mobile) ---
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // --- Parse body ---
    let body: { contract_id?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { contract_id } = body
    if (!contract_id) {
        return NextResponse.json({ error: 'contract_id é obrigatório' }, { status: 400 })
    }

    // --- Get the student profile for this auth user ---
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()

    if (!student) {
        return NextResponse.json({ error: 'Perfil de aluno não encontrado' }, { status: 404 })
    }

    // --- Fetch contract and validate ownership ---
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('*, plan:trainer_plans!plan_id(title)')
        .eq('id', contract_id)
        .single()

    if (!contract) {
        return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
    }

    if (contract.student_id !== student.id) {
        return NextResponse.json({ error: 'Sem permissão para este contrato' }, { status: 403 })
    }

    if (contract.billing_type !== 'stripe_auto') {
        return NextResponse.json({ error: 'Apenas assinaturas automáticas podem ser canceladas por aqui' }, { status: 400 })
    }

    if (contract.cancel_at_period_end) {
        return NextResponse.json({ error: 'Esta assinatura já está com cancelamento programado' }, { status: 400 })
    }

    if (contract.status !== 'active') {
        return NextResponse.json({ error: 'Apenas assinaturas ativas podem ser canceladas' }, { status: 400 })
    }

    if (!contract.stripe_subscription_id) {
        return NextResponse.json({ error: 'Assinatura Stripe não encontrada no contrato' }, { status: 400 })
    }

    // --- Get trainer's Stripe Connect ID ---
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id')
        .eq('user_id', contract.trainer_id)
        .single()

    if (!settings?.stripe_connect_id) {
        return NextResponse.json({ error: 'Conta Stripe do treinador não encontrada' }, { status: 400 })
    }

    try {
        // --- Call Stripe: schedule cancellation at period end ---
        await stripe.subscriptions.update(
            contract.stripe_subscription_id,
            { cancel_at_period_end: true },
            { stripeAccount: settings.stripe_connect_id }
        )

        // --- Update contract in DB ---
        const { error: updateError } = await supabaseAdmin
            .from('student_contracts')
            .update({ cancel_at_period_end: true })
            .eq('id', contract_id)

        if (updateError) {
            console.error('[cancel-subscription] DB update error:', updateError)
            return NextResponse.json({ error: 'Erro ao atualizar contrato' }, { status: 500 })
        }

        // --- Notify the trainer ---
        const planTitle = (contract as any).plan?.title || 'Plano'
        const periodEnd = contract.current_period_end
            ? new Date(contract.current_period_end).toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            })
            : 'fim do ciclo atual'

        await supabaseAdmin
            .from('trainer_notifications')
            .insert({
                trainer_id: contract.trainer_id,
                type: 'subscription_canceled',
                title: 'Assinatura cancelada',
                message: `O aluno ${student.name} cancelou a assinatura "${planTitle}". O acesso permanecerá ativo até ${periodEnd}.`,
                metadata: {
                    contract_id: contract.id,
                    student_id: student.id,
                    student_name: student.name,
                    plan_title: planTitle,
                    period_end: contract.current_period_end,
                },
            })

        return NextResponse.json({
            success: true,
            current_period_end: contract.current_period_end,
        })
    } catch (err) {
        console.error('[cancel-subscription] Stripe error:', err)
        return NextResponse.json({ error: 'Erro ao cancelar assinatura na Stripe' }, { status: 500 })
    }
}

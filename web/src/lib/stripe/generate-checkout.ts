import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logContractEvent } from '@/lib/contract-events'

interface GenerateCheckoutParams {
    studentId: string
    planId: string
    trainerId: string
    stripeConnectId: string
}

interface GenerateCheckoutResult {
    url: string
    contractId?: string
}

/**
 * Core Stripe Checkout Session generation logic.
 * Used by both `generateCheckoutLink` (server action) and `migrateContract`.
 * NOT a server action — this is an internal function.
 */
export async function generateCheckoutCore({
    studentId,
    planId,
    trainerId,
    stripeConnectId,
}: GenerateCheckoutParams): Promise<GenerateCheckoutResult> {
    // Fetch student
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, name, email, stripe_customer_id')
        .eq('id', studentId)
        .single()

    if (!student) {
        throw new Error('Aluno não encontrado')
    }

    // Fetch plan
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, title, price, stripe_price_id')
        .eq('id', planId)
        .single()

    if (!plan) {
        throw new Error('Plano não encontrado')
    }

    if (!plan.stripe_price_id) {
        throw new Error('Este plano não tem preço configurado no Stripe. Recrie o plano com o Stripe conectado.')
    }

    // Find or create Stripe Customer on the connected account
    let stripeCustomerId = student.stripe_customer_id

    if (!stripeCustomerId) {
        const customer = await stripe.customers.create(
            {
                email: student.email,
                name: student.name,
                metadata: {
                    student_id: student.id,
                    trainer_id: trainerId,
                },
            },
            { stripeAccount: stripeConnectId }
        )
        stripeCustomerId = customer.id

        await supabaseAdmin
            .from('students')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', studentId)
    }

    // Create Checkout Session on the connected account
    const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create(
        {
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: plan.stripe_price_id,
                quantity: 1,
            }],
            subscription_data: {
                metadata: {
                    trainer_id: trainerId,
                    student_id: studentId,
                    plan_id: planId,
                },
            },
            metadata: {
                trainer_id: trainerId,
                student_id: studentId,
                plan_id: planId,
            },
            success_url: `${origin}/financial/subscriptions?checkout=success`,
            cancel_url: `${origin}/financial/subscriptions?checkout=canceled`,
        },
        { stripeAccount: stripeConnectId }
    )

    // Update student pending plan
    await supabaseAdmin
        .from('students')
        .update({
            pending_plan_id: planId,
            plan_status: 'pending',
        })
        .eq('id', studentId)

    // Insert or update the pending contract
    const { data: existingContract } = await supabaseAdmin
        .from('student_contracts')
        .select('id')
        .eq('student_id', studentId)
        .eq('plan_id', planId)
        .eq('status', 'pending')
        .single()

    let contractId: string | undefined

    if (existingContract) {
        await supabaseAdmin
            .from('student_contracts')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', existingContract.id)
        contractId = existingContract.id
    } else {
        const { data: newContract, error: insertError } = await supabaseAdmin
            .from('student_contracts')
            .insert({
                student_id: studentId,
                trainer_id: trainerId,
                plan_id: planId,
                amount: plan.price,
                status: 'pending',
                billing_type: 'stripe_auto',
                block_on_fail: true,
                stripe_customer_id: stripeCustomerId,
            })
            .select('id')
            .single()

        if (insertError) {
            console.error('[generate-checkout] DB error creating pending contract:', insertError)
            throw new Error('Erro no banco de dados ao salvar a assinatura.')
        }

        contractId = newContract?.id

        await logContractEvent({
            studentId,
            trainerId,
            contractId: contractId ?? null,
            eventType: 'contract_created',
            metadata: {
                billing_type: 'stripe_auto',
                amount: plan.price,
                plan_title: plan.title,
                status: 'pending',
            },
        })
    }

    return { url: session.url!, contractId }
}

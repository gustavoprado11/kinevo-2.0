'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'

export async function generateCheckoutLink({ studentId, planId }: { studentId: string; planId: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Não autorizado' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, email')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return { error: 'Treinador não encontrado' }
    }

    // Check Stripe Connect
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id || !settings.charges_enabled) {
        return { error: 'Conta Stripe não conectada ou não ativa' }
    }

    // Validate student belongs to trainer
    const { data: student, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, coach_id, name, email, stripe_customer_id')
        .eq('id', studentId)
        .single()

    if (studentError) {
        console.error('[generate-checkout-link] Erro ao buscar aluno:', studentError)
    }

    if (!student || student.coach_id !== trainer.id) {
        return { error: 'Aluno não encontrado' }
    }

    // Validate plan belongs to trainer and has Stripe price
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, title, trainer_id, stripe_price_id, stripe_product_id, price')
        .eq('id', planId)
        .single()

    if (!plan || plan.trainer_id !== trainer.id) {
        return { error: 'Plano não encontrado' }
    }

    if (!plan.stripe_price_id) {
        return { error: 'Este plano não tem preço configurado no Stripe. Recrie o plano com o Stripe conectado.' }
    }

    try {
        // Find or create Stripe Customer on the connected account
        let stripeCustomerId = student.stripe_customer_id

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create(
                {
                    email: student.email,
                    name: student.name,
                    metadata: {
                        student_id: student.id,
                        trainer_id: trainer.id,
                    },
                },
                { stripeAccount: settings.stripe_connect_id }
            )
            stripeCustomerId = customer.id

            // Save customer ID to student record
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
                        trainer_id: trainer.id,
                        student_id: studentId,
                        plan_id: planId,
                    },
                },
                metadata: {
                    trainer_id: trainer.id,
                    student_id: studentId,
                    plan_id: planId,
                },
                success_url: `${origin}/financial/subscriptions?checkout=success`,
                cancel_url: `${origin}/financial/subscriptions?checkout=canceled`,
            },
            { stripeAccount: settings.stripe_connect_id }
        )

        // Update student pending plan
        await supabaseAdmin
            .from('students')
            .update({
                pending_plan_id: planId,
                plan_status: 'pending',
            })
            .eq('id', studentId)

        // Insert or Update the pending contract
        const { data: existingContract } = await supabaseAdmin
            .from('student_contracts')
            .select('id')
            .eq('student_id', studentId)
            .eq('plan_id', planId)
            .eq('status', 'pending')
            .single()

        if (existingContract) {
            await supabaseAdmin
                .from('student_contracts')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', existingContract.id)
        } else {
            const { error: insertError } = await supabaseAdmin
                .from('student_contracts')
                .insert({
                    student_id: studentId,
                    trainer_id: trainer.id,
                    plan_id: planId,
                    amount: plan.price,
                    status: 'pending',
                    billing_type: 'stripe_auto',
                    block_on_fail: true,
                    stripe_customer_id: stripeCustomerId,
                })

            if (insertError) {
                console.error('[generate-checkout-link] Erro ao criar contrato pendente:', insertError)
            }
        }

        return { success: true, url: session.url }
    } catch (err) {
        console.error('[generate-checkout-link] Error:', err)
        return { error: 'Erro ao gerar link de pagamento' }
    }
}

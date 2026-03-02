'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateCheckoutCore } from '@/lib/stripe/generate-checkout'
import { revalidatePath } from 'next/cache'

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
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id')
        .eq('id', studentId)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return { error: 'Aluno não encontrado' }
    }

    // Validate plan belongs to trainer
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, trainer_id')
        .eq('id', planId)
        .single()

    if (!plan || plan.trainer_id !== trainer.id) {
        return { error: 'Plano não encontrado' }
    }

    try {
        const result = await generateCheckoutCore({
            studentId,
            planId,
            trainerId: trainer.id,
            stripeConnectId: settings.stripe_connect_id,
        })

        revalidatePath('/financial/subscriptions')
        return { success: true, url: result.url }
    } catch (err) {
        console.error('[generate-checkout-link] Error:', err)
        return { error: err instanceof Error ? err.message : 'Erro ao gerar link de pagamento' }
    }
}

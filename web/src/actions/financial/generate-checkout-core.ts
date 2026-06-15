/**
 * Financeiro — núcleo de geração de link de checkout (server-only, SEM 'use server').
 *
 * generateCheckoutLinkCore recebe um client Supabase + o trainerId já resolvido,
 * valida Stripe Connect + ownership do aluno e do plano e delega para
 * generateCheckoutCore (Stripe). A action ('use server') vira wrapper de auth; a
 * tool MCP chama o core direto com o admin client + trainerId do token OAuth.
 * Mesma lógica nos dois caminhos, sem duplicação.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { generateCheckoutCore } from '@/lib/stripe/generate-checkout'

type DBClient = SupabaseClient<Database>

export interface GenerateCheckoutLinkInput {
    studentId: string
    planId: string
}

export interface GenerateCheckoutLinkResult {
    success: boolean
    error?: string
    url?: string
}

export async function generateCheckoutLinkCore(
    supabase: DBClient,
    trainerId: string,
    input: GenerateCheckoutLinkInput,
): Promise<GenerateCheckoutLinkResult> {
    const { studentId, planId } = input

    if (!studentId || !planId) {
        return { success: false, error: 'studentId e planId são obrigatórios' }
    }

    // Stripe Connect precisa estar conectado e ativo
    const { data: settings } = await supabase
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainerId)
        .single()

    if (!settings?.stripe_connect_id || !settings.charges_enabled) {
        return { success: false, error: 'Conta Stripe não conectada ou não ativa' }
    }

    // Aluno pertence ao treinador
    const { data: student } = await supabase
        .from('students')
        .select('id, coach_id')
        .eq('id', studentId)
        .single()

    if (!student || student.coach_id !== trainerId) {
        return { success: false, error: 'Aluno não encontrado' }
    }

    // Plano pertence ao treinador
    const { data: plan } = await supabase
        .from('trainer_plans')
        .select('id, trainer_id')
        .eq('id', planId)
        .single()

    if (!plan || plan.trainer_id !== trainerId) {
        return { success: false, error: 'Plano não encontrado' }
    }

    try {
        const result = await generateCheckoutCore({
            studentId,
            planId,
            trainerId,
            stripeConnectId: settings.stripe_connect_id,
        })
        return { success: true, url: result.url }
    } catch (err) {
        console.error('[generateCheckoutLinkCore] Error:', err)
        return { success: false, error: err instanceof Error ? err.message : 'Erro ao gerar link de pagamento' }
    }
}

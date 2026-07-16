import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Billing portal do ESTÚDIO (gerenciar assinatura da org). Espelha o portal
 * solo, mas o customer vem de organizations.stripe_customer_id e só o gestor
 * abre. Volta para /estudio/plano.
 */
export async function POST(request: NextRequest) {
    const ctx = await getOrganizationContext()
    if (!ctx) return NextResponse.json({ error: 'Você não pertence a um estúdio' }, { status: 404 })
    if (!ctx.isManager) return NextResponse.json({ error: 'Apenas o gestor pode gerenciar a assinatura' }, { status: 403 })

    const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', ctx.organization.id)
        .single()

    const customerId = (org as { stripe_customer_id: string | null } | null)?.stripe_customer_id
    if (!customerId) {
        return NextResponse.json({ error: 'Estúdio sem assinatura' }, { status: 404 })
    }

    // Configuração dedicada do estúdio (troca entre as 3 faixas + cancelamento).
    // Sem ela, o portal cai na config default (que não troca de plano).
    const configuration = process.env.STRIPE_STUDIO_PORTAL_CONFIG || undefined
    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        ...(configuration ? { configuration } : {}),
        return_url: `${request.nextUrl.origin}/estudio/plano`,
    })

    return NextResponse.json({ url: portalSession.url })
}

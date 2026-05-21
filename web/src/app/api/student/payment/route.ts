// ============================================================================
// GET /api/student/payment
// ============================================================================
// Retorna a cobrança pendente do ALUNO logado (Bearer) + a URL viva do
// checkout Asaas (Payment Link) pra ele pagar in-app via WebView.
//
// Por que WebView e não QR PIX nativo: usamos Payment Link (sem coletar CPF
// do aluno). O QR PIX só é gerado no checkout hospedado da Asaas, onde o aluno
// preenche o próprio CPF. Então o pagamento in-app é o checkout Asaas em WebView
// (cobre PIX, cartão e boleto).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError, getPaymentLink } from '@/lib/asaas'
import { getDecryptedApiKey } from '@/lib/asaas/wallet-service'

export async function GET(request: NextRequest) {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }
    const token = auth.slice(7).trim()
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Aluno logado
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
    if (!student) {
        return NextResponse.json({ hasPending: false })
    }

    // Cobrança pendente mais recente (avulsa ou recorrente) com Payment Link
    const { data: contract } = await supabaseAdmin
        .from('student_contracts')
        .select('id, trainer_id, amount, status, asaas_payment_link_id, plan_id, billing_type')
        .eq('student_id', student.id)
        .in('status', ['pending_payment', 'past_due'])
        .not('asaas_payment_link_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (!contract) {
        return NextResponse.json({ hasPending: false })
    }

    // Título do plano (pra UI)
    let planTitle: string | null = null
    if (contract.plan_id) {
        const { data: plan } = await supabaseAdmin
            .from('trainer_plans')
            .select('title')
            .eq('id', contract.plan_id)
            .maybeSingle()
        planTitle = plan?.title ?? null
    }

    // URL viva do checkout (via chave da subconta do trainer dono do link)
    let invoiceUrl: string | null = null
    try {
        const apiKey = await getDecryptedApiKey(contract.trainer_id)
        const link = await getPaymentLink(apiKey, contract.asaas_payment_link_id as string)
        invoiceUrl = link.url ?? null
    } catch (err) {
        if (!(err instanceof AsaasApiError && err.status === 404)) {
            console.error('[student/payment] getPaymentLink failed', err)
        }
    }

    return NextResponse.json({
        hasPending: true,
        contractId: contract.id,
        amount: Number(contract.amount ?? 0),
        status: contract.status,
        planTitle,
        billingType: contract.billing_type,
        invoiceUrl,
    })
}

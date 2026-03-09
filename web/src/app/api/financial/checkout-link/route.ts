import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateCheckoutCore } from '@/lib/stripe/generate-checkout'

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

    let body: { studentId?: string; planId?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const { studentId, planId } = body
    if (!studentId || !planId) {
        return NextResponse.json({ error: 'studentId e planId são obrigatórios' }, { status: 400 })
    }
    if (!UUID_RE.test(studentId) || !UUID_RE.test(planId)) {
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

    // Validate Stripe Connect
    const { data: settings } = await supabaseAdmin
        .from('payment_settings')
        .select('stripe_connect_id, charges_enabled')
        .eq('user_id', trainer.id)
        .single()

    if (!settings?.stripe_connect_id || !settings.charges_enabled) {
        return NextResponse.json({ error: 'Conta Stripe não conectada ou não ativa' }, { status: 400 })
    }

    // Validate student ownership
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id')
        .eq('id', studentId)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // Validate plan ownership
    const { data: plan } = await supabaseAdmin
        .from('trainer_plans')
        .select('id, trainer_id')
        .eq('id', planId)
        .single()

    if (!plan || plan.trainer_id !== trainer.id) {
        return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
    }

    try {
        const result = await generateCheckoutCore({
            studentId,
            planId,
            trainerId: trainer.id,
            stripeConnectId: settings.stripe_connect_id,
        })

        return NextResponse.json({ success: true, url: result.url })
    } catch (err) {
        console.error('[checkout-link] Error:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Erro ao gerar link' },
            { status: 500 }
        )
    }
}

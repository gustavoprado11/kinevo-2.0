import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logContractEvent } from '@/lib/contract-events'
import { checkRateLimit, recordRequest } from '@/lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_BILLING_TYPES = new Set(['subscription','one_time','installments','courtesy'])

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

    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    // Rate limit per trainer. Contract creation cascades into contract_events,
    // updates on students, and potentially external Stripe calls — capping
    // prevents floods of junk rows while still allowing bulk onboarding.
    const rateLimitKey = `financial:create-contract:${trainer.id}`
    const limit = checkRateLimit(rateLimitKey, { perMinute: 10, perDay: 200 })
    if (!limit.allowed) {
        return NextResponse.json({ error: limit.error || 'Rate limit exceeded' }, { status: 429 })
    }
    recordRequest(rateLimitKey)

    const body = await request.json()
    const { studentId, planId, billingType, blockOnFail = false } = body

    if (!studentId || !billingType) {
        return NextResponse.json({ error: 'Campos obrigatórios: studentId, billingType' }, { status: 400 })
    }

    if (!UUID_RE.test(studentId)) {
        return NextResponse.json({ error: 'studentId inválido' }, { status: 400 })
    }
    if (planId != null && (typeof planId !== 'string' || !UUID_RE.test(planId))) {
        return NextResponse.json({ error: 'planId inválido' }, { status: 400 })
    }
    if (!VALID_BILLING_TYPES.has(billingType)) {
        return NextResponse.json({ error: 'billingType inválido' }, { status: 400 })
    }

    // Validate student belongs to trainer
    const { data: student } = await supabaseAdmin
        .from('students')
        .select('id, coach_id, name')
        .eq('id', studentId)
        .single()

    if (!student || student.coach_id !== trainer.id) {
        return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    // Fetch plan if provided
    let plan: { id: string; title: string; price: number; interval: string } | null = null
    if (planId) {
        const { data: planData } = await supabaseAdmin
            .from('trainer_plans')
            .select('id, title, price, interval, trainer_id')
            .eq('id', planId)
            .single()

        if (!planData || planData.trainer_id !== trainer.id) {
            return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
        }
        plan = planData
    } else if (billingType !== 'courtesy') {
        return NextResponse.json({ error: 'Selecione um plano' }, { status: 400 })
    }

    // Cancel existing active contracts
    await supabaseAdmin
        .from('student_contracts')
        .update({ status: 'canceled' })
        .eq('student_id', studentId)
        .eq('trainer_id', trainer.id)
        .in('status', ['active', 'past_due', 'pending'])

    const now = new Date()
    let contractData: Record<string, unknown>

    if (billingType === 'courtesy') {
        contractData = {
            student_id: studentId,
            trainer_id: trainer.id,
            plan_id: planId || null,
            amount: 0,
            status: 'active',
            billing_type: 'courtesy',
            block_on_fail: false,
            start_date: now.toISOString(),
            current_period_end: null,
        }
    } else if (billingType === 'manual_one_off') {
        const endDate = addInterval(now, plan!.interval || 'month')
        contractData = {
            student_id: studentId,
            trainer_id: trainer.id,
            plan_id: planId,
            amount: plan!.price,
            status: 'active',
            billing_type: 'manual_one_off',
            block_on_fail: blockOnFail,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            current_period_end: endDate.toISOString(),
        }
    } else {
        // manual_recurring
        const periodEnd = addInterval(now, plan!.interval || 'month')
        contractData = {
            student_id: studentId,
            trainer_id: trainer.id,
            plan_id: planId,
            amount: plan!.price,
            status: 'active',
            billing_type: 'manual_recurring',
            block_on_fail: blockOnFail,
            start_date: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        }
    }

    const { data: newContract, error: insertError } = await supabaseAdmin
        .from('student_contracts')
        .insert(contractData)
        .select('id')
        .single()

    if (insertError || !newContract) {
        console.error('[api/create-contract] DB error:', insertError)
        return NextResponse.json({ error: 'Erro ao criar contrato' }, { status: 500 })
    }

    await logContractEvent({
        studentId,
        trainerId: trainer.id,
        contractId: newContract.id,
        eventType: 'contract_created',
        metadata: {
            billing_type: billingType,
            amount: plan?.price ?? 0,
            plan_title: plan?.title ?? 'Acesso Gratuito',
        },
    })

    // Update student plan_status
    await supabaseAdmin
        .from('students')
        .update({
            plan_status: 'active',
            pending_plan_id: null,
            current_plan_name: plan?.title ?? 'Acesso Gratuito',
        })
        .eq('id', studentId)

    return NextResponse.json({ success: true, contractId: newContract.id })
}

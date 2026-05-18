// ============================================================================
// POST /api/wallet/charges
// ============================================================================
// Creates a charge inside the trainer's Asaas subaccount. Returns the public
// invoiceUrl for the student to pay (PIX QR code + Cartão).
//
// Expected JSON:
// {
//   "studentId": "<uuid>",        // Kinevo student (must belong to trainer)
//   "planId": "<uuid>",           // optional — link to trainer_plan
//   "value": 250.00,              // BRL
//   "dueDate": "2026-05-15",      // YYYY-MM-DD
//   "billingType": "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO",
//   "description": "Consultoria Maio"
// }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    AsaasApiError,
    createPayment,
    describeChargeForStudent,
    findOrCreateCustomer,
    getKinevoWalletId,
    type AsaasBillingType,
    type AsaasSplit,
} from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

interface ChargeBody {
    studentId?: string
    planId?: string | null
    value?: number
    dueDate?: string
    billingType?: AsaasBillingType
    description?: string
}

function validate(body: ChargeBody): string | null {
    if (!body.studentId) return 'studentId é obrigatório'
    if (typeof body.value !== 'number' || body.value <= 0) return 'value deve ser número positivo'
    if (!body.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
        return 'dueDate deve estar no formato AAAA-MM-DD'
    }
    const allowed: AsaasBillingType[] = ['UNDEFINED', 'PIX', 'CREDIT_CARD', 'BOLETO']
    if (body.billingType && !allowed.includes(body.billingType)) {
        return 'billingType inválido'
    }
    return null
}

export async function POST(request: NextRequest) {
    let body: ChargeBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const validationError = validate(body)
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        // 1. Confirm the student belongs to this trainer
        const { data: student, error: studentErr } = await supabaseAdmin
            .from('students')
            .select('id, name, email, cpf, mobile_phone, coach_id')
            .eq('id', body.studentId!)
            .single()
        if (studentErr || !student) {
            return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
        }
        if (student.coach_id !== trainer.id) {
            return NextResponse.json({ error: 'Aluno não pertence a você' }, { status: 403 })
        }

        // 2. Get trainer's Asaas apiKey
        const apiKey = await getDecryptedApiKey(trainer.id)

        // 3. Find or create Asaas customer for this student (within subaccount)
        const customer = await findOrCreateCustomer(apiKey, {
            name: student.name ?? 'Aluno',
            email: student.email ?? undefined,
            cpfCnpj: student.cpf ?? undefined,
            mobilePhone: student.mobile_phone ?? undefined,
            externalReference: student.id,
        })

        // 4. Optionally apply Kinevo take rate via split
        const kinevoWalletId = getKinevoWalletId()
        const takeRatePct = Number(process.env.KINEVO_TAKE_RATE_PCT ?? '0')
        const split: AsaasSplit[] | undefined =
            kinevoWalletId && takeRatePct > 0
                ? [{ walletId: kinevoWalletId, percentualValue: takeRatePct }]
                : undefined

        // 5. Look up plan title if planId provided (for description)
        let planTitle: string | undefined
        if (body.planId) {
            const { data: plan } = await supabaseAdmin
                .from('trainer_plans')
                .select('title')
                .eq('id', body.planId)
                .eq('trainer_id', trainer.id)
                .maybeSingle()
            planTitle = plan?.title ?? undefined
        }

        const description = body.description ?? describeChargeForStudent({
            studentName: student.name ?? 'Aluno',
            planTitle: planTitle ?? 'Consultoria',
        })

        // 6. Create the charge
        const payment = await createPayment(apiKey, {
            customer: customer.id,
            billingType: body.billingType ?? 'UNDEFINED',
            value: body.value!,
            dueDate: body.dueDate!,
            description,
            externalReference: body.planId ?? student.id,
            split,
        })

        // 7. Persist a placeholder financial_transactions row (status pending).
        // The webhook will update it on PAYMENT_RECEIVED.
        const { error: txErr } = await supabaseAdmin.from('financial_transactions').insert({
            coach_id: trainer.id,
            student_id: student.id,
            provider: 'asaas',
            asaas_payment_id: payment.id,
            amount_gross: body.value!,
            amount_net: body.value!,         // updated on webhook
            currency: 'brl',
            type: 'charge',
            status: 'pending',
            description,
        })
        if (txErr) {
            console.error('[wallet/charges] Failed to persist transaction', txErr)
        }

        // 8. Cria contrato one-off com status=pending_payment (trainer vê quem ainda
        //    não pagou). Webhook PAYMENT_RECEIVED vai mover pra 'active'.
        let contractId: string | null = null
        if (body.planId) {
            const { data: contract, error: cErr } = await supabaseAdmin
                .from('student_contracts')
                .insert({
                    student_id: student.id,
                    trainer_id: trainer.id,
                    plan_id: body.planId,
                    amount: body.value!,
                    provider: 'asaas',
                    billing_type: 'asaas_auto',
                    status: 'pending_payment',
                    start_date: body.dueDate!,
                    asaas_customer_id: customer.id,
                    asaas_payment_id: payment.id,
                })
                .select('id')
                .single()
            if (cErr) {
                console.error('[wallet/charges] Failed to persist contract', cErr)
            } else {
                contractId = contract?.id ?? null
            }
        }

        return NextResponse.json({
            paymentId: payment.id,
            invoiceUrl: payment.invoiceUrl,
            status: payment.status,
            value: payment.value,
            dueDate: payment.dueDate,
            contractId,
        })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/charges] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: err.status === 400 ? 400 : 502 }
            )
        }
        console.error('[wallet/charges] Error:', err)
        return NextResponse.json({ error: 'Erro ao criar cobrança' }, { status: 500 })
    }
}

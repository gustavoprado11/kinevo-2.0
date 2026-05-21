// ============================================================================
// POST /api/wallet/charges
// ============================================================================
// Cria uma cobrança avulsa (one-off) via Asaas Payment Link.
//
// Por que Payment Link em vez de /v3/payments direto:
//   /v3/payments exige CPF/CNPJ no Customer. Como a tabela `students` não
//   guarda CPF (e perguntar pro trainer é fricção), usamos Payment Link:
//   o aluno preenche o próprio CPF no checkout hospedado pela Asaas.
//
// Body esperado:
// {
//   "studentId": "<uuid>",
//   "planId":    "<uuid>",            // optional — define valor/métodos/descrição
//   "value":     250.00,              // BRL (obrigatório se planId vazio)
//   "dueDate":   "2026-05-15",        // YYYY-MM-DD — vira dueDateLimitDays
//   "billingType": "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO"
//                                    // (opcional — se omitido, deriva do plano)
//   "description": "Consultoria Maio" // optional
// }
//
// Resposta: { paymentLinkId, url, contractId, value, dueDateLimitDays }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
    AsaasApiError,
    createPaymentLink,
    describeChargeForStudent,
    getKinevoWalletId,
    type AsaasBillingType,
    type AsaasSplit,
} from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import { logContractEvent } from '@/lib/contract-events'

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

interface PlanRow {
    title: string | null
    allow_pix?: boolean | null
    allow_credit_card?: boolean | null
    allow_boleto?: boolean | null
}

/**
 * Deriva o billingType do plano. Lógica:
 *  - Se exatamente 1 método permitido → usa esse (restringe o link)
 *  - Se 2+ métodos → UNDEFINED (aluno escolhe no checkout)
 *  - Se plano não fornecido → UNDEFINED
 *
 * Edge: trainer marca "PIX + Cartão mas SEM Boleto" → não dá pra restringir
 * via API (Asaas só aceita 1 ou UNDEFINED). Cai no UNDEFINED e o Boleto vai
 * aparecer. Aceito pro beta.
 */
function deriveBillingType(plan: PlanRow | null): AsaasBillingType {
    if (!plan) return 'UNDEFINED'
    const allowed: AsaasBillingType[] = []
    if (plan.allow_pix ?? true) allowed.push('PIX')
    if (plan.allow_credit_card ?? true) allowed.push('CREDIT_CARD')
    if (plan.allow_boleto ?? false) allowed.push('BOLETO')
    return allowed.length === 1 ? allowed[0] : 'UNDEFINED'
}

/**
 * Converte dueDate (YYYY-MM-DD) em dueDateLimitDays (relativo à criação do link).
 * Esse é o limite que o Asaas dá pro aluno pagar a partir do clique no link.
 * Mínimo 1, máximo 60.
 */
function dueDateToLimitDays(dueDate: string): number {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const target = new Date(`${dueDate}T00:00:00Z`)
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
    return Math.min(60, Math.max(1, diff))
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

        // 1. Confirma que o aluno pertence ao trainer
        const { data: student, error: studentErr } = await supabaseAdmin
            .from('students')
            .select('id, name, coach_id')
            .eq('id', body.studentId!)
            .single()
        if (studentErr || !student) {
            return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
        }
        if (student.coach_id !== trainer.id) {
            return NextResponse.json({ error: 'Aluno não pertence a você' }, { status: 403 })
        }

        // 2. apiKey da subconta
        const apiKey = await getDecryptedApiKey(trainer.id)

        // 3. Take rate Kinevo via split (se configurado)
        const kinevoWalletId = getKinevoWalletId()
        const takeRatePct = Number(process.env.KINEVO_TAKE_RATE_PCT ?? '0')
        const split: AsaasSplit[] | undefined =
            kinevoWalletId && takeRatePct > 0
                ? [{ walletId: kinevoWalletId, percentualValue: takeRatePct }]
                : undefined

        // 4. Resolve plano (pra descrição + métodos permitidos)
        let plan: PlanRow | null = null
        if (body.planId) {
            const { data } = await supabaseAdmin
                .from('trainer_plans')
                .select('title, allow_pix, allow_credit_card, allow_boleto')
                .eq('id', body.planId)
                .eq('trainer_id', trainer.id)
                .maybeSingle()
            plan = data ?? null
        }

        const description = body.description ?? describeChargeForStudent({
            studentName: student.name ?? 'Aluno',
            planTitle: plan?.title ?? 'Consultoria',
        })
        const billingType = body.billingType ?? deriveBillingType(plan)
        const dueDateLimitDays = dueDateToLimitDays(body.dueDate!)

        // 5. Cria contrato local PRIMEIRO (status=pending_payment) — assim
        //    temos um id estável pra usar como idempotency key do Asaas
        const { data: contract, error: contractErr } = await supabaseAdmin
            .from('student_contracts')
            .insert({
                student_id: student.id,
                trainer_id: trainer.id,
                plan_id: body.planId ?? null,
                amount: body.value!,
                provider: 'asaas',
                billing_type: 'asaas_auto',
                status: 'pending_payment',
                start_date: body.dueDate!,
            })
            .select('id')
            .single()
        if (contractErr || !contract) {
            console.error('[wallet/charges] contract insert failed', contractErr)
            return NextResponse.json({ error: 'Falha ao criar contrato local' }, { status: 500 })
        }

        // 6. Cria Payment Link no Asaas
        let link
        try {
            link = await createPaymentLink(
                apiKey,
                {
                    name: `${plan?.title ?? 'Consultoria'} — ${student.name ?? 'Aluno'}`,
                    description,
                    value: body.value!,
                    billingType,
                    chargeType: 'DETACHED',
                    dueDateLimitDays,
                    notificationEnabled: false,  // Kinevo controla notif por push
                    split,
                },
                contract.id,
            )
        } catch (err) {
            // Rollback do contrato local se a Asaas falhar
            await supabaseAdmin.from('student_contracts').delete().eq('id', contract.id)
            throw err
        }

        // 7. Atualiza contrato com o link id
        await supabaseAdmin
            .from('student_contracts')
            .update({ asaas_payment_link_id: link.id })
            .eq('id', contract.id)

        // 8. Histórico do contrato
        await logContractEvent({
            studentId: student.id,
            trainerId: trainer.id,
            contractId: contract.id,
            eventType: 'contract_created',
            metadata: { provider: 'asaas', amount: body.value, billingType, kind: 'one_off' },
        })

        return NextResponse.json({
            paymentLinkId: link.id,
            url: link.url,
            invoiceUrl: link.url,        // alias pra compatibilidade com UI antiga
            contractId: contract.id,
            value: link.value,
            billingType: link.billingType,
            dueDateLimitDays: link.dueDateLimitDays ?? dueDateLimitDays,
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

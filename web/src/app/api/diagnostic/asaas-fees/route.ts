// ============================================================================
// GET /api/diagnostic/asaas-fees
// ============================================================================
// Endpoint one-shot pra investigar a estrutura real de taxas da Asaas:
//
// 1. Tenta endpoints conhecidos da Asaas que possam retornar a tabela de
//    taxas da conta (ex: /v3/finance/fees, /v3/myAccount/fees). A Asaas
//    não documenta isso de forma pública e consistente — fazemos um probe.
//
// 2. Lista os payments mais recentes da subconta. Cada payment tem `value`
//    (que o aluno pagou) e `netValue` (o que caiu na carteira). A diferença
//    é a taxa REAL cobrada — única fonte de verdade que temos garantida.
//
// 3. Calcula a taxa observada por método de pagamento.
//
// Auth: requer trainer logado. NÃO é endpoint pra produção — uso interno
// só pra calibrar a tabela ASAAS_FEES com a realidade observada da conta.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { asaasRequest, AsaasApiError } from '@/lib/asaas/client'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

interface PaymentRow {
    id: string
    status: string
    value: number
    netValue: number
    billingType: string
    paymentDate?: string | null
    dueDate: string
}

interface ProbeResult {
    path: string
    ok: boolean
    status?: number
    body?: unknown
    error?: string
}

async function probe(apiKey: string, path: string): Promise<ProbeResult> {
    try {
        const body = await asaasRequest({ apiKey, path })
        return { path, ok: true, body }
    } catch (err) {
        if (err instanceof AsaasApiError) {
            return { path, ok: false, status: err.status, error: err.message, body: err.body }
        }
        return { path, ok: false, error: err instanceof Error ? err.message : String(err) }
    }
}

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const apiKey = await getDecryptedApiKey(trainer.id)

        // Probes candidatos — qualquer um que devolver 200 vira fonte oficial.
        const candidatePaths = [
            '/finance/fees',
            '/finance/fee',
            '/myAccount/fees',
            '/myAccount/fee',
            '/myAccount/info',
            '/finance/payment-statistics',
            '/finance/balance',
        ]
        const probes = await Promise.all(candidatePaths.map(p => probe(apiKey, p)))

        // Lista os payments recentes pra calcular taxa observada por método
        type PaymentListResponse = { data: PaymentRow[]; totalCount?: number }
        let payments: PaymentRow[] = []
        try {
            const r = await asaasRequest<PaymentListResponse>({
                apiKey,
                path: '/payments',
                query: { limit: 50, status: 'RECEIVED' },
            })
            payments = r.data ?? []
        } catch (err) {
            console.error('[diagnostic/asaas-fees] payments list failed', err)
        }

        // Agrupa por billingType e calcula fee observada
        interface Aggregate {
            billingType: string
            count: number
            samples: Array<{ paymentId: string; value: number; netValue: number; fee: number; feePct: number; date?: string | null }>
            averageFee: number
            averageFeePct: number
            minFee: number
            maxFee: number
        }
        const byMethod: Record<string, Aggregate> = {}
        for (const p of payments) {
            if (typeof p.value !== 'number' || typeof p.netValue !== 'number') continue
            const fee = p.value - p.netValue
            const feePct = p.value > 0 ? (fee / p.value) * 100 : 0
            const agg = byMethod[p.billingType] ?? {
                billingType: p.billingType,
                count: 0,
                samples: [],
                averageFee: 0,
                averageFeePct: 0,
                minFee: Number.POSITIVE_INFINITY,
                maxFee: 0,
            }
            agg.count++
            agg.samples.push({
                paymentId: p.id,
                value: p.value,
                netValue: p.netValue,
                fee: Math.round(fee * 100) / 100,
                feePct: Math.round(feePct * 10000) / 10000,
                date: p.paymentDate ?? null,
            })
            agg.minFee = Math.min(agg.minFee, fee)
            agg.maxFee = Math.max(agg.maxFee, fee)
            byMethod[p.billingType] = agg
        }
        for (const k of Object.keys(byMethod)) {
            const agg = byMethod[k]
            const totalFee = agg.samples.reduce((s, x) => s + x.fee, 0)
            const totalGross = agg.samples.reduce((s, x) => s + x.value, 0)
            agg.averageFee = Math.round((totalFee / agg.count) * 100) / 100
            agg.averageFeePct = totalGross > 0 ? Math.round((totalFee / totalGross) * 10000) / 100 : 0
            if (agg.minFee === Number.POSITIVE_INFINITY) agg.minFee = 0
            agg.minFee = Math.round(agg.minFee * 100) / 100
            agg.maxFee = Math.round(agg.maxFee * 100) / 100
        }

        // Lista transfers recentes — útil pra ver status de saques que o
        // webhook não notificou
        let transfers: Array<{
            id: string
            value: number
            netValue?: number
            status: string
            endToEndIdentifier?: string | null
            failReason?: string | null
            effectiveDate?: string | null
            scheduleDate?: string | null
        }> = []
        try {
            const r = await asaasRequest<{ data: typeof transfers }>({
                apiKey,
                path: '/transfers',
                query: { limit: 10 },
            })
            transfers = r.data ?? []
        } catch (err) {
            console.error('[diagnostic/asaas-fees] transfers list failed', err)
        }

        return NextResponse.json({
            trainerId: trainer.id,
            asaasEnv: process.env.ASAAS_ENV ?? '(default sandbox)',
            probes,
            observedFees: Object.values(byMethod),
            recentPaymentCount: payments.length,
            recentTransfers: transfers,
        }, { status: 200 })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[diagnostic/asaas-fees] Error', err)
        return NextResponse.json({ error: 'Erro no diagnóstico' }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AsaasApiError } from '@/lib/asaas'
import { getDecryptedApiKey, WalletAuthError } from '@/lib/asaas/wallet-service'
import { reconcilePaymentLinkContract } from '@/lib/asaas/charge-reconcile'
import { ensureSubaccountWebhook } from '@/lib/asaas/webhook-setup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * CRON: reconciliação automática das cobranças Asaas (Payment Link).
 *
 * O webhook é a única fonte AUTOMÁTICA de verdade do dinheiro — se a fila da
 * Asaas for interrompida (falhas repetidas desabilitam o webhook) ou eventos
 * se perderem, o dinheiro cai no saldo do treinador mas o contrato fica preso
 * em `pending_payment` e o aluno pode ficar BLOQUEADO mesmo tendo pago. Antes
 * deste cron, a única recuperação era o botão "Sincronizar" POR COBRANÇA.
 *
 * O que faz, por execução (horária):
 *   1. Varre contratos `pending_payment` com Payment Link, criados entre
 *      15min e 60 dias atrás (15min = chance justa do webhook chegar antes;
 *      60d = além disso o link já expirou). Reconcilia cada um via
 *      `reconcilePaymentLinkContract` (mesma lógica idempotente do webhook).
 *   2. Saúde do webhook por subconta aprovada: `ensureSubaccountWebhook`
 *      re-cria webhook sumido (self-heal) e LOGA precisa-reparo (drift de
 *      eventos/disabled — conserto real é o passo gated de rotação).
 *
 * Auth: Bearer CRON_SECRET (mesmo contrato dos demais crons). Idempotente.
 */
export async function GET(request: Request) {
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = Date.now()
    const minAge = new Date(now - 15 * 60 * 1000).toISOString()
    const maxAge = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Candidatos: pendentes com link, janela 15min–60d, mais antigos primeiro.
    const { data: candidates, error: listError } = await supabaseAdmin
        .from('student_contracts')
        .select('id, trainer_id')
        .eq('status', 'pending_payment')
        .not('asaas_payment_link_id', 'is', null)
        .like('billing_type', 'asaas%')
        .lt('created_at', minAge)
        .gt('created_at', maxAge)
        .order('created_at', { ascending: true })
        .limit(40)

    if (listError) {
        console.error('[cron:reconcile-asaas] list error:', listError)
        return NextResponse.json({ error: 'list_failed' }, { status: 500 })
    }

    // Agrupa por treinador pra decriptar a key uma vez só.
    const byTrainer = new Map<string, string[]>()
    for (const c of candidates ?? []) {
        const list = byTrainer.get(c.trainer_id) ?? []
        list.push(c.id)
        byTrainer.set(c.trainer_id, list)
    }

    let synced = 0
    let stillPending = 0
    let failures = 0

    for (const [trainerId, contractIds] of byTrainer) {
        let apiKey: string
        try {
            apiKey = await getDecryptedApiKey(trainerId)
        } catch (err) {
            // Carteira não aprovada/sem key — cobranças desse treinador ficam
            // pro botão manual; não é erro do cron.
            if (!(err instanceof WalletAuthError)) {
                console.error('[cron:reconcile-asaas] key error for trainer', trainerId, err)
            }
            continue
        }

        for (const contractId of contractIds) {
            try {
                const outcome = await reconcilePaymentLinkContract({
                    contractId,
                    trainerId,
                    apiKey,
                    via: 'cron',
                })
                if (outcome.synced) {
                    synced++
                    console.log(`[cron:reconcile-asaas] recovered payment: contract=${contractId} payment=${outcome.paymentId}`)
                } else {
                    stillPending++
                }
            } catch (err) {
                failures++
                if (err instanceof AsaasApiError) {
                    console.error(`[cron:reconcile-asaas] Asaas error contract=${contractId}:`, err.status, err.body)
                } else {
                    console.error(`[cron:reconcile-asaas] error contract=${contractId}:`, err)
                }
            }
        }
    }

    // 2. Saúde dos webhooks das subcontas aprovadas (self-heal se sumiu;
    //    drift vira log de erro — visível nos runtime errors do Vercel).
    const needsRepair: string[] = []
    let webhooksChecked = 0
    const { data: accounts } = await supabaseAdmin
        .from('trainer_payment_accounts')
        .select('trainer_id, email')
        .eq('status', 'approved')
        .limit(100)

    for (const account of accounts ?? []) {
        try {
            const apiKey = await getDecryptedApiKey(account.trainer_id)
            const res = await ensureSubaccountWebhook(apiKey, {
                trainerId: account.trainer_id,
                email: account.email,
            })
            webhooksChecked++
            if (res.needsRepair) {
                needsRepair.push(account.trainer_id)
                console.error(
                    `[cron:reconcile-asaas] webhook precisa de reparo gated (trainer ${account.trainer_id}) — rodar rotateSubaccountWebhook`,
                )
            }
            if (res.created) {
                console.warn(`[cron:reconcile-asaas] webhook estava SUMIDO e foi recriado (trainer ${account.trainer_id})`)
            }
        } catch (err) {
            console.error('[cron:reconcile-asaas] webhook health check failed for trainer', account.trainer_id, err)
        }
    }

    console.log(
        `[cron:reconcile-asaas] scanned=${candidates?.length ?? 0} synced=${synced} pending=${stillPending} failures=${failures} webhooks=${webhooksChecked} needsRepair=${needsRepair.length}`,
    )

    return NextResponse.json({
        scanned: candidates?.length ?? 0,
        synced,
        stillPending,
        failures,
        webhooksChecked,
        needsRepair,
    })
}

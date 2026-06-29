// ============================================================================
// POST /api/wallet/setup-webhook
// ============================================================================
// Backfill: cadastra (ou re-cadastra) o webhook Kinevo na subconta Asaas do
// trainer. Usado:
//   1) Pros trainers que entraram antes da gente automatizar isso
//   2) Quando o token rotacionar (rodar pra atualizar todas as contas)
//   3) Auto-trigger silencioso na home se a UI detectar wallet aprovada
//      mas webhook não confirmado
//
// Idempotente: se já existe webhook na URL alvo, retorna { changed: false }.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError, ensureSubaccountWebhook } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

export async function POST(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const apiKey = await getDecryptedApiKey(trainer.id)
        const result = await ensureSubaccountWebhook(apiKey, { trainerId: trainer.id })
        return NextResponse.json({
            ok: true,
            created: result.created,
            updated: result.updated,
            changed: result.created || result.updated,
            webhookId: result.webhookId,
        })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/setup-webhook] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: 502 },
            )
        }
        console.error('[wallet/setup-webhook] Error', err)
        const message = err instanceof Error ? err.message : 'Erro ao cadastrar webhook'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

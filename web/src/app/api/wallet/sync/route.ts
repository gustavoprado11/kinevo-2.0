// ============================================================================
// POST /api/wallet/sync
// ============================================================================
// Forces a refresh of the trainer's wallet status from Asaas (useful when the
// trainer was rejected/awaiting and wants to retry without leaving the page).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError } from '@/lib/asaas'
import { requireTrainer, syncWalletStatus, WalletAuthError } from '@/lib/asaas/wallet-service'

export async function POST(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const summary = await syncWalletStatus(trainer.id)
        return NextResponse.json(summary)
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/sync] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status, asaasBody: err.body },
                { status: 502 }
            )
        }
        console.error('[wallet/sync] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro ao sincronizar carteira'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// ============================================================================
// GET /api/wallet/status
// ============================================================================
// Returns the current trainer's wallet summary (camelCase, no secrets).
// Used by the dashboard + mobile to decide whether to show "Ativar Carteira"
// or the full Carteira UI.
//
// Auth: cookie (web) OR Bearer (mobile).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getWalletRow, requireTrainer, summarizeWallet, WalletAuthError } from '@/lib/asaas/wallet-service'

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const row = await getWalletRow(trainer.id)
        return NextResponse.json(summarizeWallet(row))
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/status] Error:', err)
        return NextResponse.json({ error: 'Erro ao consultar carteira' }, { status: 500 })
    }
}

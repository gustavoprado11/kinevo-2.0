// ============================================================================
// GET /api/wallet/balance
// ============================================================================
// Reads the trainer's Asaas subaccount balance (live).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError, getBalance } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const apiKey = await getDecryptedApiKey(trainer.id)
        const balance = await getBalance(apiKey)
        return NextResponse.json(balance)
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            return NextResponse.json({ error: err.message }, { status: 502 })
        }
        console.error('[wallet/balance] Error:', err)
        return NextResponse.json({ error: 'Erro ao consultar saldo' }, { status: 500 })
    }
}

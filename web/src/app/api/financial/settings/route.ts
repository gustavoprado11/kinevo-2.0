// ============================================================================
// GET, PATCH /api/financial/settings
// ============================================================================
// GET   — retorna as configurações atuais do trainer (defaults se ainda vazias)
// PATCH — atualiza um subconjunto dos campos. Body é parcial.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'
import {
    getFinancialSettings,
    updateFinancialSettings,
    type FinancialSettings,
} from '@/lib/financial/settings'

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const settings = await getFinancialSettings(trainer.id)
        return NextResponse.json(settings)
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[financial/settings GET] Error:', err)
        return NextResponse.json({ error: 'Erro ao ler configurações' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    let body: Partial<FinancialSettings>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Corpo deve ser um objeto' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)
        const updated = await updateFinancialSettings(trainer.id, body)
        return NextResponse.json(updated)
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof Error && err.message.startsWith('overdueGraceDays')) {
            return NextResponse.json({ error: err.message }, { status: 400 })
        }
        console.error('[financial/settings PATCH] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro ao salvar configurações'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

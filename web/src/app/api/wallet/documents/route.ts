// ============================================================================
// GET /api/wallet/documents
// ============================================================================
// Lista os grupos de documentos pendentes/aprovados/rejeitados da subconta
// do trainer logado. Usa a apiKey da subconta (decriptada).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { AsaasApiError, listPendingDocuments, summarizeDocuments } from '@/lib/asaas'
import { getDecryptedApiKey, requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

export async function GET(request: NextRequest) {
    try {
        const trainer = await requireTrainer(request)
        const apiKey = await getDecryptedApiKey(trainer.id)
        const groups = await listPendingDocuments(apiKey)
        const summary = summarizeDocuments(groups)
        return NextResponse.json({ groups, summary })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        if (err instanceof AsaasApiError) {
            console.error('[wallet/documents] Asaas error', err.status, err.body)
            return NextResponse.json(
                { error: err.message, asaasStatus: err.status },
                { status: 502 }
            )
        }
        console.error('[wallet/documents] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro ao listar documentos'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

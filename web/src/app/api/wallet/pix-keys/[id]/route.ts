// ============================================================================
// DELETE /api/wallet/pix-keys/[id]
// ============================================================================
// Removes a saved PIX key.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const trainer = await requireTrainer(request)
        const { error } = await supabaseAdmin
            .from('pix_keys')
            .delete()
            .eq('id', id)
            .eq('trainer_id', trainer.id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/pix-keys DELETE] Error:', err)
        return NextResponse.json({ error: 'Erro ao remover chave PIX' }, { status: 500 })
    }
}

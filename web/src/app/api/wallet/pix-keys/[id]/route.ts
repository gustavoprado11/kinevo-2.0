// ============================================================================
// DELETE / PATCH /api/wallet/pix-keys/[id]
// ============================================================================
// DELETE — Removes a saved PIX key.
// PATCH  — Updates a PIX key (currently only `isDefault: true` is supported —
//          marks this key as default and clears the flag on all the others).
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

interface PatchBody {
    isDefault?: boolean
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    let body: PatchBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    try {
        const trainer = await requireTrainer(request)

        if (body.isDefault === true) {
            // Garante que essa chave pertence ao trainer antes de mexer em
            // todas as outras dele.
            const { data: owned } = await supabaseAdmin
                .from('pix_keys')
                .select('id')
                .eq('id', id)
                .eq('trainer_id', trainer.id)
                .maybeSingle()
            if (!owned) {
                return NextResponse.json({ error: 'Chave não encontrada' }, { status: 404 })
            }

            // 1) Limpa o flag em todas
            const { error: clearErr } = await supabaseAdmin
                .from('pix_keys')
                .update({ is_default: false })
                .eq('trainer_id', trainer.id)
            if (clearErr) throw clearErr

            // 2) Marca a escolhida
            const { error: setErr } = await supabaseAdmin
                .from('pix_keys')
                .update({ is_default: true })
                .eq('id', id)
                .eq('trainer_id', trainer.id)
            if (setErr) throw setErr

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Operação não suportada' }, { status: 400 })
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[wallet/pix-keys PATCH] Error:', err)
        return NextResponse.json({ error: 'Erro ao atualizar chave PIX' }, { status: 500 })
    }
}

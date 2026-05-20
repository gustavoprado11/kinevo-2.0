// ============================================================================
// PATCH /api/students/[id]/access
// ============================================================================
// Trainer bloqueia / desbloqueia manualmente o acesso de um aluno ao app.
// Útil em casos como:
//   - Aluno pagou em dinheiro/PIX direto (fora da Carteira) → desbloquear
//   - Trainer quer suspender temporariamente por outro motivo → bloquear
//
// Auth via Bearer (mobile) ou cookie (web). Trainer só pode mexer em alunos
// próprios — validamos coach_id antes de chamar a RPC.
//
// Body:
//   { blocked: false }              → desbloqueia
//   { blocked: true, reason: '...' } → bloqueia com motivo (default genérico)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireTrainer, WalletAuthError } from '@/lib/asaas/wallet-service'

interface AccessPatchBody {
    blocked?: boolean
    reason?: string
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: studentId } = await params

    let body: AccessPatchBody
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (typeof body.blocked !== 'boolean') {
        return NextResponse.json(
            { error: 'Campo "blocked" é obrigatório (boolean)' },
            { status: 400 }
        )
    }

    try {
        const trainer = await requireTrainer(request)

        // Garantir que o aluno pertence ao trainer (defesa em profundidade,
        // mesmo já tendo RLS no banco).
        const { data: student, error: studentErr } = await supabaseAdmin
            .from('students')
            .select('id, name, coach_id')
            .eq('id', studentId)
            .eq('coach_id', trainer.id)
            .maybeSingle()

        if (studentErr) throw studentErr
        if (!student) {
            return NextResponse.json(
                { error: 'Aluno não encontrado ou não pertence a você' },
                { status: 404 }
            )
        }

        if (body.blocked) {
            const { error } = await supabaseAdmin.rpc('block_student_access', {
                p_student_id: studentId,
                p_reason: body.reason?.trim() || 'Bloqueado manualmente pelo treinador.',
            })
            if (error) throw error
            return NextResponse.json({ blocked: true })
        } else {
            const { error } = await supabaseAdmin.rpc('unblock_student_access', {
                p_student_id: studentId,
            })
            if (error) throw error
            return NextResponse.json({ blocked: false })
        }
    } catch (err) {
        if (err instanceof WalletAuthError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
        }
        console.error('[students/access PATCH] Error:', err)
        const message = err instanceof Error ? err.message : 'Erro ao atualizar acesso'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

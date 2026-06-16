/**
 * GET /api/trainer/ai-status — status de IA/tier do treinador para o mobile.
 *
 * O app mobile (Expo) consome este endpoint via JWT (Authorization: Bearer
 * <access_token>) para refletir o tier: medidor de créditos e gate de criação
 * de aluno ("Assine para adicionar alunos" no Free já no limite).
 *
 * Reusa os contratos da Fase 0/1:
 *   - getAiUsageSummary (tier + balde de créditos / free-trials).
 *   - STUDENT_CAP (limite de alunos por tier) para derivar `studentsLocked`.
 *
 * Tenant isolation: tudo opera só sobre o trainerId resolvido do token.
 * O gate de criação é revalidado no backend (assertCanCreateStudent); aqui é
 * apenas o espelho de UX — nunca trava o app.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { STUDENT_CAP } from '@/lib/limits/student-cap'

export interface TrainerAiStatusResponse {
    tier: string
    creditsUsed: number
    creditsTotal: number
    creditsRemaining: number
    studentsLocked: boolean
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const token = authHeader.slice('Bearer '.length)
    const {
        data: { user },
        error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { data: trainer } = await supabaseAdmin
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        return NextResponse.json({ error: 'Treinador não encontrado' }, { status: 404 })
    }

    const summary = await getAiUsageSummary(supabaseAdmin, trainer.id)

    // studentsLocked: o tier ainda comporta um novo aluno? (Free=1, pagos=∞.)
    const cap = STUDENT_CAP[summary.tier]
    let studentsLocked = false
    if (Number.isFinite(cap)) {
        const { count } = await supabaseAdmin
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', trainer.id)
        studentsLocked = (count ?? 0) >= cap
    }

    const body: TrainerAiStatusResponse = {
        tier: summary.tier,
        creditsUsed: summary.creditsUsed,
        creditsTotal: summary.creditsTotal,
        creditsRemaining: summary.creditsRemaining,
        studentsLocked,
    }

    return NextResponse.json(body)
}

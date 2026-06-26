/**
 * Conversas do Assistente — coleção (MOBILE, Bearer).
 *   GET  → lista as threads ativas do treinador.
 *   POST → cria uma thread (opcionalmente vinculada a um aluno).
 *
 * Espelha /api/assistant/conversations, mas autentica via Bearer token (mobile).
 * Todos os planos têm o Assistente (ASSISTANT_TIERS); limite por-uso é no turno.
 * Escrita via service role. Reusa a mesma camada de dados.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { ASSISTANT_TIERS, UUID_RE } from '@/lib/assistant/command-engine'
import { listConversations, createConversation } from '@/lib/assistant/conversations'
import { resolveTrainerBearer } from '@/lib/assistant/mobile-auth'

export async function GET(req: NextRequest) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer
        const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
        if (!ASSISTANT_TIERS.has(tier)) return NextResponse.json({ error: 'tier_locked' }, { status: 403 })
        const conversations = await listConversations(supabaseAdmin, trainer.id)
        return NextResponse.json({ conversations })
    } catch (error) {
        console.error('[trainer/assistant conversations GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const trainer = await resolveTrainerBearer(req)
        if (trainer instanceof NextResponse) return trainer
        const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
        if (!ASSISTANT_TIERS.has(tier)) return NextResponse.json({ error: 'tier_locked' }, { status: 403 })

        const body = await req.json().catch(() => null)
        const rawStudentId: unknown = body?.studentId
        let studentId: string | null = null
        if (typeof rawStudentId === 'string' && UUID_RE.test(rawStudentId)) {
            // Valida posse do aluno antes de vincular.
            const { data } = await supabaseAdmin
                .from('students')
                .select('id')
                .eq('id', rawStudentId)
                .eq('coach_id', trainer.id)
                .maybeSingle()
            studentId = data?.id ?? null
        }

        const conversation = await createConversation(supabaseAdmin, trainer.id, { studentId })
        return NextResponse.json({ conversation })
    } catch (error) {
        console.error('[trainer/assistant conversations POST] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

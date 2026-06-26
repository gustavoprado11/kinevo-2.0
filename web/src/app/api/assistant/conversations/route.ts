/**
 * Conversas do Assistente (aba dedicada /assistente) — coleção.
 *   GET  → lista as threads ativas do treinador.
 *   POST → cria uma thread (opcionalmente vinculada a um aluno).
 *
 * Todos os planos têm o Assistente (ASSISTANT_TIERS); o limite por-uso é no turno
 * (gateAssistant). Aqui só barramos um tier futuro sem IA. Escrita via service role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { ASSISTANT_TIERS, UUID_RE } from '@/lib/assistant/command-engine'
import { listConversations, createConversation } from '@/lib/assistant/conversations'

async function resolveTrainer(): Promise<{ id: string } | NextResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    return { id: trainer.id }
}

export async function GET() {
    try {
        const trainer = await resolveTrainer()
        if (trainer instanceof NextResponse) return trainer
        const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
        if (!ASSISTANT_TIERS.has(tier)) return NextResponse.json({ error: 'tier_locked' }, { status: 403 })
        const conversations = await listConversations(supabaseAdmin, trainer.id)
        return NextResponse.json({ conversations })
    } catch (error) {
        console.error('[conversations GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const trainer = await resolveTrainer()
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
        console.error('[conversations POST] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

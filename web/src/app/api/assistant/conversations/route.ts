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
import { mineTrainerStyle, MIN_PROGRAMS_TO_MINE } from '@/lib/assistant/style-miner'
import type { StyleState } from '@/lib/assistant/style-state'

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

        // Entrevista de estilo: a MINERAÇÃO roda aqui, na criação — quando o
        // primeiro turno chega, o roteiro já sabe o que não precisa perguntar.
        if (body?.kind === 'style_interview') {
            const mining = await mineTrainerStyle(supabaseAdmin, trainer.id)
            const state: StyleState = {
                mined: mining.programsAnalyzed >= MIN_PROGRAMS_TO_MINE ? mining.style : null,
                minedSlots: mining.minedSlots,
                programsAnalyzed: mining.programsAnalyzed,
                answers: {},
                pendingSlot: null,
            }
            const conversation = await createConversation(supabaseAdmin, trainer.id, {
                kind: 'style_interview',
                title: 'Meu estilo de prescrição',
                styleState: state,
            })
            return NextResponse.json({ conversation })
        }

        const rawStudentId: unknown = body?.studentId
        let studentId: string | null = null
        if (typeof rawStudentId === 'string' && UUID_RE.test(rawStudentId)) {
            // Valida acesso antes de vincular: dono OU membro do estúdio do
            // aluno (decisão 16/jul).
            const { data } = await supabaseAdmin
                .from('students')
                .select('id, coach_id, organization_id')
                .eq('id', rawStudentId)
                .maybeSingle()
            if (data && data.coach_id === trainer.id) {
                studentId = data.id
            } else if (data?.organization_id) {
                const { data: member } = await supabaseAdmin
                    .from('organization_members')
                    .select('id')
                    .eq('organization_id', data.organization_id)
                    .eq('trainer_id', trainer.id)
                    .eq('status', 'active')
                    .maybeSingle()
                studentId = member ? data.id : null
            }
        }

        const conversation = await createConversation(supabaseAdmin, trainer.id, { studentId })
        return NextResponse.json({ conversation })
    } catch (error) {
        console.error('[conversations POST] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

/**
 * GET /api/assistant/student-context/[studentId]
 *
 * Alimenta a coluna de contexto do aluno no /assistente. Leitura pura: SEM LLM,
 * SEM custo de crédito, SEM gate de tier — só autenticação + posse do aluno
 * (students.coach_id = trainer.id), com o client de sessão (respeita RLS).
 * 404 quando o aluno não pertence ao treinador; 401 sem sessão.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { isStudentManagementLockedForTrainer } from '@/lib/limits/student-readonly'
import { getStudentPanelData } from '@/lib/assistant/student-panel-data'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
    try {
        const { studentId } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

        const { trainer } = await getTrainerWithSubscription(user.id)

        // readOnly (gestão travada) é ortogonal ao payload → roda em PARALELO com
        // as queries do painel (era sequencial e dominava a latência da rota).
        const [readOnly, payload] = await Promise.all([
            isStudentManagementLockedForTrainer(trainer.id),
            getStudentPanelData(supabase, trainer.id, studentId),
        ])
        if (!payload) return NextResponse.json({ error: 'not_found' }, { status: 404 })

        return NextResponse.json({ ...payload, readOnly })
    } catch (error) {
        console.error('[student-context GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

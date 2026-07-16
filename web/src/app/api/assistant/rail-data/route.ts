/**
 * GET /api/assistant/rail-data — alimenta o rail "Conversas & Alunos" da
 * AssistantSidebar quando ela persiste nas demais abas (casca AppLayout).
 * Mesma lógica de dados da home do chat (/assistente): alunos (com avatar e
 * marcação de atenção) + conversas. Acesso: tiers com IA.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getStudentScope } from '@/lib/studio/student-scope'
import { listConversations } from '@/lib/assistant/conversations'
import { getAttentionInsights } from '@/lib/assistant/home-data'
import { ASSISTANT_TIERS } from '@/lib/assistant/command-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

        const { trainer, tier } = await getTrainerWithSubscription(user.id)
        if (!ASSISTANT_TIERS.has(tier)) return NextResponse.json({ students: [], conversations: [] })

        const [conversations, studentsRes, attention] = await Promise.all([
            listConversations(supabaseAdmin, trainer.id),
            // Estúdios (decisão 16/jul): o assistente enxerga os alunos do
            // estúdio, não só os próprios. Perfis "Eu" de colegas ficam fora.
            (async () => {
                const scope = await getStudentScope(trainer.id)
                const q = supabase
                    .from('students')
                    .select('id, name, status, avatar_url, coach_id, is_trainer_profile')
                    .order('name', { ascending: true })
                const res = scope.kind === 'org'
                    ? await q.or(`organization_id.eq.${scope.orgId},coach_id.eq.${trainer.id}`)
                    : await q.eq('coach_id', trainer.id)
                if (res.data) {
                    res.data = res.data.filter(
                        (s: { is_trainer_profile?: boolean | null; coach_id?: string | null }) =>
                            !(s.is_trainer_profile && s.coach_id !== trainer.id),
                    )
                }
                return res
            })(),
            getAttentionInsights(supabaseAdmin, trainer.id),
        ])

        // Mesma marcação do workspace: âmbar p/ quem tem insight ativo ou status != ativo.
        const attentionByStudent = new Map<string, string>()
        for (const a of attention) if (a.studentId && !attentionByStudent.has(a.studentId)) attentionByStudent.set(a.studentId, a.title)

        const students = (studentsRes.data ?? []).map((s) => {
            const row = s as { id: string; name: string; status?: string; avatar_url?: string | null }
            const att = attentionByStudent.get(row.id)
            const status = row.status ?? 'active'
            return {
                id: row.id,
                name: row.name,
                avatarUrl: row.avatar_url ?? null,
                dot: att ? 'amber' : status !== 'active' ? 'amber' : 'green',
                subtitle: att ?? '',
            }
        })

        return NextResponse.json({ students, conversations })
    } catch (error) {
        console.error('[rail-data GET] error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

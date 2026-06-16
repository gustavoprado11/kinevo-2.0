/**
 * /assistente — modo Assistente (Cowork). Shell próprio (sem AppLayout):
 * home conversacional + sidebar (toggle/nav/Alunos/Conversas). Gate Pro+.
 *
 * O motor MCP+HITL é o mesmo do ⌘K (lib/assistant/command-engine), aqui
 * conversacional e persistido (ai_conversations / ai_messages, migration 209).
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { listConversations } from '@/lib/assistant/conversations'
import { getAttentionInsights } from '@/lib/assistant/home-data'
import { PRO_TIERS } from '@/lib/assistant/command-engine'
import { AppLayout } from '@/components/layout/app-layout'
import { AssistantWorkspace } from '@/components/assistant/workspace/assistant-workspace'

export const dynamic = 'force-dynamic'

export default async function AssistentePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) redirect('/login')

    const tier = await getAiTierForTrainer(supabaseAdmin, trainer.id)
    if (!PRO_TIERS.has(tier)) redirect('/settings')

    const [summary, conversations, studentsRes, attention] = await Promise.all([
        getAiUsageSummary(supabaseAdmin, trainer.id),
        listConversations(supabaseAdmin, trainer.id),
        supabase.from('students').select('id, name, status').eq('coach_id', trainer.id).order('name', { ascending: true }),
        getAttentionInsights(supabaseAdmin, trainer.id),
    ])

    const students = (studentsRes.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        status: (s as { status?: string }).status ?? 'active',
    }))

    return (
        <AppLayout trainerName={trainer.name} trainerEmail={user.email ?? undefined} students={students} fullBleed>
            <AssistantWorkspace
                initialSummary={summary}
                initialConversations={conversations}
                students={students}
                attention={attention}
                trainerName={trainer.name}
                trainerEmail={user.email ?? null}
            />
        </AppLayout>
    )
}

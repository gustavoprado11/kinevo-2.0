/**
 * /assistente — modo Assistente (Cowork). Casca própria de COLUNA ÚNICA
 * (sem AppLayout): a AssistantSidebar (toggle/nav recolhida/Alunos/Conversas/
 * perfil) à esquerda e a home conversacional à direita. Gate Pro+.
 *
 * O motor MCP+HITL é o mesmo do ⌘K (lib/assistant/command-engine), aqui
 * conversacional e persistido (ai_conversations / ai_messages, migration 209).
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { listConversations } from '@/lib/assistant/conversations'
import { getAttentionInsights } from '@/lib/assistant/home-data'
import { ASSISTANT_TIERS } from '@/lib/assistant/command-engine'
import { AssistantWorkspace } from '@/components/assistant/workspace/assistant-workspace'

export const dynamic = 'force-dynamic'

export default async function AssistentePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { trainer, tier } = await getTrainerWithSubscription(user.id)
    if (!ASSISTANT_TIERS.has(tier)) redirect('/settings')

    const [summary, conversations, studentsRes, attention] = await Promise.all([
        getAiUsageSummary(supabaseAdmin, trainer.id),
        listConversations(supabaseAdmin, trainer.id),
        supabase.from('students').select('id, name, status, avatar_url').eq('coach_id', trainer.id).order('name', { ascending: true }),
        getAttentionInsights(supabaseAdmin, trainer.id),
    ])

    const students = (studentsRes.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        status: (s as { status?: string }).status ?? 'active',
        avatarUrl: (s as { avatar_url?: string | null }).avatar_url ?? null,
    }))

    return (
        <AssistantWorkspace
            initialSummary={summary}
            initialConversations={conversations}
            students={students}
            attention={attention}
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
        />
    )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'
import type { OnboardingState, TrainerModalityFocus } from '@kinevo/shared/types/onboarding'
import { getAiTier, type AiTier } from '@/lib/auth/get-ai-tier'
import { isStudentManagementLocked } from '@/lib/limits/student-readonly'

interface TrainerRecord {
    id: string
    name: string
    email: string
    avatar_url: string | null
    theme: 'light' | 'dark' | 'system' | null
    ai_prescriptions_enabled?: boolean
    ai_tier?: string | null
    onboarding_state: OnboardingState | null
    modality_focus: TrainerModalityFocus
    [key: string]: any
}

export async function getTrainerWithSubscription(userId?: string) {
    const supabase = await createClient()

    // Resolve auth user id with the cheapest available source:
    //   1. explicit userId arg (caller already validated)
    //   2. x-user-id header set by middleware after getSession() — no roundtrip
    //   3. getUser() — full HTTP call to Supabase Auth API (~100-300ms)
    let authUserId = userId
    if (!authUserId) {
        try {
            const h = await headers()
            const headerUserId = h.get('x-user-id')
            if (headerUserId) authUserId = headerUserId
        } catch {
            // headers() throws outside a request scope — fall through to getUser()
        }
    }
    if (!authUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) redirect('/login')
        authUserId = user.id
    }

    // Single roundtrip: trainer + subscription embedded via PostgREST join.
    // Falls back without onboarding_state if the column doesn't exist (legacy DBs).
    let trainer: TrainerRecord | null = null
    let subscription: any = null

    const { data: t1, error: e1 } = await supabase
        .from('trainers')
        .select(
            'id, name, email, avatar_url, theme, ai_prescriptions_enabled, ai_tier, onboarding_state, modality_focus, ' +
            'subscriptions(status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_price_id, created_at)'
        )
        .eq('auth_user_id', authUserId)
        .single()

    if (t1) {
        const { subscriptions: subs, ...rest } = t1 as any
        trainer = rest as TrainerRecord
        subscription = pickActiveSubscription(subs)
    } else if (e1 && (e1.message?.includes('onboarding_state') || e1.message?.includes('modality_focus'))) {
        // Legacy DB sem onboarding_state e/ou modality_focus (pré Fase 17a).
        const { data: t2 } = await supabase
            .from('trainers')
            .select(
                'id, name, email, avatar_url, theme, ai_prescriptions_enabled, ai_tier, ' +
                'subscriptions(status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_price_id, created_at)'
            )
            .eq('auth_user_id', authUserId)
            .single()
        if (t2) {
            const { subscriptions: subs, ...rest } = t2 as any
            trainer = {
                ...rest,
                onboarding_state: DEFAULT_ONBOARDING_STATE,
                modality_focus: null,
            } as TrainerRecord
            subscription = pickActiveSubscription(subs)
        }
    }

    if (!trainer) {
        // Trainer record doesn't exist — force logout
        await supabase.auth.signOut()
        redirect('/login')
    }

    // Fase 1 · Trilha 3 — Free substitui o hard-block.
    // Antes: assinatura não-ativa → redirect('/subscription/blocked').
    // Agora: ninguém é barrado na entrada. Quem não tem plano pago ativo resolve
    // para o tier 'free' (via getAiTier) e ENTRA limitado. O pagante ativo segue
    // exatamente como antes — getAiTier deriva o tier do price e nunca devolve
    // 'free' para uma assinatura active/trialing.
    const tier: AiTier = getAiTier(trainer, subscription)

    // `studentsLocked`: ex-pagante que caiu para o Free e ainda tem alunos reais.
    // A gestão de alunos vira read-only (dados preservados). Só contamos quando o
    // tier é 'free' — pagante ativo nunca paga o custo da contagem.
    let studentsLocked = false
    if (tier === 'free') {
        const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', trainer.id)
        studentsLocked = isStudentManagementLocked(tier, count ?? 0)
    }

    return { trainer, subscription, tier, studentsLocked }
}

// Embedded subscriptions come back as an array (one-to-many FK). Prefer the
// active/trialing row, then fall back to the most recently created one to
// preserve the legacy `.single()` semantics for trainers with stale rows.
// Exported for unit testing.
export function pickActiveSubscription(subs: any): any | null {
    if (!subs) return null
    const arr: any[] = Array.isArray(subs) ? subs : [subs]
    if (arr.length === 0) return null
    const active = arr.find(s => s?.status === 'active' || s?.status === 'trialing')
    if (active) return active
    return [...arr].sort((a, b) => {
        const ad = a?.created_at ? new Date(a.created_at).getTime() : 0
        const bd = b?.created_at ? new Date(b.created_at).getTime() : 0
        return bd - ad
    })[0] ?? null
}

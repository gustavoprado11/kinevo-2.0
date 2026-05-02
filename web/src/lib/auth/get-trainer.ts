import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { DEFAULT_ONBOARDING_STATE } from '@kinevo/shared/types/onboarding'
import type { OnboardingState } from '@kinevo/shared/types/onboarding'

interface TrainerRecord {
    id: string
    name: string
    email: string
    avatar_url: string | null
    theme: 'light' | 'dark' | 'system' | null
    ai_prescriptions_enabled?: boolean
    onboarding_state: OnboardingState | null
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
            'id, name, email, avatar_url, theme, ai_prescriptions_enabled, onboarding_state, ' +
            'subscriptions(status, current_period_end, cancel_at_period_end, stripe_customer_id, created_at)'
        )
        .eq('auth_user_id', authUserId)
        .single()

    if (t1) {
        const { subscriptions: subs, ...rest } = t1 as any
        trainer = rest as TrainerRecord
        subscription = pickActiveSubscription(subs)
    } else if (e1 && e1.message?.includes('onboarding_state')) {
        const { data: t2 } = await supabase
            .from('trainers')
            .select(
                'id, name, email, avatar_url, theme, ai_prescriptions_enabled, ' +
                'subscriptions(status, current_period_end, cancel_at_period_end, stripe_customer_id, created_at)'
            )
            .eq('auth_user_id', authUserId)
            .single()
        if (t2) {
            const { subscriptions: subs, ...rest } = t2 as any
            trainer = { ...rest, onboarding_state: DEFAULT_ONBOARDING_STATE } as TrainerRecord
            subscription = pickActiveSubscription(subs)
        }
    }

    if (!trainer) {
        // Trainer record doesn't exist — force logout
        await supabase.auth.signOut()
        redirect('/login')
    }

    const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

    if (!isActive) {
        redirect('/subscription/blocked')
    }

    return { trainer, subscription: subscription! }
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

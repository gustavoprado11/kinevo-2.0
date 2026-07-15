import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

type DBClient = SupabaseClient<Database>

/** Status de org que concedem acesso ao núcleo (espelha ACTIVE_STATUSES da IA). */
const ORG_ACTIVE = new Set(['active', 'trialing'])

/**
 * Regra ÚNICA de "billing da org concede acesso": active/trialing, ou past_due
 * dentro da janela grace_until. Compartilhada entre hasOrgCoreAccess e
 * getStudentScope para as duas superfícies nunca divergirem.
 */
export function isOrgBillingActive(status: string, graceUntil: string | null): boolean {
    if (ORG_ACTIVE.has(status)) return true
    return (
        status === 'past_due' &&
        !!graceUntil &&
        new Date(graceUntil).getTime() > Date.now()
    )
}

/**
 * Estúdios P1.1 — fonte ÚNICA do "acesso herdado ao núcleo".
 *
 * True quando o treinador é membro ATIVO de uma organização cujo billing está
 * ativo (active/trialing, ou past_due dentro da janela grace_until). NÃO consulta
 * getAiTier: concede apenas ACESSO ao núcleo (alunos ilimitados, sem read-only
 * lock), nunca tier de IA.
 *
 * Solo (sem linha em organization_members) → false → todo gate roda como hoje.
 * Funciona com admin client OU client RLS (o membro lê o próprio vínculo + a
 * própria org via org_members_member_read / organizations_member_read).
 */
export async function hasOrgCoreAccess(client: DBClient, trainerId: string): Promise<boolean> {
    // Never-throw: erro de infra aqui não pode derrubar get-trainer nem os
    // gates de cap — sem confirmação de org ativa, cai no fluxo solo (false).
    let data: unknown
    try {
        const res = await client
            .from('organization_members')
            .select('organization:organizations(subscription_status, grace_until)')
            .eq('trainer_id', trainerId)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle()
        data = res.data
    } catch (err) {
        console.error('[hasOrgCoreAccess] lookup failed:', err)
        return false
    }

    if (!data) return false
    const rel = (data as { organization: unknown }).organization
    const org = (Array.isArray(rel) ? rel[0] : rel) as
        | { subscription_status: string; grace_until: string | null }
        | null
        | undefined
    if (!org) return false

    return isOrgBillingActive(org.subscription_status, org.grace_until)
}

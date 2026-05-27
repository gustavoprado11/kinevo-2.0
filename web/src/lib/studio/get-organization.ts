import { createClient } from '@/lib/supabase/server'

export type OrgRole = 'owner' | 'admin' | 'coach'

export interface OrganizationContext {
    organization: {
        id: string
        name: string
        logo_url: string | null
        visibility: 'open' | 'restricted'
        seat_limit: number | null
        subscription_status: string
    }
    membership: {
        id: string
        role: OrgRole
        is_coach: boolean
    }
    trainerId: string
    /** owner ou admin */
    isManager: boolean
}

/**
 * Resolve o contexto de academia (org) do treinador autenticado.
 * Retorna null se o usuário não pertence a nenhuma academia (conta solo).
 *
 * Usa o client com RLS: o membro consegue ler a própria org e o próprio vínculo
 * (policies organizations_member_read / org_members_member_read da 157).
 */
export async function getOrganizationContext(): Promise<OrganizationContext | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return null

    const trainerId = (trainer as { id: string }).id

    // Vínculo ativo + dados da org (uma org por treinador na v1)
    const { data: member } = await supabase
        .from('organization_members')
        // @ts-ignore - tipos do projeto ainda não incluem as tabelas de estúdio
        .select('id, role, is_coach, organization:organizations(id, name, logo_url, visibility, seat_limit, subscription_status)')
        // @ts-ignore
        .eq('trainer_id', trainerId)
        // @ts-ignore
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

    if (!member) return null

    const m = member as any
    const org = Array.isArray(m.organization) ? m.organization[0] : m.organization
    if (!org) return null

    return {
        organization: org,
        membership: { id: m.id, role: m.role, is_coach: m.is_coach },
        trainerId,
        isManager: m.role === 'owner' || m.role === 'admin',
    }
}

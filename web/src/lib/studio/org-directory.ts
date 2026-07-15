import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

/**
 * Diretório de membros da org via RPC get_org_members_directory (migration 252).
 *
 * Existe porque a 225 fechou de propósito a leitura cross-membro de `trainers`
 * — nomes/avatars dos colegas saem por este RPC (SECURITY DEFINER, gate
 * is_org_member), nunca por policy na tabela.
 *
 * Handle destipado isolado (mesmo padrão de conversations.ts): o RPC entra nos
 * tipos gerados no próximo gen:types; este wrapper mantém o resto do código
 * tipado.
 */
export interface OrgMemberDirectoryEntry {
    trainer_id: string
    name: string
    email: string
    avatar_url: string | null
    role: 'owner' | 'admin' | 'coach'
    status: 'active' | 'inactive'
    is_coach: boolean
}

export async function getOrgMembersDirectory(
    client: SupabaseClient<Database>,
    orgId: string,
): Promise<OrgMemberDirectoryEntry[]> {
    const untyped = client as unknown as SupabaseClient
    const { data, error } = await untyped.rpc('get_org_members_directory', { p_org: orgId })
    if (error || !data) {
        if (error) console.error('[getOrgMembersDirectory] rpc falhou:', error)
        return []
    }
    return data as OrgMemberDirectoryEntry[]
}

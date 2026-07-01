'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Cria um estúdio (organization) e vincula o criador como owner ativo.
 *
 * Estúdios P1.1: a org nasce em 'trialing' (o billing real por seat entra na
 * P1.5). `seat_limit` fica null (ilimitado) no piloto. Usa admin client porque
 * as linhas ainda não existem para a RLS do criador enxergar antes do vínculo.
 *
 * NOTA (§7 do PLANO): a exposição self-serve desta action na UI depende da
 * decisão de onboarding do estúdio. Até lá pode ser disparada por
 * provisionamento manual/piloto.
 */
export async function createOrganization(data: { name: string }) {
    try {
        const name = data.name?.trim()
        if (!name) return { success: false, error: 'Nome do estúdio é obrigatório' }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Não autenticado' }

        const { data: trainer } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()
        if (!trainer) return { success: false, error: 'Treinador não encontrado' }
        const trainerId = (trainer as { id: string }).id

        // Uma org por treinador na v1.
        const { data: existing } = await supabaseAdmin
            .from('organization_members')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('status', 'active')
            .maybeSingle()
        if (existing) return { success: false, error: 'Você já pertence a um estúdio' }

        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({ name, subscription_status: 'trialing' })
            .select('id')
            .single()
        if (orgError || !org) {
            console.error('Error creating organization:', orgError)
            return { success: false, error: 'Erro ao criar o estúdio' }
        }
        const organizationId = (org as { id: string }).id

        const { error: memberError } = await supabaseAdmin
            .from('organization_members')
            .insert({
                organization_id: organizationId,
                trainer_id: trainerId,
                role: 'owner',
                is_coach: true,
                status: 'active',
                joined_at: new Date().toISOString(),
            })
        if (memberError) {
            console.error('Error creating owner membership:', memberError)
            // rollback best-effort da org órfã
            await supabaseAdmin.from('organizations').delete().eq('id', organizationId)
            return { success: false, error: 'Erro ao vincular você ao estúdio' }
        }

        revalidatePath('/estudio')
        revalidatePath('/settings')
        return { success: true, organizationId }
    } catch (error) {
        console.error('Unexpected error in createOrganization:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao criar o estúdio' }
    }
}

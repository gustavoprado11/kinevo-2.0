'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Ciclo de vida de um coach na academia (gestor only):
 *   - deactivate: revoga o acesso herdado (status='inactive'); dados preservados.
 *   - reactivate: status='active' (respeita seat_limit).
 *   - set_role:   troca role entre 'coach' e 'admin'.
 *
 * Protege o responsável: nunca desativa nem rebaixa quem é 'owner'.
 */
export async function updateCoachStatus(data: {
    trainerId: string
    action: 'deactivate' | 'reactivate' | 'set_role'
    role?: 'coach' | 'admin'
}) {
    try {
        const ctx = await getOrganizationContext()
        if (!ctx) return { success: false, error: 'Você não pertence a uma academia' }
        if (!ctx.isManager) return { success: false, error: 'Apenas o gestor pode gerenciar coaches' }

        const { data: member } = await supabaseAdmin
            .from('organization_members')
            .select('id, role, status')
            .eq('organization_id', ctx.organization.id)
            .eq('trainer_id', data.trainerId)
            .maybeSingle()
        if (!member) return { success: false, error: 'Coach não encontrado nesta academia' }
        const m = member as { id: string; role: string; status: string }

        if (m.role === 'owner') {
            return { success: false, error: 'O responsável pela academia não pode ser alterado aqui' }
        }

        if (data.action === 'deactivate') {
            // Estúdios v1: coach ainda responsável por alunos da org não sai —
            // reatribua antes (coach_id nunca fica NULL: o app do aluno resolve
            // chat/branding/sessões por ele).
            const { count: responsibleCount } = await supabaseAdmin
                .from('students')
                .select('id', { count: 'exact', head: true })
                .eq('coach_id', data.trainerId)
                .eq('organization_id', ctx.organization.id)
                .eq('is_trainer_profile', false)
            if ((responsibleCount ?? 0) > 0) {
                return {
                    success: false,
                    error: `Este treinador ainda é responsável por ${responsibleCount} aluno(s) do estúdio. Reatribua-os antes de desativar.`,
                }
            }
            await supabaseAdmin
                .from('organization_members')
                .update({ status: 'inactive' })
                .eq('id', m.id)
        } else if (data.action === 'reactivate') {
            if (ctx.organization.seat_limit != null) {
                const { count } = await supabaseAdmin
                    .from('organization_members')
                    .select('id', { count: 'exact', head: true })
                    .eq('organization_id', ctx.organization.id)
                    .eq('status', 'active')
                if ((count ?? 0) >= ctx.organization.seat_limit) {
                    return { success: false, error: 'Limite de assentos da academia atingido.' }
                }
            }
            await supabaseAdmin
                .from('organization_members')
                .update({ status: 'active' })
                .eq('id', m.id)
        } else if (data.action === 'set_role') {
            if (data.role !== 'coach' && data.role !== 'admin') {
                return { success: false, error: 'Role inválido' }
            }
            await supabaseAdmin
                .from('organization_members')
                .update({ role: data.role })
                .eq('id', m.id)
        } else {
            return { success: false, error: 'Ação inválida' }
        }

        revalidatePath('/settings')
        revalidatePath('/estudio')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error in updateCoachStatus:', error)
        return { success: false, error: 'Ocorreu um erro inesperado' }
    }
}

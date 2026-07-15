'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Estúdios v1 — troca o treinador RESPONSÁVEL (students.coach_id) de um aluno
 * do estúdio.
 *
 * Pode reatribuir: o gestor (owner/admin) ou o próprio responsável atual.
 * Alvo válido: membro ATIVO da mesma org com is_coach=true.
 *
 * coach_id NUNCA vira NULL — o app do aluno resolve chat, branding e a
 * atribuição de sessões por ele. Reatribuir move essas superfícies para o novo
 * responsável automaticamente (o chat é keyed em students.coach_id).
 */
export async function reassignStudent(data: { studentId: string; newCoachId: string }) {
    try {
        const ctx = await getOrganizationContext()
        if (!ctx) return { success: false, error: 'Você não pertence a um estúdio' }

        const { data: studentRow } = await supabaseAdmin
            .from('students')
            .select('id, name, coach_id, organization_id')
            .eq('id', data.studentId)
            .maybeSingle()
        const student = studentRow as
            | { id: string; name: string; coach_id: string | null; organization_id: string | null }
            | null
        if (!student || student.organization_id !== ctx.organization.id) {
            return { success: false, error: 'Aluno não encontrado neste estúdio' }
        }

        const isResponsible = student.coach_id === ctx.trainerId
        if (!ctx.isManager && !isResponsible) {
            return { success: false, error: 'Apenas o gestor ou o treinador responsável podem reatribuir' }
        }

        if (data.newCoachId === student.coach_id) {
            return { success: false, error: 'O aluno já é deste treinador' }
        }

        const { data: target } = await supabaseAdmin
            .from('organization_members')
            .select('trainer_id, is_coach, status')
            .eq('organization_id', ctx.organization.id)
            .eq('trainer_id', data.newCoachId)
            .eq('status', 'active')
            .maybeSingle()
        const targetMember = target as { trainer_id: string; is_coach: boolean } | null
        if (!targetMember || !targetMember.is_coach) {
            return { success: false, error: 'O novo responsável precisa ser um treinador ativo do estúdio' }
        }

        const { error } = await supabaseAdmin
            .from('students')
            .update({ coach_id: data.newCoachId })
            .eq('id', data.studentId)
            .eq('organization_id', ctx.organization.id)
        if (error) {
            console.error('[reassignStudent] update falhou:', error)
            return { success: false, error: 'Erro ao reatribuir o aluno' }
        }

        revalidatePath('/students')
        revalidatePath(`/students/${data.studentId}`)
        revalidatePath('/estudio')
        return { success: true }
    } catch (error) {
        console.error('Unexpected error in reassignStudent:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao reatribuir' }
    }
}

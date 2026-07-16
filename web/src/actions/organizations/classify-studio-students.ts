'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOrganizationContext } from '@/lib/studio/get-organization'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { PRIVATE_STUDENT_REQUIRES_PLAN_ERROR } from '@/lib/limits/student-cap'
import { studioLimitForOrg } from '@/lib/studio/studio-tiers'

export type StudentDestination = 'studio' | 'private'

/**
 * Entrada no estúdio — classificação da carteira PRÉ-EXISTENTE do coach.
 *
 * Quando um coach com alunos entra num estúdio, os alunos criados ANTES do
 * vínculo ficam com organization_id null e is_private false ("não
 * classificados": o trigger derive só roda no INSERT). Este action resolve o
 * limbo, aluno a aluno, por decisão do PRÓPRIO coach (não do gestor):
 *   - 'studio'  → organization_id = org (compartilhado; entra no cap da faixa)
 *   - 'private' → is_private = true (carteira pessoal; exige plano solo PAGO)
 *
 * Gates (mesmas regras da criação):
 *   - qualquer 'private' → plano solo pago do coach (Gratuito não vale);
 *   - o lote 'studio' não pode estourar o cap da faixa da org.
 *
 * Os UPDATEs rodam via service_role (o guard de posse da 252/261 torna
 * organization_id/is_private imutáveis para authenticated — por design).
 */
export async function classifyStudioStudents(data: {
    assignments: Array<{ studentId: string; destination: StudentDestination }>
}) {
    try {
        const assignments = data.assignments ?? []
        if (assignments.length === 0) return { success: false, error: 'Nada para classificar' }
        if (assignments.length > 500) return { success: false, error: 'Lote grande demais' }

        const ctx = await getOrganizationContext()
        if (!ctx) return { success: false, error: 'Você não pertence a um estúdio' }

        // Valida o conjunto: só alunos MEUS, ainda não classificados.
        const ids = assignments.map(a => a.studentId)
        const { data: rows, error: fetchError } = await supabaseAdmin
            .from('students')
            .select('id, coach_id, organization_id, is_private, is_trainer_profile')
            .in('id', ids)
        if (fetchError || !rows) return { success: false, error: 'Erro ao carregar os alunos' }

        const byId = new Map(
            (rows as Array<{ id: string; coach_id: string | null; organization_id: string | null; is_private: boolean; is_trainer_profile: boolean | null }>).map(r => [r.id, r]),
        )
        for (const a of assignments) {
            const s = byId.get(a.studentId)
            if (!s) return { success: false, error: 'Aluno não encontrado' }
            if (s.coach_id !== ctx.trainerId) return { success: false, error: 'Só é possível classificar os seus próprios alunos' }
            if (s.organization_id !== null || s.is_private) return { success: false, error: 'Aluno já classificado — recarregue a página' }
            if (s.is_trainer_profile) return { success: false, error: 'O perfil de teste não precisa ser classificado' }
        }

        const privateIds = assignments.filter(a => a.destination === 'private').map(a => a.studentId)
        const studioIds = assignments.filter(a => a.destination === 'studio').map(a => a.studentId)

        // Gate 1: particular exige plano solo pago do coach.
        if (privateIds.length > 0) {
            const tier = await getAiTierForTrainer(supabaseAdmin, ctx.trainerId)
            if (tier === 'free') {
                return { success: false, code: 'student_cap_reached', error: PRIVATE_STUDENT_REQUIRES_PLAN_ERROR }
            }
        }

        // Gate 2: o lote do estúdio não pode estourar o cap da faixa.
        if (studioIds.length > 0) {
            const limit = studioLimitForOrg(ctx.organization.plan_tier)
            if (Number.isFinite(limit)) {
                const { count } = await supabaseAdmin
                    .from('students')
                    .select('id', { count: 'exact', head: true })
                    .eq('organization_id', ctx.organization.id)
                    .eq('is_trainer_profile', false)
                if ((count ?? 0) + studioIds.length > limit) {
                    return {
                        success: false,
                        code: 'student_cap_reached',
                        error: `Trazer ${studioIds.length} aluno(s) estouraria o limite de ${limit} da faixa atual do estúdio. Faça upgrade da faixa ou marque alguns como particulares.`,
                    }
                }
            }
        }

        // Aplica (service_role; o guard de posse é isento para service_role).
        if (studioIds.length > 0) {
            const { error } = await supabaseAdmin
                .from('students')
                .update({ organization_id: ctx.organization.id })
                .in('id', studioIds)
            if (error) return { success: false, error: 'Erro ao vincular os alunos ao estúdio' }
        }
        if (privateIds.length > 0) {
            const { error } = await supabaseAdmin
                .from('students')
                .update({ is_private: true })
                .in('id', privateIds)
            if (error) return { success: false, error: 'Erro ao marcar os alunos como particulares' }
        }

        revalidatePath('/students')
        revalidatePath('/estudio')
        return { success: true, studio: studioIds.length, private: privateIds.length }
    } catch (error) {
        console.error('[classifyStudioStudents] erro:', error)
        return { success: false, error: 'Ocorreu um erro inesperado' }
    }
}

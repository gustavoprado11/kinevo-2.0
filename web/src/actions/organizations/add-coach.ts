'use server'

import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Adiciona um coach à academia. Dois caminhos:
 *   - Já existe um treinador com esse email → vincula como membro (coach).
 *   - Não existe → cria conta de treinador (auth + trainers) e vincula.
 *
 * Autorização: apenas gestor (owner/admin).
 *
 * NOTA (M5): coach recém-criado não tem assinatura solo; o gate de assinatura
 * atual (getTrainerWithSubscription) bloquearia o login. O gating por org (seat
 * da academia) substitui isso no M5. Até lá, validar acesso do coach manualmente.
 */
export async function addCoach(data: {
    name: string
    email: string
    role?: 'coach' | 'admin'
}) {
    try {
        const name = data.name?.trim()
        const email = data.email?.trim().toLowerCase()
        if (!name || !email) return { success: false, error: 'Nome e email são obrigatórios' }

        const ctx = await getOrganizationContext()
        if (!ctx) return { success: false, error: 'Você não pertence a uma academia' }
        if (!ctx.isManager) return { success: false, error: 'Apenas o gestor pode adicionar coaches' }

        // 1. Treinador já existe?
        const { data: existingTrainer } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('email', email)
            .maybeSingle()

        let trainerId: string
        let generatedPassword: string | null = null

        if (existingTrainer) {
            trainerId = (existingTrainer as { id: string }).id
        } else {
            // 2. Criar conta de treinador
            generatedPassword = crypto.randomBytes(8).toString('base64url')
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: generatedPassword,
                email_confirm: true,
                user_metadata: { name, role: 'trainer' },
            })
            if (authError || !authUser?.user) {
                console.error('Error creating coach auth user:', authError)
                return { success: false, error: authError?.message ?? 'Erro ao criar acesso do coach' }
            }

            const { data: trainerRow, error: trainerError } = await supabaseAdmin
                .from('trainers')
                // @ts-ignore - insert mínimo
                .insert({ auth_user_id: authUser.user.id, name, email })
                .select('id')
                .single()

            if (trainerError || !trainerRow) {
                console.error('Error creating trainer record:', trainerError)
                await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
                return { success: false, error: 'Erro ao criar o cadastro do coach' }
            }
            trainerId = (trainerRow as { id: string }).id
        }

        // 3. Já é membro?
        const { data: existingMember } = await supabaseAdmin
            .from('organization_members')
            // @ts-ignore - tipos do projeto ainda não incluem as tabelas de estúdio
            .select('id, status')
            .eq('organization_id', ctx.organization.id)
            .eq('trainer_id', trainerId)
            .maybeSingle()

        if (existingMember) {
            // reativa se estava inativo
            await supabaseAdmin
                .from('organization_members')
                // @ts-ignore
                .update({ status: 'active', role: data.role ?? 'coach', is_coach: true })
                .eq('id', (existingMember as { id: string }).id)
        } else {
            const { error: memberError } = await supabaseAdmin
                .from('organization_members')
                // @ts-ignore
                .insert({
                    organization_id: ctx.organization.id,
                    trainer_id: trainerId,
                    role: data.role ?? 'coach',
                    is_coach: true,
                    status: 'active',
                    invited_email: email,
                    joined_at: new Date().toISOString(),
                })
            if (memberError) {
                console.error('Error linking coach to organization:', memberError)
                return { success: false, error: 'Erro ao vincular o coach à academia' }
            }
        }

        revalidatePath('/studio')
        return { success: true, trainerId, email, password: generatedPassword, name }
    } catch (error) {
        console.error('Unexpected error in addCoach:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao adicionar o coach' }
    }
}

'use server'

import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { getOrganizationContext } from '@/lib/studio/get-organization'

/**
 * Adiciona um coach à academia. Dois caminhos:
 *   - Já existe um treinador com esse email → vincula como membro (coach).
 *   - Não existe → CONVIDA por e-mail (Supabase inviteUserByEmail): o coach
 *     recebe o link, define a própria senha em /auth/update-password e entra.
 *     Se o envio falhar (SMTP/rate limit), cai no fallback antigo: conta com
 *     senha gerada que o gestor repassa (CredentialBanner).
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
        if (!ctx) return { success: false, error: 'Você não pertence a um estúdio' }
        if (!ctx.isManager) return { success: false, error: 'Apenas o gestor pode adicionar treinadores' }

        // 1. Treinador já existe?
        const { data: existingTrainer } = await supabaseAdmin
            .from('trainers')
            .select('id')
            .eq('email', email)
            .maybeSingle()

        let trainerId: string
        let generatedPassword: string | null = null
        let invited = false

        if (existingTrainer) {
            trainerId = (existingTrainer as { id: string }).id
        } else {
            // 2. Convite por e-mail (preferido): cria o auth user SEM senha e o
            //    Supabase envia o link; o coach define a senha no destino padrão
            //    do fluxo de recovery. SEMPRE www (kinevoapp.com sem www dá 307).
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.kinevoapp.com'
            let authUserId: string | null = null

            const { data: invitedUser, error: inviteError } =
                await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                    data: { name, role: 'trainer' },
                    redirectTo: `${appUrl}/auth/update-password`,
                })

            if (!inviteError && invitedUser?.user) {
                authUserId = invitedUser.user.id
                invited = true
            } else {
                // Fallback: conta com senha gerada, repassada pelo gestor.
                console.error('inviteUserByEmail falhou — caindo para senha gerada:', inviteError)
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
                authUserId = authUser.user.id
            }

            const { data: trainerRow, error: trainerError } = await supabaseAdmin
                .from('trainers')
                .insert({ auth_user_id: authUserId, name, email })
                .select('id')
                .single()

            if (trainerError || !trainerRow) {
                console.error('Error creating trainer record:', trainerError)
                await supabaseAdmin.auth.admin.deleteUser(authUserId)
                return { success: false, error: 'Erro ao criar o cadastro do coach' }
            }
            trainerId = (trainerRow as { id: string }).id
        }

        // 3. Já é membro?
        const { data: existingMember } = await supabaseAdmin
            .from('organization_members')
            .select('id, status')
            .eq('organization_id', ctx.organization.id)
            .eq('trainer_id', trainerId)
            .maybeSingle()

        if (existingMember) {
            // reativa se estava inativo
            await supabaseAdmin
                .from('organization_members')
                .update({ status: 'active', role: data.role ?? 'coach', is_coach: true })
                .eq('id', (existingMember as { id: string }).id)
        } else {
            // Seat gate: não estoura o seat_limit ao criar um novo assento.
            if (ctx.organization.seat_limit != null) {
                const { count } = await supabaseAdmin
                    .from('organization_members')
                    .select('id', { count: 'exact', head: true })
                    .eq('organization_id', ctx.organization.id)
                    .eq('status', 'active')
                if ((count ?? 0) >= ctx.organization.seat_limit) {
                    return { success: false, error: 'Limite de assentos do estúdio atingido.' }
                }
            }
            const { error: memberError } = await supabaseAdmin
                .from('organization_members')
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
                return { success: false, error: 'Erro ao vincular o treinador ao estúdio' }
            }
        }

        revalidatePath('/estudio')
        return { success: true, trainerId, email, password: generatedPassword, invited, name }
    } catch (error) {
        console.error('Unexpected error in addCoach:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao adicionar o coach' }
    }
}

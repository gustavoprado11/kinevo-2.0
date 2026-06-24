/**
 * Criação de aluno — núcleo compartilhado (server-only, SEM 'use server').
 *
 * createStudentCore recebe o trainerId já resolvido e cria a conta de auth + a
 * linha de students + notifica o treinador (push). A action createStudent vira
 * wrapper de auth + revalidatePath; convertLeadToStudentCore e a tool MCP
 * chamam o core direto. NÃO chama revalidatePath (responsabilidade do wrapper).
 */

import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { insertTrainerNotification } from '@/lib/trainer-notifications'
import { sendTrainerPush } from '@/lib/push-notifications'
import { getAiTierForTrainer } from '@/lib/auth/get-ai-tier'
import { assertCanCreateStudent, StudentCapError } from '@/lib/limits/student-cap'

export interface CreateStudentInput {
    name: string
    email: string
    phone: string
    modality: 'online' | 'presential'
}

export interface CreateStudentResult {
    success: boolean
    error?: string
    /** Código de erro estável (ex.: 'student_cap_reached') p/ a UI rotear o upsell. */
    code?: string
    studentId?: string
    email?: string
    password?: string
    name?: string
    whatsapp?: string
}

export async function createStudentCore(
    trainerId: string,
    data: CreateStudentInput,
): Promise<CreateStudentResult> {
    try {
        // Gate de limite de alunos por tier (Free = 1; pago = ilimitado).
        // Cobre a action createStudent E convertLeadToStudentCore (que chama o core).
        try {
            const tier = await getAiTierForTrainer(supabaseAdmin, trainerId)
            await assertCanCreateStudent(supabaseAdmin, trainerId, tier)
        } catch (capError) {
            if (capError instanceof StudentCapError) {
                // `code` deixa a UI distinguir o muro de monetização (cap do Free) de
                // um erro genérico → mostra o CTA de upgrade direto pro checkout.
                return { success: false, error: capError.message, code: capError.code }
            }
            throw capError
        }

        // Senha gerada de forma criptograficamente segura
        const generatedPassword = crypto.randomBytes(8).toString('base64url')

        // Cria o usuário de auth (service_role)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: generatedPassword,
            email_confirm: true,
            user_metadata: {
                name: data.name,
                phone: data.phone,
                role: 'student',
            },
        })

        if (authError) {
            console.error('[createStudentCore] auth error:', authError)
            return { success: false, error: authError.message }
        }

        const userId = authUser.user.id

        // Insere o registro de aluno (service_role)
        const { data: studentRow, error: dbError } = await supabaseAdmin
            .from('students')
            .insert({
                auth_user_id: userId,
                coach_id: trainerId,
                name: data.name.trim(),
                email: data.email.trim().toLowerCase(),
                phone: data.phone,
                modality: data.modality,
                status: 'active',
            })
            .select('id')
            .single()

        if (dbError) {
            console.error('[createStudentCore] DB error:', dbError)
            await supabaseAdmin.auth.admin.deleteUser(userId)
            return { success: false, error: 'Erro ao salvar dados do aluno no banco de dados' }
        }

        const studentId = (studentRow as { id: string }).id

        // Notifica o treinador (fire-and-forget)
        insertTrainerNotification({
            trainerId,
            type: 'new_student',
            title: 'Novo aluno vinculado',
            message: `${data.name.trim()} foi adicionado à sua lista.`,
            metadata: { student_id: studentId, student_name: data.name.trim() },
        }).then((notifId) => {
            sendTrainerPush({
                trainerId,
                type: 'new_student',
                title: 'Novo aluno vinculado',
                body: `${data.name.trim()} foi adicionado à sua lista.`,
                notificationId: notifId ?? undefined,
                data: { type: 'new_student', student_id: studentId },
            })
        })

        return {
            success: true,
            studentId,
            email: data.email,
            password: generatedPassword,
            name: data.name,
            whatsapp: data.phone,
        }
    } catch (error) {
        console.error('[createStudentCore] unexpected error:', error)
        return { success: false, error: 'Ocorreu um erro inesperado ao criar o aluno' }
    }
}

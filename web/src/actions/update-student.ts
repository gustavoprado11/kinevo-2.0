'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getStudentScope, assertStudentAccess } from '@/lib/studio/student-scope'

interface UpdateStudentInput {
    studentId: string
    name: string
    email: string
    phone?: string
    modality?: string | null
    /** FCmáx (bpm) — resolve as zonas da prescrição aeróbia. Null limpa. */
    maxHeartRateBpm?: number | null
}

interface UpdateStudentResult {
    success: boolean
    error?: string
    student?: Record<string, unknown>
}

function mapAuthUpdateError(message: string): string {
    if (/already been registered|already registered|already exists/i.test(message)) {
        return 'Este e-mail já está em uso por outra conta.'
    }
    if (/invalid.*email/i.test(message)) {
        return 'E-mail inválido.'
    }
    return 'Não foi possível atualizar o e-mail de acesso do aluno.'
}

/**
 * Atualiza os dados do aluno e, quando o e-mail muda, sincroniza o e-mail de
 * LOGIN junto (D2/AC7): o modelo do Kinevo é trainer-managed — o treinador
 * cria a conta do aluno — e o update client-side antigo só tocava
 * `students.email`, deixando o aluno logando para sempre no e-mail velho e
 * quebrando o dedup de conversão de leads.
 */
export async function updateStudent(
    input: UpdateStudentInput,
): Promise<UpdateStudentResult> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autorizado' }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) return { success: false, error: 'Treinador não encontrado' }

    const name = input.name.trim()
    if (!name) return { success: false, error: 'Informe o nome do aluno.' }
    const email = input.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: 'E-mail inválido.' }
    }
    if (
        input.maxHeartRateBpm != null &&
        (!Number.isInteger(input.maxHeartRateBpm) || input.maxHeartRateBpm < 100 || input.maxHeartRateBpm > 230)
    ) {
        return { success: false, error: 'FCmáx deve ser um inteiro entre 100 e 230 bpm.' }
    }

    // Escopo (solo dono OU membro do estúdio) antes de qualquer op privilegiada.
    const scope = await getStudentScope(trainer.id)
    if (!(await assertStudentAccess(supabase, scope, input.studentId))) {
        return { success: false, error: 'Aluno não encontrado' }
    }
    const { data: existing } = await supabaseAdmin
        .from('students')
        .select('id, email, auth_user_id')
        .eq('id', input.studentId)
        .single()
    if (!existing) return { success: false, error: 'Aluno não encontrado' }

    const emailChanged = email !== (existing.email ?? '').toLowerCase()
    if (emailChanged && existing.auth_user_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            existing.auth_user_id,
            { email, email_confirm: true },
        )
        if (authError) {
            return { success: false, error: mapAuthUpdateError(authError.message) }
        }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('students')
        .update({
            name,
            email,
            phone: input.phone?.trim() || null,
            modality: input.modality ?? null,
            // Só toca a FCmáx quando o caller a envia (undefined preserva).
            ...(input.maxHeartRateBpm !== undefined
                ? { max_heart_rate_bpm: input.maxHeartRateBpm }
                : {}),
        } as never)
        .eq('id', existing.id)
        .select()
        .single()

    if (updateError) {
        console.error('[updateStudent] update error:', updateError)
        return { success: false, error: 'Erro ao salvar as alterações do aluno.' }
    }

    revalidatePath('/students')
    revalidatePath(`/students/${existing.id}`)
    return { success: true, student: updated as Record<string, unknown> }
}

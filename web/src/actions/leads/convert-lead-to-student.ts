'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createStudent } from '@/actions/create-student'

export interface ConvertLeadResult {
    success: boolean
    message?: string
    studentId?: string
    /** true quando o aluno já existia (vínculo) — não há credenciais novas. */
    alreadyExisted?: boolean
    /** Credenciais geradas (só quando uma conta nova foi criada). */
    credentials?: {
        name: string
        email: string
        password: string
        whatsapp: string | null
    }
}

/**
 * Converte um lead em aluno (M5).
 *
 *   Caminho "cortesia": cria o aluno SEM contrato (status active). O trainer
 *   vincula billing depois, no perfil do aluno, se quiser.
 *
 *   Dedup: se já existe um aluno com o mesmo e-mail sob esse trainer, vincula
 *   o lead a ele em vez de criar conta duplicada (e-mail é único no auth).
 *
 *   Idempotente: lead já convertido (converted_to_student_id setado) retorna
 *   o vínculo existente sem recriar nada.
 */
export async function convertLeadToStudent(
    leadId: string,
    opts: { modality: 'online' | 'presential' },
): Promise<ConvertLeadResult> {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { success: false, message: 'Sessão expirada.' }
    }

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) {
        return { success: false, message: 'Treinador não encontrado.' }
    }
    const trainerId = (trainer as { id: string }).id

    // Lead via RLS (garante ownership). select inclui o vínculo p/ idempotência.
    const { data: lead, error: leadError } = await supabase
        .from('trainer_leads')
        .select('id, name, email, whatsapp, status, converted_to_student_id')
        .eq('id', leadId)
        .single()
    if (leadError || !lead) {
        return { success: false, message: 'Lead não encontrado.' }
    }
    const row = lead as {
        id: string
        name: string
        email: string
        whatsapp: string
        status: string
        converted_to_student_id: string | null
    }

    // Já convertido → devolve o vínculo existente.
    if (row.converted_to_student_id) {
        return { success: true, studentId: row.converted_to_student_id, alreadyExisted: true }
    }

    const email = row.email.trim().toLowerCase()

    // Dedup: aluno existente com esse e-mail sob o mesmo trainer.
    const { data: existing } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('coach_id', trainerId)
        .eq('email', email)
        .maybeSingle()

    if (existing) {
        const existingId = (existing as { id: string }).id
        await markConverted(leadId, existingId)
        revalidatePath('/marketing/leads')
        revalidatePath('/marketing')
        return { success: true, studentId: existingId, alreadyExisted: true }
    }

    // Cria a conta (cortesia, sem contrato) reusando a action canônica.
    const created = await createStudent({
        name: row.name,
        email,
        phone: row.whatsapp,
        modality: opts.modality,
    })

    if (!created.success || !created.studentId) {
        return { success: false, message: created.error ?? 'Não foi possível criar o aluno.' }
    }

    await markConverted(leadId, created.studentId)
    revalidatePath('/marketing/leads')
    revalidatePath('/marketing')
    revalidatePath('/students')

    return {
        success: true,
        studentId: created.studentId,
        alreadyExisted: false,
        credentials: {
            name: created.name ?? row.name,
            email: created.email ?? email,
            password: created.password ?? '',
            whatsapp: created.whatsapp ?? row.whatsapp,
        },
    }
}

/** Marca o lead como convertido apontando pro aluno. Usa admin pra garantir
 *  o write mesmo que a policy de UPDATE evolua — ownership já foi validado. */
async function markConverted(leadId: string, studentId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from('trainer_leads')
        .update({
            status: 'converted',
            converted_to_student_id: studentId,
        } as never)
        .eq('id', leadId)
    if (error) {
        console.error('[convertLeadToStudent] markConverted error:', error)
    }
}

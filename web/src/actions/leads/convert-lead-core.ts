/**
 * Conversão de lead → aluno — núcleo compartilhado (server-only, SEM 'use server').
 *
 * convertLeadToStudentCore recebe o admin client + trainerId resolvido e:
 *   - valida ownership do lead via trainer_id explícito (admin bypassa RLS);
 *   - é idempotente (lead já convertido devolve o vínculo);
 *   - dedup por e-mail sob o mesmo trainer (vincula em vez de duplicar);
 *   - cria a conta de cortesia via createStudentCore (sem contrato).
 *
 * A action convertLeadToStudent vira wrapper de auth + revalidatePath; a tool
 * MCP chama o core direto. NÃO chama revalidatePath.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'
import { createStudentCore } from '@/actions/create-student-core'

type DBClient = SupabaseClient<Database>

export interface ConvertLeadResult {
    success: boolean
    message?: string
    studentId?: string
    alreadyExisted?: boolean
    credentials?: {
        name: string
        email: string
        password: string
        whatsapp: string | null
    }
}

export async function convertLeadToStudentCore(
    supabaseAdmin: DBClient,
    trainerId: string,
    leadId: string,
    opts: { modality: 'online' | 'presential' },
): Promise<ConvertLeadResult> {
    // Lead escopado por trainer_id (ownership explícito).
    const { data: lead, error: leadError } = await supabaseAdmin
        .from('trainer_leads')
        .select('id, name, email, whatsapp, status, converted_to_student_id')
        .eq('id', leadId)
        .eq('trainer_id', trainerId)
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
        await markConverted(supabaseAdmin, leadId, existingId)
        return { success: true, studentId: existingId, alreadyExisted: true }
    }

    // Cria a conta (cortesia, sem contrato) reusando o núcleo canônico.
    const created = await createStudentCore(trainerId, {
        name: row.name,
        email,
        phone: row.whatsapp,
        modality: opts.modality,
    })

    if (!created.success || !created.studentId) {
        return { success: false, message: created.error ?? 'Não foi possível criar o aluno.' }
    }

    await markConverted(supabaseAdmin, leadId, created.studentId)

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

/** Marca o lead como convertido apontando pro aluno (admin; ownership já validado). */
async function markConverted(supabaseAdmin: DBClient, leadId: string, studentId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from('trainer_leads')
        .update({
            status: 'converted',
            converted_to_student_id: studentId,
        } as never)
        .eq('id', leadId)
    if (error) {
        console.error('[convertLeadToStudentCore] markConverted error:', error)
    }
}

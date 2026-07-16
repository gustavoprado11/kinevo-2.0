/**
 * Formulários recorrentes — núcleo compartilhado (server-only, SEM 'use server').
 *
 * Cada função recebe um client Supabase + o trainerId JÁ RESOLVIDO (trainers.id)
 * e escopa toda operação por ele. A action ('use server') vira wrapper de auth
 * que resolve trainers.id a partir do auth uid; a tool MCP chama o core direto
 * com o admin client + trainerId do token OAuth.
 *
 * BUG corrigido (jun/2026): a versão anterior gravava trainer_id = user.id (auth
 * uid), mas form_schedules.trainer_id tem FK para trainers(id) — todo insert
 * falhava (tabela tinha 0 linhas). O núcleo agora grava o trainers.id correto e
 * escopa toggle/delete por trainer_id (admin client bypassa RLS).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@kinevo/shared/types/database'

type DBClient = SupabaseClient<Database>

/** Org ativa do treinador (Estúdios) — null se solo. Funciona com admin client. */
async function trainerActiveOrgId(supabase: DBClient, trainerId: string): Promise<string | null> {
    const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('trainer_id', trainerId)
        .eq('status', 'active')
        .maybeSingle()
    return (data as { organization_id: string | null } | null)?.organization_id ?? null
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface CreateScheduleInput {
    formTemplateId: string
    studentIds: string[]
    frequency: ScheduleFrequency
}

export interface FormScheduleRow {
    id: string
    student_id: string
    form_template_id: string
    frequency: ScheduleFrequency
    is_active: boolean
    next_due_at: string
    last_sent_at: string | null
    created_at: string
    form_template_title?: string
}

export async function createFormSchedulesCore(
    supabase: DBClient,
    trainerId: string,
    input: CreateScheduleInput,
): Promise<{ success: boolean; error?: string; count?: number }> {
    if (!input.formTemplateId || !input.studentIds?.length || !input.frequency) {
        return { success: false, error: 'Dados incompletos' }
    }

    // Isolamento de tenant: agenda para alunos DESTE treinador OU do estúdio dele
    // (Estúdios v1 — visibilidade open). Sem isso, conhecendo o UUID de um aluno de
    // outro tenant, daria pra criar agendamento cross-tenant.
    const orgId = await trainerActiveOrgId(supabase, trainerId)
    const { data: cand, error: ownErr } = await supabase
        .from('students')
        .select('id, coach_id, organization_id')
        .in('id', input.studentIds)
    if (ownErr) {
        console.error('[createFormSchedulesCore] ownership check error:', ownErr)
        return { success: false, error: 'Não foi possível agendar o formulário.' }
    }
    const validIds = (cand ?? [])
        .filter(s => s.coach_id === trainerId || (!!orgId && s.organization_id === orgId))
        .map(s => s.id)
    if (validIds.length === 0) {
        return { success: false, error: 'Nenhum aluno válido' }
    }

    const nextDue = computeNextDue(input.frequency, new Date())

    const rows = validIds.map(studentId => ({
        trainer_id: trainerId,
        student_id: studentId,
        form_template_id: input.formTemplateId,
        frequency: input.frequency,
        next_due_at: nextDue.toISOString(),
    }))

    const { data, error } = await supabase
        .from('form_schedules')
        .upsert(rows, {
            onConflict: 'student_id,form_template_id,frequency',
            ignoreDuplicates: false,
        })
        .select('id')

    if (error) {
        // M3: não vaza error.message cru (este core também serve o MCP externo).
        console.error('[createFormSchedulesCore] error:', error)
        return { success: false, error: 'Não foi possível agendar o formulário.' }
    }

    return { success: true, count: data?.length ?? 0 }
}

export async function getStudentFormSchedulesCore(
    supabase: DBClient,
    trainerId: string,
    studentId: string,
): Promise<FormScheduleRow[]> {
    // Gate de acesso ao aluno (este core pode ser chamado com admin client, que
    // bypassa RLS): responsável OU membro do estúdio do aluno.
    const orgId = await trainerActiveOrgId(supabase, trainerId)
    const { data: st } = await supabase
        .from('students')
        .select('coach_id, organization_id')
        .eq('id', studentId)
        .maybeSingle()
    const student = st as { coach_id: string | null; organization_id: string | null } | null
    if (!student) return []
    const canAccess = student.coach_id === trainerId || (!!orgId && student.organization_id === orgId)
    if (!canAccess) return []

    // Estúdio: mostra os agendamentos do aluno criados por QUALQUER treinador do
    // estúdio (não só os deste trainerId). Solo: só os próprios.
    let query = supabase
        .from('form_schedules')
        .select(`
            id,
            student_id,
            form_template_id,
            frequency,
            is_active,
            next_due_at,
            last_sent_at,
            created_at,
            form_templates!inner ( title )
        `)
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    if (!orgId) query = query.eq('trainer_id', trainerId)

    const { data, error } = await query

    if (error) {
        console.error('[getStudentFormSchedulesCore] error:', error)
        return []
    }

    type ScheduleRow = {
        id: string
        student_id: string
        form_template_id: string
        frequency: ScheduleFrequency
        is_active: boolean
        next_due_at: string
        last_sent_at: string | null
        created_at: string
        form_templates: { title: string } | { title: string }[] | null
    }

    return ((data ?? []) as unknown as ScheduleRow[]).map(row => {
        const tpl = Array.isArray(row.form_templates) ? row.form_templates[0] : row.form_templates
        return {
            id: row.id,
            student_id: row.student_id,
            form_template_id: row.form_template_id,
            frequency: row.frequency,
            is_active: row.is_active,
            next_due_at: row.next_due_at,
            last_sent_at: row.last_sent_at,
            created_at: row.created_at,
            form_template_title: tpl?.title ?? 'Formulário',
        }
    })
}

/**
 * Pode gerenciar (toggle/delete) este agendamento? Dono direto OU membro do
 * estúdio do aluno do agendamento (Estúdios v1 — open). Gate de app porque o
 * core roda com admin client.
 */
async function canManageSchedule(supabase: DBClient, trainerId: string, scheduleId: string): Promise<boolean> {
    const { data: sched } = await supabase
        .from('form_schedules')
        .select('student_id, trainer_id')
        .eq('id', scheduleId)
        .maybeSingle()
    const row = sched as { student_id: string; trainer_id: string } | null
    if (!row) return false
    if (row.trainer_id === trainerId) return true
    const orgId = await trainerActiveOrgId(supabase, trainerId)
    if (!orgId) return false
    const { data: st } = await supabase.from('students').select('organization_id').eq('id', row.student_id).maybeSingle()
    return (st as { organization_id: string | null } | null)?.organization_id === orgId
}

export async function toggleFormScheduleCore(
    supabase: DBClient,
    trainerId: string,
    scheduleId: string,
    isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
    if (!(await canManageSchedule(supabase, trainerId, scheduleId))) {
        return { success: false, error: 'Agendamento não encontrado' }
    }
    const { error } = await supabase
        .from('form_schedules')
        .update({ is_active: isActive })
        .eq('id', scheduleId)

    if (error) {
        console.error('[toggleFormScheduleCore] error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export async function deleteFormScheduleCore(
    supabase: DBClient,
    trainerId: string,
    scheduleId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!(await canManageSchedule(supabase, trainerId, scheduleId))) {
        return { success: false, error: 'Agendamento não encontrado' }
    }
    const { error } = await supabase
        .from('form_schedules')
        .delete()
        .eq('id', scheduleId)

    if (error) {
        console.error('[deleteFormScheduleCore] error:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export function computeNextDue(frequency: ScheduleFrequency, fromDate: Date): Date {
    const next = new Date(fromDate)
    switch (frequency) {
        case 'daily':
            next.setDate(next.getDate() + 1)
            break
        case 'weekly':
            next.setDate(next.getDate() + 7)
            break
        case 'biweekly':
            next.setDate(next.getDate() + 14)
            break
        case 'monthly':
            next.setMonth(next.getMonth() + 1)
            break
    }
    return next
}

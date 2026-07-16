import { supabaseAdmin } from '@/lib/supabase-admin'
import { expandAppointments } from '@kinevo/shared/utils/appointments-projection'
import type { RecurringAppointment, AppointmentException, AppointmentOccurrence } from '@kinevo/shared/types/appointments'

export interface OrgAgendaOccurrence extends AppointmentOccurrence {
    coachName: string
    studentName: string
}

/**
 * Agenda consolidada do estúdio — todas as ocorrências dos coaches ATIVOS da
 * org num range de datas (reusa a projeção pura expandAppointments; a agenda
 * continua PESSOAL para escrita — aqui é só a visão do gestor).
 *
 * Server-only, via admin client (as regras são de vários trainers — RLS é
 * por-trainer). A AUTORIZAÇÃO é do chamador: só a página do gestor
 * (requireManagerContext) chama isto.
 */
export async function getOrgAgenda(
    orgId: string,
    rangeStart: string, // "YYYY-MM-DD"
    rangeEnd: string,
): Promise<OrgAgendaOccurrence[]> {
    // 1. Coaches ativos + nomes
    const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('trainer_id, trainers(name)')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .eq('is_coach', true)
    const coachRows = (members ?? []) as Array<{ trainer_id: string; trainers: { name: string } | { name: string }[] | null }>
    if (coachRows.length === 0) return []
    const coachName = new Map<string, string>()
    for (const m of coachRows) {
        const t = Array.isArray(m.trainers) ? m.trainers[0] : m.trainers
        coachName.set(m.trainer_id, t?.name ?? '—')
    }
    const coachIds = [...coachName.keys()]

    // 2. Regras ativas dos coaches que tocam o range
    const { data: rulesRows } = await supabaseAdmin
        .from('recurring_appointments')
        .select('*')
        .in('trainer_id', coachIds)
        .eq('status', 'active')
        .lte('starts_on', rangeEnd)
        .or(`ends_on.is.null,ends_on.gte.${rangeStart}`)
    const rules = (rulesRows ?? []) as unknown as RecurringAppointment[]
    if (rules.length === 0) return []

    // 3. Exceções do range
    const ruleIds = rules.map(r => r.id)
    const { data: excRows } = await supabaseAdmin
        .from('appointment_exceptions')
        .select('*')
        .in('recurring_appointment_id', ruleIds)
        .or(`and(occurrence_date.gte.${rangeStart},occurrence_date.lte.${rangeEnd}),and(new_date.gte.${rangeStart},new_date.lte.${rangeEnd})`)
    const exceptions = (excRows ?? []) as unknown as AppointmentException[]

    // 4. Projeção pura (a mesma da agenda pessoal)
    const parse = (k: string) => {
        const [y, m, d] = k.split('-').map(Number)
        return new Date(Date.UTC(y, m - 1, d))
    }
    const occurrences = expandAppointments(rules, exceptions, parse(rangeStart), parse(rangeEnd))

    // 5. Nomes dos alunos
    const studentIds = [...new Set(occurrences.map(o => o.studentId))]
    const studentName = new Map<string, string>()
    if (studentIds.length > 0) {
        const { data: students } = await supabaseAdmin
            .from('students')
            .select('id, name')
            .in('id', studentIds)
        for (const s of (students ?? []) as Array<{ id: string; name: string }>) studentName.set(s.id, s.name)
    }

    return occurrences
        .map(o => ({
            ...o,
            coachName: coachName.get(o.trainerId) ?? '—',
            studentName: studentName.get(o.studentId) ?? '—',
        }))
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { listAppointmentsInRange } from '@/actions/appointments/list-appointments'
import { ScheduleClient } from './schedule-client'

export const metadata: Metadata = {
    title: 'Agenda — Kinevo',
    description: 'Calendário semanal de agendamentos',
}

/** YYYY-MM-DD key da data atual em America/Sao_Paulo. */
function todayDateKeyBR(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Retorna o domingo da semana que contém `dateKey` (YYYY-MM-DD). */
function weekStart(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dow = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - dow)
    return date.toISOString().slice(0, 10)
}

function addDays(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

export default async function SchedulePage() {
    const { trainer } = await getTrainerWithSubscription()

    const today = todayDateKeyBR()
    const start = weekStart(today)
    const end = addDays(start, 6)

    const occurrencesResult = await listAppointmentsInRange({
        rangeStart: start,
        rangeEnd: end,
    })

    // Students do trainer logado. Lista completa (ativos, não-trainer-profile)
    // pra popular autocomplete no modal de novo agendamento e também resolver
    // nomes/avatars nos cards.
    //
    // Usa `supabaseAdmin` (bypassa RLS) pelo mesmo motivo que `get-dashboard-data.ts`:
    // com o cliente RLS, alunos com flags específicas podem ser silenciosamente
    // filtrados. O filtro por `coach_id = trainer.id` substitui a proteção da RLS.
    const { data: allStudents } = await supabaseAdmin
        .from('students')
        .select('id, name, avatar_url')
        .eq('coach_id', trainer.id)
        .order('name', { ascending: true })

    const studentsList = (allStudents ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        avatarUrl: s.avatar_url ?? null,
    }))
    const studentsById: Record<string, { name: string; avatarUrl: string | null }> =
        Object.fromEntries(
            studentsList.map((s) => [s.id, { name: s.name, avatarUrl: s.avatarUrl }]),
        )

    return (
        <ScheduleClient
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
            initialWeekStart={start}
            initialOccurrences={occurrencesResult.data ?? []}
            initialStudentsById={studentsById}
            students={studentsList}
        />
    )
}

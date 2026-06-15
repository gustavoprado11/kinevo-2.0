import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { mcpSuccess, mcpError } from '../types'
import {
  listAppointmentsCore,
  createRecurringCore,
  rescheduleOccurrenceCore,
  cancelOccurrenceCore,
  markOccurrenceStatusCore,
  cancelRecurringCore,
} from '@/actions/appointments/core'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const TIME_HHMM = /^\d{2}:\d{2}$/

const DAY_LABEL_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Weekday (0=Sun … 6=Sat) of a YYYY-MM-DD date key, in UTC — same convention
 *  as the appointments core and the DB. */
function weekdayFromDateKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function registerAppointmentTools(server: McpServer, trainerId: string) {
  server.tool(
    'kinevo_list_appointments',
    "List the trainer's scheduled training sessions (agenda) within a date range, with student name, time, duration and status. Each occurrence already has reschedules/cancellations applied. Use for 'what do I have today / this week?'. recurring_appointment_id + the occurrence date are what you pass to reschedule/cancel/mark-status tools.",
    {
      range_start: z.string().regex(DATE_KEY).describe('Start of the range (inclusive), YYYY-MM-DD'),
      range_end: z.string().regex(DATE_KEY).describe('End of the range (inclusive), YYYY-MM-DD'),
    },
    { title: 'Ver agenda', readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ range_start, range_end }) => {
      const supabaseAdmin = createAdminClient()
      const result = await listAppointmentsCore(supabaseAdmin, trainerId, {
        rangeStart: range_start,
        rangeEnd: range_end,
      })
      if (!result.success) return mcpError(result.error ?? 'Erro ao listar agenda.')

      const occurrences = result.data ?? []

      // Enrich with student names (single query for all ids in the range).
      const studentIds = Array.from(new Set(occurrences.map(o => o.studentId)))
      const names = new Map<string, string>()
      if (studentIds.length > 0) {
        const { data: students } = await supabaseAdmin
          .from('students')
          .select('id, name')
          .in('id', studentIds)
        for (const s of students ?? []) names.set(s.id, s.name)
      }

      const appointments = occurrences
        .map(o => ({
          recurring_appointment_id: o.recurringAppointmentId,
          student_id: o.studentId,
          student_name: names.get(o.studentId) ?? null,
          date: o.date,
          occurrence_date: o.originalDate,
          start_time: o.startTime,
          duration_minutes: o.durationMinutes,
          status: o.status,
          was_rescheduled: o.date !== o.originalDate,
          notes: o.notes,
        }))
        .sort((a, b) => (a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)))

      return mcpSuccess({
        appointments,
        total: appointments.length,
        message: `${appointments.length} sessão(ões) entre ${range_start} e ${range_end}.`,
      })
    }
  )

  server.tool(
    'kinevo_create_appointment',
    "Schedule a training session for a student. Set frequency='once' for a single session, or 'weekly'/'biweekly'/'monthly' for a recurring routine that repeats on the weekday of starts_on. The student gets a reminder push and an inbox notification automatically. Overlapping sessions at the same time are allowed (group/duo classes).",
    {
      student_id: z.string().uuid().describe('The student this session is for'),
      starts_on: z.string().regex(DATE_KEY).describe('Date of the (first) session, YYYY-MM-DD. The weekday of this date is the recurring weekday.'),
      start_time: z.string().regex(TIME_HHMM).describe('Start time, HH:MM (24h)'),
      duration_minutes: z.number().int().min(15).max(240).default(60).describe('Session length in minutes'),
      frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']).default('weekly').describe("'once' = single session; otherwise repeats on the weekday of starts_on"),
      ends_on: z.string().regex(DATE_KEY).nullable().optional().describe('Optional end date for the routine (YYYY-MM-DD). Leave empty for an open-ended routine. Not allowed for frequency=once.'),
      notes: z.string().max(500).nullable().optional().describe('Optional note for this session/routine'),
    },
    { title: 'Agendar sessão', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ student_id, starts_on, start_time, duration_minutes, frequency, ends_on, notes }) => {
      const supabaseAdmin = createAdminClient()
      const result = await createRecurringCore(supabaseAdmin, trainerId, {
        studentId: student_id,
        dayOfWeek: weekdayFromDateKey(starts_on),
        startTime: start_time,
        durationMinutes: duration_minutes,
        frequency,
        startsOn: starts_on,
        endsOn: ends_on ?? null,
        notes: notes ?? null,
      })
      if (!result.success) return mcpError(result.error ?? 'Erro ao agendar sessão.')

      const freqLabel = frequency === 'once'
        ? `em ${starts_on}`
        : `toda ${DAY_LABEL_PT[weekdayFromDateKey(starts_on)]}${frequency === 'biweekly' ? ' (quinzenal)' : frequency === 'monthly' ? ' (mensal)' : ''}, a partir de ${starts_on}`
      return mcpSuccess({
        appointment: { id: result.data?.id, student_id, starts_on, start_time, frequency },
        message: `Sessão agendada ${freqLabel} às ${start_time}. O aluno foi notificado.`,
      })
    }
  )

  server.tool(
    'kinevo_reschedule_appointment',
    "Reschedule a scheduled session occurrence to a new date/time. scope='only_this' moves just that one occurrence; scope='this_and_future' ends the current routine and starts a new one from the new date (use when the recurring slot itself changed). The student is notified.",
    {
      recurring_appointment_id: z.string().uuid().describe('The routine ID (from kinevo_list_appointments)'),
      original_date: z.string().regex(DATE_KEY).describe('The current occurrence date being moved, YYYY-MM-DD (use the occurrence_date from the agenda)'),
      new_date: z.string().regex(DATE_KEY).describe('The new date, YYYY-MM-DD'),
      new_start_time: z.string().regex(TIME_HHMM).describe('The new start time, HH:MM'),
      scope: z.enum(['only_this', 'this_and_future']).default('only_this').describe("'only_this' = just this occurrence; 'this_and_future' = from now on"),
      notes: z.string().max(500).optional().describe('Optional note about the change'),
    },
    { title: 'Remarcar sessão', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ recurring_appointment_id, original_date, new_date, new_start_time, scope, notes }) => {
      const supabaseAdmin = createAdminClient()
      const result = await rescheduleOccurrenceCore(supabaseAdmin, trainerId, {
        recurringAppointmentId: recurring_appointment_id,
        originalDate: original_date,
        newDate: new_date,
        newStartTime: new_start_time,
        scope,
        notes,
      })
      if (!result.success) return mcpError(result.error ?? 'Erro ao remarcar sessão.')
      return mcpSuccess({
        rescheduled: { from: original_date, to: new_date, at: new_start_time, scope },
        new_recurring_appointment_id: result.data?.newRecurringAppointmentId ?? null,
        message: `Sessão remarcada de ${original_date} para ${new_date} às ${new_start_time}. O aluno foi notificado.`,
      })
    }
  )

  server.tool(
    'kinevo_cancel_appointment_occurrence',
    'Cancel a single scheduled session occurrence (not the whole routine). The student is notified. To end an entire recurring routine, use kinevo_cancel_appointment_series.',
    {
      recurring_appointment_id: z.string().uuid().describe('The routine ID (from kinevo_list_appointments)'),
      occurrence_date: z.string().regex(DATE_KEY).describe('The occurrence date to cancel, YYYY-MM-DD (use occurrence_date from the agenda)'),
      notes: z.string().max(500).optional().describe('Optional reason for the cancellation'),
    },
    { title: 'Cancelar ocorrência', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ recurring_appointment_id, occurrence_date, notes }) => {
      const supabaseAdmin = createAdminClient()
      const result = await cancelOccurrenceCore(supabaseAdmin, trainerId, {
        recurringAppointmentId: recurring_appointment_id,
        occurrenceDate: occurrence_date,
        notes,
      })
      if (!result.success) return mcpError(result.error ?? 'Erro ao cancelar ocorrência.')
      return mcpSuccess({
        canceled_occurrence: { recurring_appointment_id, occurrence_date },
        message: `Sessão de ${occurrence_date} cancelada. O aluno foi notificado.`,
      })
    }
  )

  server.tool(
    'kinevo_mark_appointment_status',
    "Mark a session occurrence as completed (the session happened) or no_show (student missed it). Use this to keep attendance accurate. This does not notify the student.",
    {
      recurring_appointment_id: z.string().uuid().describe('The routine ID (from kinevo_list_appointments)'),
      occurrence_date: z.string().regex(DATE_KEY).describe('The occurrence date, YYYY-MM-DD (use occurrence_date from the agenda)'),
      status: z.enum(['completed', 'no_show']).describe("'completed' = session happened; 'no_show' = student missed it"),
      notes: z.string().max(500).optional().describe('Optional note'),
    },
    { title: 'Marcar status da sessão', readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ recurring_appointment_id, occurrence_date, status, notes }) => {
      const supabaseAdmin = createAdminClient()
      const result = await markOccurrenceStatusCore(supabaseAdmin, trainerId, {
        recurringAppointmentId: recurring_appointment_id,
        occurrenceDate: occurrence_date,
        status,
        notes,
      })
      if (!result.success) return mcpError(result.error ?? 'Erro ao marcar status.')
      return mcpSuccess({
        occurrence: { recurring_appointment_id, occurrence_date, status },
        message: `Sessão de ${occurrence_date} marcada como ${status === 'completed' ? 'realizada' : 'falta'}.`,
      })
    }
  )

  server.tool(
    'kinevo_cancel_appointment_series',
    'End an entire recurring routine from a given date onward (default today). Occurrences after the end date stop appearing. The student is notified. To cancel just one session, use kinevo_cancel_appointment_occurrence.',
    {
      recurring_appointment_id: z.string().uuid().describe('The routine ID to end (from kinevo_list_appointments)'),
      ends_on: z.string().regex(DATE_KEY).optional().describe('Last active date, YYYY-MM-DD. Defaults to today.'),
    },
    { title: 'Encerrar rotina', readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    async ({ recurring_appointment_id, ends_on }) => {
      const supabaseAdmin = createAdminClient()
      const result = await cancelRecurringCore(supabaseAdmin, trainerId, {
        id: recurring_appointment_id,
        endsOn: ends_on,
      })
      if (!result.success) return mcpError(result.error ?? 'Erro ao encerrar rotina.')
      return mcpSuccess({
        canceled_series: { recurring_appointment_id, ends_on: ends_on ?? 'hoje' },
        message: `Rotina encerrada${ends_on ? ` em ${ends_on}` : ''}. O aluno foi notificado.`,
      })
    }
  )
}

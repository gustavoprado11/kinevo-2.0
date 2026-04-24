/**
 * Helpers para construir/manipular lembretes em `scheduled_notifications`.
 *
 * São funções puras — recebem a rotina e o trainer e devolvem as linhas
 * a serem inseridas. A escrita no banco fica por conta dos server actions
 * (que já têm o supabase client).
 *
 * Timezone assumido: America/Sao_Paulo (hardcoded, padrão do projeto).
 * O `scheduled_for` é calculado como `{occurrence_date} {start_time} menos 1h`
 * no TZ de negócio, convertido pra UTC pra gravar em TIMESTAMPTZ.
 */

import {
    appointmentMessages,
    type PushMessage,
} from '@kinevo/shared/constants/notification-messages'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import {
    expandAppointments,
    getNextOccurrences,
} from '@kinevo/shared/utils/appointments-projection'

export const REMINDER_LEAD_MINUTES = 60

export const REMINDER_WINDOW_DAYS = 30

const SAO_PAULO_TZ = 'America/Sao_Paulo'

/** Parse "YYYY-MM-DD" + "HH:MM" em TZ de negócio → instant UTC (Date). */
export function instantAtBrTime(dateKey: string, hhmm: string): Date {
    // Truque: formatamos uma Date candidata em UTC, checamos a hora que
    // aparece no TZ, e ajustamos. Pra São Paulo (sem DST hoje) é estável.
    const [y, m, d] = dateKey.split('-').map(Number)
    const [hh, mm] = hhmm.slice(0, 5).split(':').map(Number)
    // Candidato: meia-noite UTC do dia + hora local.
    const candidateUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0))
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: SAO_PAULO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
    const parts = Object.fromEntries(
        fmt.formatToParts(candidateUtc).map((p) => [p.type, p.value]),
    )
    const tzHour = parseInt(parts.hour)
    const tzMinute = parseInt(parts.minute)
    // Quantos minutos o candidato está à frente da hora desejada no TZ?
    const diffMinutes = (tzHour - hh) * 60 + (tzMinute - mm)
    return new Date(candidateUtc.getTime() - diffMinutes * 60_000)
}

/** Instant em UTC do lembrete (1h antes do início da ocorrência). */
export function computeReminderAt(dateKey: string, startTime: string): Date {
    const occurrenceInstant = instantAtBrTime(dateKey, startTime)
    return new Date(occurrenceInstant.getTime() - REMINDER_LEAD_MINUTES * 60_000)
}

/** Normaliza "HH:MM:SS" → "HH:MM"; já encurtado se vier "HH:MM". */
function normalizeHHMM(t: string): string {
    return t.length >= 5 ? t.slice(0, 5) : t
}

export interface ReminderRow {
    student_id: string
    trainer_id: string
    scheduled_for: string // ISO
    title: string
    body: string
    data: Record<string, unknown>
    source: 'appointment_reminder'
    recurring_appointment_id: string
    occurrence_date: string // YYYY-MM-DD
    status: 'pending'
}

/**
 * Constrói N linhas de lembrete para as ocorrências da rotina dentro dos
 * próximos `REMINDER_WINDOW_DAYS` dias. Cada ocorrência vira 1 linha.
 *
 * Apenas ocorrências com `scheduled_for > now` são retornadas — não faz
 * sentido agendar push pro passado. Também pula ocorrências que seriam
 * "hoje mas a menos de 1h" — o lembrete já passou.
 */
export function buildReminderRowsForRule(
    rule: RecurringAppointment,
    trainerName: string,
    now: Date,
): ReminderRow[] {
    const start = now
    const end = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60_000)
    const occurrences = expandAppointments([rule], [], start, end)

    const rows: ReminderRow[] = []
    for (const occ of occurrences) {
        const reminderAt = computeReminderAt(occ.date, occ.startTime)
        if (reminderAt.getTime() <= now.getTime()) continue
        const msg: PushMessage = appointmentMessages.lembrete1hAntes(
            trainerName,
            normalizeHHMM(occ.startTime),
        )
        rows.push({
            student_id: rule.student_id,
            trainer_id: rule.trainer_id,
            scheduled_for: reminderAt.toISOString(),
            title: msg.title,
            body: msg.body,
            data: {
                recurring_appointment_id: rule.id,
                occurrence_date: occ.originalDate,
                group_id: rule.group_id,
            },
            source: 'appointment_reminder',
            recurring_appointment_id: rule.id,
            occurrence_date: occ.originalDate,
            status: 'pending',
        })
    }
    return rows
}

/**
 * Re-export do helper consolidado em `shared/utils/format-br-date.ts`.
 * Mantido aqui por compatibilidade com os imports existentes dos server
 * actions.
 */
export { formatBrDateShort } from '@kinevo/shared/utils/format-br-date'

/** Re-exporta util pro server action que precisa da 1ª ocorrência pra push imediato. */
export { getNextOccurrences }

/**
 * Payload de uma linha em `student_inbox_items` (push imediato).
 * Tipado localmente porque o schema só aceita certos `type` — ver migration 108.
 */
export interface ImmediateInboxItem {
    student_id: string
    trainer_id: string
    type: 'appointment'
    status: 'unread'
    title: string
    subtitle: string
    payload: Record<string, unknown>
}

export function buildImmediateInboxItem(
    studentId: string,
    trainerId: string,
    msg: PushMessage,
    payload: Record<string, unknown> = {},
): ImmediateInboxItem {
    return {
        student_id: studentId,
        trainer_id: trainerId,
        type: 'appointment',
        status: 'unread',
        title: msg.title,
        subtitle: msg.body,
        payload,
    }
}


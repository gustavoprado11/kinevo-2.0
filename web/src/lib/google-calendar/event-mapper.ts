/**
 * Kinevo ↔ Google Event mapper
 *
 * Converte uma `RecurringAppointment` + nome do aluno em um `GoogleEvent`
 * com `RRULE` apropriado. Timezone: America/Sao_Paulo (hardcoded, padrão
 * do projeto). Valores de `dateTime` ficam em ISO sem offset, explicitando
 * o TZ via `timeZone: 'America/Sao_Paulo'` — o Google resolve DST/offset
 * automaticamente quando criar a instância.
 */

import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import type { GoogleEvent } from '@kinevo/shared/types/google-calendar'

export const EVENT_TIMEZONE = 'America/Sao_Paulo'
export const EVENT_TITLE_PREFIX = '[Kinevo] Treino'

/** Formata duração em `HH:MM` + `duration_minutes` em `HH:MM` de end. */
function addDurationHHMM(startHHMM: string, durationMinutes: number): string {
    const [h, m] = startHHMM.slice(0, 5).split(':').map(Number)
    const total = h * 60 + m + durationMinutes
    const hh = Math.floor(total / 60) % 24
    const mm = total % 60
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Dias da semana na notação iCal (BYDAY=...): SU, MO, TU, WE, TH, FR, SA.
 * Kinevo usa 0=Domingo..6=Sábado.
 */
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** Monta UNTIL em formato RFC 5545 (YYYYMMDDTHHMMSSZ) a partir de YYYY-MM-DD. */
function formatUntil(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number)
    // Fim do dia em UTC pra garantir que a última ocorrência local entra.
    return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}T235959Z`
}

export interface MapperContext {
    studentName: string
    /** URL do perfil do aluno; opcional — vira link na descrição do evento. */
    studentUrl?: string
}

/** Converte a rotina do Kinevo num body de `POST /events`. */
export function buildGoogleEvent(
    rule: RecurringAppointment,
    ctx: MapperContext,
): GoogleEvent {
    const startHHMM = rule.start_time.slice(0, 5)
    const endHHMM = addDurationHHMM(startHHMM, rule.duration_minutes)

    const description = buildDescription(rule, ctx)

    // Agendamento único: single event no Google (sem array `recurrence`).
    if (rule.frequency === 'once') {
        return {
            summary: `${EVENT_TITLE_PREFIX} — ${ctx.studentName}`,
            description,
            start: {
                dateTime: `${rule.starts_on}T${startHHMM}:00`,
                timeZone: EVENT_TIMEZONE,
            },
            end: {
                dateTime: `${rule.starts_on}T${endHHMM}:00`,
                timeZone: EVENT_TIMEZONE,
            },
            reminders: { useDefault: true },
        }
    }

    const freqMap = {
        weekly: 'WEEKLY',
        biweekly: 'WEEKLY',
        monthly: 'MONTHLY',
    } as const
    const freq = freqMap[rule.frequency]

    const parts: string[] = [`FREQ=${freq}`]
    if (rule.frequency === 'biweekly') parts.push('INTERVAL=2')
    if (rule.frequency === 'weekly' || rule.frequency === 'biweekly') {
        parts.push(`BYDAY=${DAY_CODES[rule.day_of_week]}`)
    }
    if (rule.ends_on) parts.push(`UNTIL=${formatUntil(rule.ends_on)}`)
    const rrule = `RRULE:${parts.join(';')}`

    return {
        summary: `${EVENT_TITLE_PREFIX} — ${ctx.studentName}`,
        description,
        start: {
            dateTime: `${rule.starts_on}T${startHHMM}:00`,
            timeZone: EVENT_TIMEZONE,
        },
        end: {
            dateTime: `${rule.starts_on}T${endHHMM}:00`,
            timeZone: EVENT_TIMEZONE,
        },
        recurrence: [rrule],
        reminders: { useDefault: true },
    }
}

function buildDescription(
    rule: RecurringAppointment,
    ctx: MapperContext,
): string {
    const lines: string[] = [
        `Aluno: ${ctx.studentName}`,
        `Duração: ${rule.duration_minutes} min`,
    ]
    if (rule.notes) {
        lines.push('')
        lines.push('Notas:')
        lines.push(rule.notes)
    }
    if (ctx.studentUrl) {
        lines.push('')
        lines.push(`Ver no Kinevo: ${ctx.studentUrl}`)
    }
    return lines.join('\n')
}

/**
 * Monta o patch pra uma instance override (remarcação de ocorrência única).
 *
 * @param originalDate YYYY-MM-DD da ocorrência original (antes da remarcação)
 * @param originalStartHHMM hora original (pra originalStartTime, em TZ)
 * @param newDate YYYY-MM-DD da nova data
 * @param newStartHHMM HH:MM da nova hora
 * @param durationMinutes duração do evento
 */
export function buildInstanceOverride(args: {
    originalDate: string
    originalStartHHMM: string
    newDate: string
    newStartHHMM: string
    durationMinutes: number
}): Partial<GoogleEvent> {
    const endHHMM = addDurationHHMM(args.newStartHHMM, args.durationMinutes)
    return {
        start: {
            dateTime: `${args.newDate}T${args.newStartHHMM}:00`,
            timeZone: EVENT_TIMEZONE,
        },
        end: {
            dateTime: `${args.newDate}T${endHHMM}:00`,
            timeZone: EVENT_TIMEZONE,
        },
    }
}

/**
 * Calcula o `instanceId` que o Google usa pra identificar uma ocorrência
 * específica. Formato: `<eventId>_<YYYYMMDD>T<HHMMSS>Z` em UTC (basic).
 * Pro Kinevo, a ocorrência está sempre no mesmo horário original, em TZ
 * America/Sao_Paulo. Convertemos pra UTC aqui.
 *
 * NOTA: O Google aceita também o formato "basic" com sufixo Z; porém o
 * jeito mais confiável é listar instâncias via /events/{id}/instances
 * e selecionar pelo `id` retornado. Esta função serve como fallback.
 */
export function computeInstanceIdHint(
    eventId: string,
    originalDate: string,
    originalStartHHMM: string,
): string {
    // Convertemos `YYYY-MM-DD HH:MM` em São Paulo → UTC (São Paulo é UTC-3
    // o ano todo, sem DST desde 2019).
    const [y, m, d] = originalDate.split('-').map(Number)
    const [hh, mm] = originalStartHHMM.slice(0, 5).split(':').map(Number)
    // UTC = BRT + 3h
    const date = new Date(Date.UTC(y, m - 1, d, hh + 3, mm, 0))
    const yyyy = date.getUTCFullYear()
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
    const da = String(date.getUTCDate()).padStart(2, '0')
    const hr = String(date.getUTCHours()).padStart(2, '0')
    const mi = String(date.getUTCMinutes()).padStart(2, '0')
    return `${eventId}_${yyyy}${mo}${da}T${hr}${mi}00Z`
}

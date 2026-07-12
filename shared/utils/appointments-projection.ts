/**
 * Appointments Projection
 *
 * Pure functions that expand recurring appointment rules into concrete
 * occurrences within a date range, applying exceptions on top.
 *
 * Sem dependência de Supabase, fetch ou timezone dinâmico: trabalha com
 * strings "YYYY-MM-DD" / "HH:MM" e Date em UTC pra aritmética de dias.
 * Timezone de negócio é assumido como America/Sao_Paulo pelo chamador.
 */

import type {
    AppointmentException,
    AppointmentOccurrence,
    OccurrenceStatus,
    RecurringAppointment,
} from '../types/appointments'

// ---------------------------------------------------------------------------
// Date helpers (UTC-based, TZ-neutral)
// ---------------------------------------------------------------------------

/** Parse "YYYY-MM-DD" into a UTC Date at midnight. */
function parseDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

/** Format a Date as "YYYY-MM-DD" in UTC. */
function toDateKeyUTC(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** Convert an arbitrary Date to a UTC midnight Date representing the same calendar day. */
function toUTCMidnight(d: Date): Date {
    return new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    )
}

function addDaysUTC(d: Date, days: number): Date {
    const r = new Date(d)
    r.setUTCDate(r.getUTCDate() + days)
    return r
}

/**
 * N-ésima ocorrência mensal a partir de `startsOn`: sempre re-ancorada no
 * dia-do-mês original, CLAMPADA ao último dia do mês alvo (31/jan → 28/fev →
 * 31/mar…).
 *
 * CS6: a versão anterior acumulava `setUTCMonth` deixando o JS ROLAR
 * (31/jan + 1 mês = 03/mar) e iterava sobre a data rolada — a regra derivava
 * PERMANENTEMENTE pro dia 3.
 */
function monthlyOccurrenceUTC(startsOn: Date, monthIndex: number): Date {
    const y = startsOn.getUTCFullYear()
    const m = startsOn.getUTCMonth() + monthIndex
    const anchorDay = startsOn.getUTCDate()
    const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    return new Date(Date.UTC(y, m, Math.min(anchorDay, lastDayOfTarget)))
}

/** Normalize "HH:MM:SS" → "HH:MM". */
function normalizeTime(t: string): string {
    if (t.length >= 5) return t.slice(0, 5)
    return t
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand recurring rules into occurrences inside [rangeStart, rangeEnd]
 * (inclusive on both ends), applying exceptions.
 *
 * Pure function — no side effects.
 */
export function expandAppointments(
    recurring: RecurringAppointment[],
    exceptions: AppointmentException[],
    rangeStart: Date,
    rangeEnd: Date,
): AppointmentOccurrence[] {
    const start = toUTCMidnight(rangeStart)
    const end = toUTCMidnight(rangeEnd)
    if (end.getTime() < start.getTime()) return []

    // Index exceptions by (recurringId::originalDate) for O(1) lookup.
    const exceptionsByKey = new Map<string, AppointmentException>()
    for (const exc of exceptions) {
        exceptionsByKey.set(
            `${exc.recurring_appointment_id}::${exc.occurrence_date}`,
            exc,
        )
    }

    const out: AppointmentOccurrence[] = []
    // Chave (regra::data-efetiva::hora-efetiva) de tudo que já foi emitido —
    // o resgate de remarcadas abaixo usa isto pra nunca duplicar.
    const emitted = new Set<string>()
    const emit = (occ: AppointmentOccurrence) => {
        emitted.add(`${occ.recurringAppointmentId}::${occ.date}::${occ.startTime}`)
        out.push(occ)
    }

    for (const rule of recurring) {
        if (rule.status !== 'active') continue

        const originalDates = iterateValidDates(rule, start, end)
        for (const originalDate of originalDates) {
            const originalKey = toDateKeyUTC(originalDate)
            const exc = exceptionsByKey.get(`${rule.id}::${originalKey}`)

            if (!exc) {
                emit(buildOccurrence(rule, originalKey, null))
                continue
            }

            if (exc.kind === 'canceled') continue

            // D1: exceção com new_date vive na data EFETIVA — vale para
            // rescheduled e também para completed/no_show de uma ocorrência
            // que foi remarcada antes (a presença preserva a remarcação).
            if (exc.new_date) {
                const effectiveDateObj = parseDateKey(exc.new_date)
                // Only include if the effective date still falls in range
                if (
                    effectiveDateObj.getTime() < start.getTime() ||
                    effectiveDateObj.getTime() > end.getTime()
                ) {
                    continue
                }
                emit(buildOccurrence(rule, originalKey, exc))
                continue
            }

            // completed | no_show sem remarcação: keep at original slot
            emit(buildOccurrence(rule, originalKey, exc))
        }
    }

    // AG1: o loop acima itera as datas ORIGINAIS dentro do range — uma exceção
    // `rescheduled` cuja data original está FORA do range (ex.: "remarcar pra
    // semana que vem") nunca era visitada, e o atendimento sumia de TODAS as
    // visões semanais. Este passe materializa as remarcadas que ATERRISSAM
    // (new_date) dentro do range.
    const rulesById = new Map(recurring.map((r) => [r.id, r]))
    for (const exc of exceptions) {
        // D1: também completed/no_show com new_date (remarcada + presença).
        if (exc.kind === 'canceled' || !exc.new_date) continue

        const landing = parseDateKey(exc.new_date)
        if (
            landing.getTime() < start.getTime() ||
            landing.getTime() > end.getTime()
        ) {
            continue
        }

        const rule = rulesById.get(exc.recurring_appointment_id)
        if (!rule || rule.status !== 'active') continue

        // A data original precisa ser uma ocorrência que a regra realmente
        // gera (guarda contra exceções órfãs — ex.: regra `once` cujo
        // starts_on já foi movido, ou ends_on anterior à data original).
        const originalDay = parseDateKey(exc.occurrence_date)
        if (iterateValidDates(rule, originalDay, originalDay).length === 0) {
            continue
        }

        const occ = buildOccurrence(rule, exc.occurrence_date, exc)
        const key = `${occ.recurringAppointmentId}::${occ.date}::${occ.startTime}`
        // Original dentro do range (já emitida pelo loop principal) ou colisão
        // exata com ocorrência natural da regra — não duplica.
        if (emitted.has(key)) continue
        emit(occ)
    }

    out.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1
        if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1
        return 0
    })

    return out
}

/** Próximas N ocorrências com data/hora >= `fromDate`, janela de 90 dias. */
export function getNextOccurrences(
    recurring: RecurringAppointment[],
    exceptions: AppointmentException[],
    fromDate: Date,
    limit: number,
): AppointmentOccurrence[] {
    if (limit <= 0) return []
    const rangeStart = toUTCMidnight(fromDate)
    const rangeEnd = addDaysUTC(rangeStart, 90)
    const fromKey = toDateKeyUTC(rangeStart)

    const expanded = expandAppointments(
        recurring,
        exceptions,
        rangeStart,
        rangeEnd,
    )

    // Same-day occurrences whose startTime already passed relative to fromDate
    // are still returned — caller decides. Here we only filter by calendar day.
    const filtered = expanded.filter((o) => o.date >= fromKey)
    return filtered.slice(0, limit)
}

/** Ocorrências de um dia específico. */
export function getOccurrencesForDay(
    recurring: RecurringAppointment[],
    exceptions: AppointmentException[],
    date: Date,
): AppointmentOccurrence[] {
    const day = toUTCMidnight(date)
    return expandAppointments(recurring, exceptions, day, day)
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Iterate the original (pre-exception) dates where a rule fires inside
 * [rangeStart, rangeEnd]. Respects starts_on, ends_on, frequency.
 */
export function iterateValidDates(
    rule: RecurringAppointment,
    rangeStart: Date,
    rangeEnd: Date,
): Date[] {
    const startsOn = parseDateKey(rule.starts_on)
    const endsOn = rule.ends_on ? parseDateKey(rule.ends_on) : null

    // Effective iteration window: intersection of [rangeStart,rangeEnd] with
    // [startsOn, endsOn?].
    const effStart =
        startsOn.getTime() > rangeStart.getTime() ? startsOn : rangeStart
    const effEnd =
        endsOn && endsOn.getTime() < rangeEnd.getTime() ? endsOn : rangeEnd
    if (effEnd.getTime() < effStart.getTime()) return []

    const result: Date[] = []

    if (rule.frequency === 'once') {
        // Uma única ocorrência em starts_on. day_of_week e ends_on são
        // ignorados — a data da ocorrência é sempre starts_on.
        if (
            startsOn.getTime() >= effStart.getTime() &&
            startsOn.getTime() <= effEnd.getTime()
        ) {
            result.push(startsOn)
        }
        return result
    }

    if (rule.frequency === 'weekly' || rule.frequency === 'biweekly') {
        // Find first valid date >= effStart with matching day_of_week that also
        // fits the biweekly phase (counting from starts_on).
        const step = rule.frequency === 'weekly' ? 7 : 14

        // Align to day_of_week starting from effStart
        let cursor = alignToDayOfWeekForward(effStart, rule.day_of_week)
        // Ensure cursor >= starts_on
        if (cursor.getTime() < startsOn.getTime()) {
            cursor = alignToDayOfWeekForward(startsOn, rule.day_of_week)
        }

        if (rule.frequency === 'biweekly') {
            // Anchor: first occurrence of the rule (starts_on aligned forward).
            const anchor = alignToDayOfWeekForward(startsOn, rule.day_of_week)
            // Snap cursor forward to nearest biweekly slot from anchor.
            const diffDays = Math.floor(
                (cursor.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
            )
            const mod = ((diffDays % 14) + 14) % 14
            if (mod !== 0) {
                cursor = addDaysUTC(cursor, 14 - mod)
            }
        }

        while (cursor.getTime() <= effEnd.getTime()) {
            result.push(cursor)
            cursor = addDaysUTC(cursor, step)
        }
        return result
    }

    if (rule.frequency === 'monthly') {
        // Monthly: same calendar day-of-month as starts_on (clampado ao fim do
        // mês — ver monthlyOccurrenceUTC). day_of_week is ignored (the spec
        // anchors on starts_on for monthly rules).
        let monthIndex = 0
        let cursor = monthlyOccurrenceUTC(startsOn, monthIndex)
        // Fast-forward cursor into the range
        while (cursor.getTime() < effStart.getTime()) {
            monthIndex++
            cursor = monthlyOccurrenceUTC(startsOn, monthIndex)
        }
        while (cursor.getTime() <= effEnd.getTime()) {
            result.push(cursor)
            monthIndex++
            cursor = monthlyOccurrenceUTC(startsOn, monthIndex)
        }
        return result
    }

    return result
}

function alignToDayOfWeekForward(d: Date, dayOfWeek: number): Date {
    const current = d.getUTCDay()
    const delta = (dayOfWeek - current + 7) % 7
    return addDaysUTC(d, delta)
}

function buildOccurrence(
    rule: RecurringAppointment,
    originalDateKey: string,
    exc: AppointmentException | null,
): AppointmentOccurrence {
    const hasException = exc !== null
    let date = originalDateKey
    let startTime = normalizeTime(rule.start_time)
    let status: OccurrenceStatus = 'scheduled'

    if (exc) {
        // D1: new_date reposiciona a ocorrência independente do kind — uma
        // remarcada que depois vira concluída/faltou fica no dia REAL.
        if (exc.new_date) {
            date = exc.new_date
            startTime = exc.new_start_time
                ? normalizeTime(exc.new_start_time)
                : normalizeTime(rule.start_time)
        }
        if (exc.kind === 'rescheduled') {
            status = 'rescheduled'
        } else if (exc.kind === 'completed') {
            status = 'completed'
        } else if (exc.kind === 'no_show') {
            status = 'no_show'
        }
    }

    const mergedNotes = mergeNotes(rule.notes, exc?.notes ?? null)

    return {
        recurringAppointmentId: rule.id,
        groupId: rule.group_id,
        studentId: rule.student_id,
        trainerId: rule.trainer_id,
        date,
        startTime,
        durationMinutes: rule.duration_minutes,
        originalDate: originalDateKey,
        status,
        hasException,
        notes: mergedNotes,
    }
}

function mergeNotes(
    ruleNotes: string | null,
    excNotes: string | null,
): string | null {
    if (ruleNotes && excNotes) return `${ruleNotes}\n${excNotes}`
    return ruleNotes ?? excNotes ?? null
}

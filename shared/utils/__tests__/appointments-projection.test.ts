import { describe, expect, it } from 'vitest'
import {
    expandAppointments,
    getNextOccurrences,
    getOccurrencesForDay,
    iterateValidDates,
} from '../appointments-projection'
import type {
    AppointmentException,
    RecurringAppointment,
} from '../../types/appointments'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRule(
    overrides: Partial<RecurringAppointment> = {},
): RecurringAppointment {
    return {
        id: 'rule-1',
        trainer_id: 'trainer-1',
        student_id: 'student-1',
        day_of_week: 2, // Tuesday
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-07', // Tue
        ends_on: null,
        status: 'active',
        notes: null,
        group_id: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        ...overrides,
    }
}

function makeException(
    overrides: Partial<AppointmentException> = {},
): AppointmentException {
    return {
        id: 'exc-1',
        recurring_appointment_id: 'rule-1',
        trainer_id: 'trainer-1',
        occurrence_date: '2026-04-14',
        kind: 'rescheduled',
        new_date: null,
        new_start_time: null,
        notes: null,
        created_at: '2026-04-10T00:00:00Z',
        ...overrides,
    }
}

/** Helper: parse "YYYY-MM-DD" into a UTC Date (same convention as the helper). */
function d(key: string): Date {
    const [y, m, day] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, day))
}

// ---------------------------------------------------------------------------
// expandAppointments
// ---------------------------------------------------------------------------

describe('expandAppointments', () => {
    it('expande regra semanal em 4 ocorrências no mês de abril/2026', () => {
        const rule = makeRule() // Terças a partir de 07/04
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-07',
            '2026-04-14',
            '2026-04-21',
            '2026-04-28',
        ])
        expect(out.every((o) => o.status === 'scheduled')).toBe(true)
        expect(out.every((o) => o.startTime === '07:00')).toBe(true)
    })

    it('expande regra quinzenal em 2 ocorrências no mês', () => {
        const rule = makeRule({ frequency: 'biweekly' })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual(['2026-04-07', '2026-04-21'])
    })

    it('expande regra mensal em 1 ocorrência por mês', () => {
        const rule = makeRule({
            frequency: 'monthly',
            starts_on: '2026-04-15',
        })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-07-31'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-15',
            '2026-05-15',
            '2026-06-15',
            '2026-07-15',
        ])
    })

    it('respeita starts_on (não gera antes)', () => {
        const rule = makeRule({ starts_on: '2026-04-14' })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-14',
            '2026-04-21',
            '2026-04-28',
        ])
    })

    it('respeita ends_on (não gera depois)', () => {
        const rule = makeRule({ ends_on: '2026-04-20' })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual(['2026-04-07', '2026-04-14'])
    })

    it('ignora regras com status canceled', () => {
        const rule = makeRule({ status: 'canceled' })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out).toHaveLength(0)
    })

    it('aplica exceção rescheduled (troca data e hora)', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            kind: 'rescheduled',
            new_date: '2026-04-15',
            new_start_time: '08:30',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        const remapped = out.find((o) => o.originalDate === '2026-04-14')
        expect(remapped).toBeDefined()
        expect(remapped?.date).toBe('2026-04-15')
        expect(remapped?.startTime).toBe('08:30')
        expect(remapped?.status).toBe('rescheduled')
        expect(remapped?.hasException).toBe(true)
    })

    it('aplica exceção canceled (remove ocorrência)', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            kind: 'canceled',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-07',
            '2026-04-21',
            '2026-04-28',
        ])
    })

    it('aplica exceção no_show (mantém data, status no_show)', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            kind: 'no_show',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        const match = out.find((o) => o.originalDate === '2026-04-14')
        expect(match?.status).toBe('no_show')
        expect(match?.date).toBe('2026-04-14')
    })

    it('aplica exceção completed (status completed)', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            kind: 'completed',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        const match = out.find((o) => o.originalDate === '2026-04-14')
        expect(match?.status).toBe('completed')
    })

    it('retorna ordenado por data+hora mesmo com múltiplas regras', () => {
        const ruleA = makeRule({ id: 'A', start_time: '09:00' })
        const ruleB = makeRule({
            id: 'B',
            start_time: '07:00',
            day_of_week: 4, // Thursday -> 2026-04-09
            starts_on: '2026-04-09',
        })
        const out = expandAppointments(
            [ruleA, ruleB],
            [],
            d('2026-04-07'),
            d('2026-04-16'),
        )
        // Expected: 04-07 09:00 (A), 04-09 07:00 (B), 04-14 09:00 (A), 04-16 07:00 (B)
        expect(
            out.map((o) => `${o.date} ${o.startTime}`),
        ).toEqual([
            '2026-04-07 09:00',
            '2026-04-09 07:00',
            '2026-04-14 09:00',
            '2026-04-16 07:00',
        ])
    })

    it('retorna array vazio quando não há regras', () => {
        expect(
            expandAppointments([], [], d('2026-04-01'), d('2026-04-30')),
        ).toEqual([])
    })

    it('funciona quando range começa e termina no mesmo dia', () => {
        const rule = makeRule()
        const out = expandAppointments(
            [rule],
            [],
            d('2026-04-14'),
            d('2026-04-14'),
        )
        expect(out).toHaveLength(1)
        expect(out[0].date).toBe('2026-04-14')
    })

    it('exclui ocorrência rescheduled cuja nova data cai fora do range', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            kind: 'rescheduled',
            new_date: '2026-05-02', // fora do range
            new_start_time: '08:00',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.originalDate)).toEqual([
            '2026-04-07',
            '2026-04-21',
            '2026-04-28',
        ])
    })

    it('aceita start_time com segundos ("HH:MM:SS") e normaliza pra "HH:MM"', () => {
        const rule = makeRule({ start_time: '07:00:00' })
        const out = expandAppointments([rule], [], d('2026-04-07'), d('2026-04-07'))
        expect(out[0].startTime).toBe('07:00')
    })

    it('merge de notes: combina regra + exceção', () => {
        const rule = makeRule({ notes: 'Treino A' })
        const exc = makeException({
            occurrence_date: '2026-04-14',
            kind: 'no_show',
            notes: 'Aluno avisou que faltaria',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-14'), d('2026-04-14'))
        expect(out[0].notes).toBe('Treino A\nAluno avisou que faltaria')
    })

    it('biweekly respeita a fase ancorada em starts_on', () => {
        const rule = makeRule({
            frequency: 'biweekly',
            starts_on: '2026-04-07',
        })
        // Range começa depois de starts_on: ainda deve cair em semanas pares (0, 2, 4...) a partir de starts_on
        const out = expandAppointments([rule], [], d('2026-04-10'), d('2026-05-31'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-21',
            '2026-05-05',
            '2026-05-19',
        ])
    })
})

// ---------------------------------------------------------------------------
// frequency = 'once'
// ---------------------------------------------------------------------------

describe("expandAppointments — frequency 'once'", () => {
    it('gera exatamente 1 ocorrência na data starts_on', () => {
        const rule = makeRule({
            frequency: 'once',
            starts_on: '2026-04-22', // Qua
        })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual(['2026-04-22'])
        expect(out[0].originalDate).toBe('2026-04-22')
        expect(out[0].status).toBe('scheduled')
    })

    it('não gera ocorrências após starts_on (sem recorrência)', () => {
        const rule = makeRule({
            frequency: 'once',
            starts_on: '2026-04-01',
        })
        const out = expandAppointments([rule], [], d('2026-04-02'), d('2026-12-31'))
        expect(out).toEqual([])
    })

    it("aplica exceção rescheduled numa ocorrência 'once'", () => {
        const rule = makeRule({
            frequency: 'once',
            starts_on: '2026-04-22',
        })
        const exc = makeException({
            recurring_appointment_id: 'rule-1',
            occurrence_date: '2026-04-22',
            kind: 'rescheduled',
            new_date: '2026-04-24',
            new_start_time: '09:30',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        expect(out).toHaveLength(1)
        expect(out[0].date).toBe('2026-04-24')
        expect(out[0].startTime).toBe('09:30')
        expect(out[0].status).toBe('rescheduled')
        expect(out[0].originalDate).toBe('2026-04-22')
    })

    it("aplica exceção canceled numa ocorrência 'once' (remove)", () => {
        const rule = makeRule({
            frequency: 'once',
            starts_on: '2026-04-22',
        })
        const exc = makeException({
            occurrence_date: '2026-04-22',
            kind: 'canceled',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-01'), d('2026-04-30'))
        expect(out).toEqual([])
    })

    it('ignora day_of_week — usa sempre a data de starts_on', () => {
        // starts_on cai numa sexta (2026-04-24). day_of_week=2 (terça) seria
        // inválido numa regra semanal, mas em 'once' é ignorado.
        const rule = makeRule({
            frequency: 'once',
            starts_on: '2026-04-24', // Sex
            day_of_week: 2, // Ter — deve ser ignorado
        })
        const out = expandAppointments([rule], [], d('2026-04-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual(['2026-04-24'])
    })
})

// ---------------------------------------------------------------------------
// getNextOccurrences
// ---------------------------------------------------------------------------

describe('getNextOccurrences', () => {
    it('retorna só ocorrências futuras a partir de fromDate', () => {
        const rule = makeRule()
        const out = getNextOccurrences([rule], [], d('2026-04-15'), 10)
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-21',
            '2026-04-28',
            '2026-05-05',
            '2026-05-12',
            '2026-05-19',
            '2026-05-26',
            '2026-06-02',
            '2026-06-09',
            '2026-06-16',
            '2026-06-23',
        ])
    })

    it('respeita limit', () => {
        const rule = makeRule()
        const out = getNextOccurrences([rule], [], d('2026-04-01'), 3)
        expect(out).toHaveLength(3)
        expect(out.map((o) => o.date)).toEqual([
            '2026-04-07',
            '2026-04-14',
            '2026-04-21',
        ])
    })

    it('retorna [] quando limit <= 0', () => {
        const rule = makeRule()
        expect(getNextOccurrences([rule], [], d('2026-04-01'), 0)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// getOccurrencesForDay
// ---------------------------------------------------------------------------

describe('getOccurrencesForDay', () => {
    it('retorna apenas ocorrências daquele dia', () => {
        const rule = makeRule()
        const out = getOccurrencesForDay([rule], [], d('2026-04-14'))
        expect(out).toHaveLength(1)
        expect(out[0].date).toBe('2026-04-14')
    })

    it('retorna vazio em dia sem agendamento', () => {
        const rule = makeRule()
        const out = getOccurrencesForDay([rule], [], d('2026-04-15')) // Wed
        expect(out).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// iterateValidDates (internal, exported como test seam)
// ---------------------------------------------------------------------------

describe('iterateValidDates', () => {
    it('gera terças em abril/2026 a partir de starts_on', () => {
        const rule = makeRule()
        const dates = iterateValidDates(rule, d('2026-04-01'), d('2026-04-30'))
        expect(dates.map((x) => x.toISOString().slice(0, 10))).toEqual([
            '2026-04-07',
            '2026-04-14',
            '2026-04-21',
            '2026-04-28',
        ])
    })
})

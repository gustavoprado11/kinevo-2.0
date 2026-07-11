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
// expandAppointments — recorrência mensal em dia 29–31 (CS6)
// ---------------------------------------------------------------------------

describe('expandAppointments — mensal ancorada com clamp (CS6)', () => {
    it('regra de dia 31 NÃO deriva: 31/jan → 28/fev → 31/mar → 30/abr', () => {
        const rule = makeRule({ frequency: 'monthly', starts_on: '2026-01-31' })
        const out = expandAppointments([rule], [], d('2026-01-01'), d('2026-04-30'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-01-31',
            '2026-02-28',
            '2026-03-31',
            '2026-04-30',
        ])
    })

    it('ano bissexto clampa pra 29/fev', () => {
        const rule = makeRule({ frequency: 'monthly', starts_on: '2028-01-31' })
        const out = expandAppointments([rule], [], d('2028-02-01'), d('2028-02-29'))
        expect(out.map((o) => o.date)).toEqual(['2028-02-29'])
    })

    it('dia ≤28 segue idêntico ao comportamento anterior', () => {
        const rule = makeRule({ frequency: 'monthly', starts_on: '2026-01-15' })
        const out = expandAppointments([rule], [], d('2026-01-01'), d('2026-03-31'))
        expect(out.map((o) => o.date)).toEqual([
            '2026-01-15',
            '2026-02-15',
            '2026-03-15',
        ])
    })
})

// ---------------------------------------------------------------------------
// expandAppointments — remarcações vindas de FORA do range (AG1)
// ---------------------------------------------------------------------------

describe('expandAppointments — remarcada aterrissando de fora do range (AG1)', () => {
    it('remarcar pra semana seguinte APARECE na semana de destino', () => {
        // Terça 14/04 remarcada pra quarta 22/04 09:00 (semana seguinte).
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-22',
            new_start_time: '09:00',
        })
        // Semana de destino: 19–25/abr.
        const out = expandAppointments([rule], [exc], d('2026-04-19'), d('2026-04-25'))

        expect(out).toHaveLength(2)
        // Ocorrência natural da semana (terça 21) intacta…
        expect(out[0]).toMatchObject({
            date: '2026-04-21',
            startTime: '07:00',
            status: 'scheduled',
        })
        // …e a remarcada materializada na data de aterrissagem.
        expect(out[1]).toMatchObject({
            date: '2026-04-22',
            startTime: '09:00',
            status: 'rescheduled',
            originalDate: '2026-04-14',
        })
    })

    it('continua SUMINDO da semana original (comportamento correto preservado)', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-22',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-12'), d('2026-04-18'))
        expect(out).toHaveLength(0)
    })

    it('não duplica quando original e destino estão AMBOS no range', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-15',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-12'), d('2026-04-18'))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ date: '2026-04-15', status: 'rescheduled' })
    })

    it('colisão exata (mesma data e hora da ocorrência natural) não duplica', () => {
        // 14/04 remarcada pra cima da terça 21/04 no MESMO horário da regra.
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-21',
            new_start_time: null,
        })
        const out = expandAppointments([rule], [exc], d('2026-04-19'), d('2026-04-25'))
        expect(out).toHaveLength(1)
        expect(out[0].date).toBe('2026-04-21')
    })

    it('mesma data da natural mas hora DIFERENTE → as duas aparecem', () => {
        const rule = makeRule()
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-21',
            new_start_time: '09:00',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-19'), d('2026-04-25'))
        expect(out).toHaveLength(2)
        expect(out.map((o) => `${o.date} ${o.startTime}`)).toEqual([
            '2026-04-21 07:00',
            '2026-04-21 09:00',
        ])
    })

    it('exceção órfã (regra once já movida) NÃO materializa nem duplica', () => {
        // Regra once com starts_on movido pra 22/04; exceção velha aponta
        // occurrence_date=08/04 (que a regra não gera mais) → new_date=22/04.
        const rule = makeRule({ frequency: 'once', starts_on: '2026-04-22' })
        const exc = makeException({
            occurrence_date: '2026-04-08',
            new_date: '2026-04-22',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-19'), d('2026-04-25'))
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ date: '2026-04-22', status: 'scheduled' })
    })

    it('regra encerrada ANTES da data original não materializa a remarcada', () => {
        const rule = makeRule({ ends_on: '2026-04-10' })
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-22',
        })
        const out = expandAppointments([rule], [exc], d('2026-04-19'), d('2026-04-25'))
        expect(out).toHaveLength(0)
    })

    it('getNextOccurrences enxerga a remarcada vinda de fora da janela imediata', () => {
        const rule = makeRule({ ends_on: '2026-04-14' })
        const exc = makeException({
            occurrence_date: '2026-04-14',
            new_date: '2026-04-22',
            new_start_time: '09:00',
        })
        // A partir de 20/04: a regra já acabou (ends_on 14/04), mas a
        // remarcada aterrissa em 22/04 e deve aparecer.
        const out = getNextOccurrences([rule], [exc], d('2026-04-20'), 5)
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({
            date: '2026-04-22',
            startTime: '09:00',
            status: 'rescheduled',
        })
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

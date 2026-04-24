import { describe, it, expect } from 'vitest'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import {
    buildGoogleEvent,
    buildInstanceOverride,
    computeInstanceIdHint,
    EVENT_TIMEZONE,
    EVENT_TITLE_PREFIX,
} from '../event-mapper'

function makeRule(overrides: Partial<RecurringAppointment> = {}): RecurringAppointment {
    return {
        id: 'ra-1',
        trainer_id: 't-1',
        student_id: 's-1',
        day_of_week: 2, // Tuesday
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-04-07',
        ends_on: null,
        status: 'active',
        notes: null,
        group_id: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        ...overrides,
    }
}

describe('buildGoogleEvent', () => {
    it('weekly usa FREQ=WEEKLY + BYDAY correto', () => {
        const ev = buildGoogleEvent(makeRule(), { studentName: 'João' })
        expect(ev.summary).toBe(`${EVENT_TITLE_PREFIX} — João`)
        expect(ev.start.dateTime).toBe('2026-04-07T07:00:00')
        expect(ev.start.timeZone).toBe(EVENT_TIMEZONE)
        expect(ev.end.dateTime).toBe('2026-04-07T08:00:00')
        expect(ev.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=TU'])
    })

    it('biweekly usa INTERVAL=2', () => {
        const ev = buildGoogleEvent(
            makeRule({ frequency: 'biweekly', day_of_week: 4 }),
            { studentName: 'Maria' },
        )
        expect(ev.recurrence?.[0]).toContain('INTERVAL=2')
        expect(ev.recurrence?.[0]).toContain('BYDAY=TH')
    })

    it('monthly usa FREQ=MONTHLY sem BYDAY', () => {
        const ev = buildGoogleEvent(
            makeRule({ frequency: 'monthly', day_of_week: 2 }),
            { studentName: 'Ana' },
        )
        expect(ev.recurrence?.[0]).toBe('RRULE:FREQ=MONTHLY')
    })

    it('ends_on vira UNTIL no RRULE', () => {
        const ev = buildGoogleEvent(
            makeRule({ ends_on: '2026-06-30' }),
            { studentName: 'Carlos' },
        )
        expect(ev.recurrence?.[0]).toContain('UNTIL=20260630T235959Z')
    })

    it('descrição inclui notas quando existem', () => {
        const ev = buildGoogleEvent(
            makeRule({ notes: 'Treino A' }),
            { studentName: 'João' },
        )
        expect(ev.description).toContain('Aluno: João')
        expect(ev.description).toContain('Duração: 60 min')
        expect(ev.description).toContain('Treino A')
    })

    it('calcula end corretamente quando duration=90', () => {
        const ev = buildGoogleEvent(
            makeRule({ duration_minutes: 90, start_time: '18:30' }),
            { studentName: 'X' },
        )
        expect(ev.start.dateTime).toBe('2026-04-07T18:30:00')
        expect(ev.end.dateTime).toBe('2026-04-07T20:00:00')
    })

    it("frequency='once' vira single event (sem recurrence)", () => {
        const ev = buildGoogleEvent(
            makeRule({ frequency: 'once', starts_on: '2026-04-24', day_of_week: 5 }),
            { studentName: 'Lucia' },
        )
        expect(ev.recurrence).toBeUndefined()
        expect(ev.start.dateTime).toBe('2026-04-24T07:00:00')
        expect(ev.start.timeZone).toBe(EVENT_TIMEZONE)
        expect(ev.end.dateTime).toBe('2026-04-24T08:00:00')
        expect(ev.summary).toBe(`${EVENT_TITLE_PREFIX} — Lucia`)
    })

    it("frequency='once' ignora ends_on no payload (single event)", () => {
        const ev = buildGoogleEvent(
            makeRule({ frequency: 'once', starts_on: '2026-04-24', ends_on: '2026-06-30' }),
            { studentName: 'Z' },
        )
        expect(ev.recurrence).toBeUndefined()
    })
})

describe('buildInstanceOverride', () => {
    it('monta patch com start/end no novo horário', () => {
        const patch = buildInstanceOverride({
            originalDate: '2026-04-14',
            originalStartHHMM: '07:00',
            newDate: '2026-04-15',
            newStartHHMM: '08:30',
            durationMinutes: 60,
        })
        expect(patch.start?.dateTime).toBe('2026-04-15T08:30:00')
        expect(patch.end?.dateTime).toBe('2026-04-15T09:30:00')
        expect(patch.start?.timeZone).toBe(EVENT_TIMEZONE)
    })
})

describe('computeInstanceIdHint', () => {
    it('monta id no formato esperado (UTC)', () => {
        // 07:00 em São Paulo = 10:00 UTC
        const id = computeInstanceIdHint('evt-abc', '2026-04-14', '07:00')
        expect(id).toBe('evt-abc_20260414T100000Z')
    })
})

import { describe, it, expect } from 'vitest'
import type { RecurringAppointment } from '@kinevo/shared/types/appointments'
import {
    buildImmediateInboxItem,
    buildReminderRowsForRule,
    computeReminderAt,
    formatBrDateShort,
    instantAtBrTime,
    REMINDER_LEAD_MINUTES,
    REMINDER_WINDOW_DAYS,
} from '../scheduled-notifications'
import { appointmentMessages } from '@kinevo/shared/constants/notification-messages'

describe('instantAtBrTime', () => {
    it('retorna instante UTC correspondente a 07:00 em São Paulo (UTC-3, ano todo)', () => {
        // 2026-06-01 07:00 America/Sao_Paulo = 2026-06-01 10:00 UTC
        const inst = instantAtBrTime('2026-06-01', '07:00')
        expect(inst.toISOString()).toBe('2026-06-01T10:00:00.000Z')
    })
    it('aceita formato HH:MM:SS (com segundos)', () => {
        const inst = instantAtBrTime('2026-06-01', '07:00:00')
        expect(inst.toISOString()).toBe('2026-06-01T10:00:00.000Z')
    })
})

describe('computeReminderAt', () => {
    it('retorna 1 hora antes do início da ocorrência', () => {
        const reminder = computeReminderAt('2026-06-01', '07:00')
        // 07:00 BRT = 10:00 UTC → 1h antes = 09:00 UTC
        expect(reminder.toISOString()).toBe('2026-06-01T09:00:00.000Z')
    })
})

describe('buildReminderRowsForRule', () => {
    const rule: RecurringAppointment = {
        id: 'ra-1',
        trainer_id: 't-1',
        student_id: 's-1',
        day_of_week: 2,
        start_time: '07:00',
        duration_minutes: 60,
        frequency: 'weekly',
        starts_on: '2026-06-02', // Terça
        ends_on: null,
        status: 'active',
        notes: null,
        group_id: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
    }

    it('gera linhas com title/body corretos e status pending', () => {
        const now = new Date('2026-06-01T12:00:00Z')
        const rows = buildReminderRowsForRule(rule, 'Gustavo', now)
        expect(rows.length).toBeGreaterThan(0)
        const first = rows[0]
        expect(first.title).toBe('Treino em 1 hora')
        expect(first.body).toBe('Seu treino com Gustavo é às 07:00')
        expect(first.status).toBe('pending')
        expect(first.source).toBe('appointment_reminder')
        expect(first.recurring_appointment_id).toBe('ra-1')
    })

    it('respeita a janela de REMINDER_WINDOW_DAYS dias', () => {
        const now = new Date('2026-06-01T12:00:00Z')
        const rows = buildReminderRowsForRule(rule, 'Gustavo', now)
        // Weekly começando 02/06 — ~4 ou 5 ocorrências em 30 dias.
        expect(rows.length).toBeGreaterThanOrEqual(4)
        expect(rows.length).toBeLessThanOrEqual(5)
    })

    it('expõe constantes úteis', () => {
        expect(REMINDER_LEAD_MINUTES).toBe(60)
        expect(REMINDER_WINDOW_DAYS).toBe(30)
    })

    it('não retorna lembretes cuja data já passou', () => {
        // rule começou em 2020, janela vai pro futuro a partir de `now`
        const pastRule: RecurringAppointment = {
            ...rule,
            starts_on: '2020-01-01',
        }
        const now = new Date('2026-06-01T12:00:00Z')
        const rows = buildReminderRowsForRule(pastRule, 'Gustavo', now)
        for (const row of rows) {
            expect(new Date(row.scheduled_for).getTime()).toBeGreaterThan(now.getTime())
        }
    })
})

describe('buildImmediateInboxItem', () => {
    it('monta item com type="appointment" e status="unread"', () => {
        const msg = appointmentMessages.rotinaCriada(2, '07:00')
        const item = buildImmediateInboxItem('s-1', 't-1', msg, { foo: 'bar' })
        expect(item.type).toBe('appointment')
        expect(item.status).toBe('unread')
        expect(item.title).toBe(msg.title)
        expect(item.subtitle).toBe(msg.body)
        expect(item.payload).toEqual({ foo: 'bar' })
    })
})

// formatBrDateShort é re-exportado de `@kinevo/shared/utils/format-br-date`.
// Testes definitivos do comportamento ficam em:
//   shared/utils/__tests__/format-br-date.test.ts
// Aqui só validamos que o símbolo está exportado.
describe('formatBrDateShort (re-export)', () => {
    it('funciona via re-export local', () => {
        expect(formatBrDateShort('2026-04-28')).toBe('28/04')
    })
})

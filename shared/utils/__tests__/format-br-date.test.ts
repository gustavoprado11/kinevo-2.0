import { describe, it, expect } from 'vitest'
import {
    formatBrDate,
    formatBrDateShort,
    parseAnchoredDate,
} from '../format-br-date'

describe('formatBrDateShort', () => {
    describe('date-only input (YYYY-MM-DD)', () => {
        it('formata 28/04/2026 sem shift (caso que pegaria o bug)', () => {
            expect(formatBrDateShort('2026-04-28')).toBe('28/04')
        })

        it('formata virada de ano 31/12 — não projeta pra 30/12 por causa do TZ', () => {
            expect(formatBrDateShort('2026-12-31')).toBe('31/12')
        })

        it('formata 01/01 sem projetar pro ano anterior', () => {
            expect(formatBrDateShort('2026-01-01')).toBe('01/01')
        })
    })

    describe('ISO com hora', () => {
        it('meio do dia UTC → mesmo dia BRT', () => {
            expect(formatBrDateShort('2026-04-28T12:00:00Z')).toBe('28/04')
        })

        it('02:00 UTC = 23:00 BRT do dia anterior (comportamento correto)', () => {
            expect(formatBrDateShort('2026-04-28T02:00:00Z')).toBe('27/04')
        })
    })

    describe('input inválido', () => {
        it('retorna string vazia em string vazia', () => {
            expect(formatBrDateShort('')).toBe('')
        })

        it('retorna string vazia em string não-parseável', () => {
            expect(formatBrDateShort('not a date')).toBe('')
        })
    })
})

describe('formatBrDate', () => {
    describe('date-only input (YYYY-MM-DD)', () => {
        it('formata 28/04/2026 sem shift', () => {
            expect(formatBrDate('2026-04-28')).toBe('28/04/2026')
        })

        it('formata 01/01/2026 sem shift pra ano anterior', () => {
            expect(formatBrDate('2026-01-01')).toBe('01/01/2026')
        })

        it('formata 31/12/2026 sem shift pro dia seguinte', () => {
            expect(formatBrDate('2026-12-31')).toBe('31/12/2026')
        })
    })

    describe('ISO com hora', () => {
        it('meio do dia UTC → mesmo dia BRT com ano', () => {
            expect(formatBrDate('2026-04-28T12:00:00Z')).toBe('28/04/2026')
        })

        it('02:00 UTC = 23:00 BRT do dia anterior (comportamento correto)', () => {
            expect(formatBrDate('2026-04-28T02:00:00Z')).toBe('27/04/2026')
        })
    })

    describe('input inválido', () => {
        it('retorna string vazia em string vazia', () => {
            expect(formatBrDate('')).toBe('')
        })

        it('retorna string vazia em string não-parseável', () => {
            expect(formatBrDate('not a date')).toBe('')
        })
    })

    describe('timestamp ancorado (meia-noite UTC — convenção Asaas)', () => {
        it('CS1: vencimento 15/set NÃO vira 14/set em BRT', () => {
            expect(formatBrDate('2026-09-15T00:00:00+00:00')).toBe('15/09/2026')
        })

        it('variação .000Z também é tratada como data-âncora', () => {
            expect(formatBrDate('2026-09-15T00:00:00.000Z')).toBe('15/09/2026')
        })
    })
})

describe('parseAnchoredDate', () => {
    it('date-only ancora ao meio-dia UTC (dia estável em qualquer fuso)', () => {
        const d = parseAnchoredDate('2026-09-15')!
        expect(d.toISOString()).toBe('2026-09-15T12:00:00.000Z')
    })

    it('meia-noite UTC re-ancora ao meio-dia UTC do MESMO dia', () => {
        const d = parseAnchoredDate('2026-09-15T00:00:00+00:00')!
        expect(d.toISOString()).toBe('2026-09-15T12:00:00.000Z')
        expect(
            d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        ).toBe('15/09/2026')
    })

    it('timestamp real passa intacto', () => {
        const d = parseAnchoredDate('2026-09-15T18:30:00Z')!
        expect(d.toISOString()).toBe('2026-09-15T18:30:00.000Z')
    })

    it('inválido/vazio → null', () => {
        expect(parseAnchoredDate('')).toBeNull()
        expect(parseAnchoredDate('not a date')).toBeNull()
    })
})

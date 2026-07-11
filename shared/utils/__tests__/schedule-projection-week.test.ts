import { describe, expect, it } from 'vitest'
import { getISOWeekRange, getWeekRange } from '../schedule-projection'

// CS5: o modo timezone-aware deve ancorar a semana na MEIA-NOITE do fuso
// pedido, independente do fuso do runtime (Vercel roda em UTC; devices em
// BRT). Asserções em instantes UTC exatos — falham em runtime UTC com a
// implementação antiga (`new Date(key + 'T00:00:00')`).
const TZ = 'America/Sao_Paulo' // UTC−3 fixo (sem DST desde 2019)

describe('getWeekRange (timezone-aware, CS5)', () => {
    it('semana começa segunda 00:00 do FUSO (=03:00Z), não do runtime', () => {
        // Quarta 08/jul/2026 15:00 BRT
        const d = new Date('2026-07-08T15:00:00-03:00')
        const { start, end } = getWeekRange(d, TZ)
        expect(start.toISOString()).toBe('2026-07-06T03:00:00.000Z') // seg 00:00 BRT
        expect(end.toISOString()).toBe('2026-07-13T02:59:59.999Z') // dom 23:59:59.999 BRT
    })

    it('treino de domingo 23:30 BRT pertence à semana corrente (não à seguinte)', () => {
        const sundayNight = new Date('2026-07-12T23:30:00-03:00')
        const { start, end } = getWeekRange(sundayNight, TZ)
        expect(start.toISOString()).toBe('2026-07-06T03:00:00.000Z')
        expect(sundayNight.getTime()).toBeGreaterThanOrEqual(start.getTime())
        expect(sundayNight.getTime()).toBeLessThanOrEqual(end.getTime())
    })

    it('domingo 01:00 BRT (=04:00Z, segunda em UTC) ainda é a semana ANTERIOR', () => {
        // O dia-calendário e o dia-da-semana têm que ser avaliados no fuso
        // pedido — em UTC esse instante já é segunda-feira.
        const sundayEarly = new Date('2026-07-12T01:00:00-03:00')
        const { start } = getWeekRange(sundayEarly, TZ)
        expect(start.toISOString()).toBe('2026-07-06T03:00:00.000Z')
    })

    it('segunda 00:00 BRT em ponto abre a própria semana', () => {
        const mondayMidnight = new Date('2026-07-06T00:00:00-03:00')
        const { start } = getWeekRange(mondayMidnight, TZ)
        expect(start.toISOString()).toBe('2026-07-06T03:00:00.000Z')
    })

    it('semanas consecutivas são contíguas (fim + 1ms = próximo início)', () => {
        const { end } = getWeekRange(new Date('2026-07-08T15:00:00-03:00'), TZ)
        const { start: nextStart } = getWeekRange(
            new Date('2026-07-14T15:00:00-03:00'),
            TZ,
        )
        expect(end.getTime() + 1).toBe(nextStart.getTime())
    })

    it('getISOWeekRange delega e devolve o mesmo range', () => {
        const d = new Date('2026-07-08T15:00:00-03:00')
        const a = getWeekRange(d, TZ)
        const b = getISOWeekRange(d, TZ)
        expect(b.start.getTime()).toBe(a.start.getTime())
        expect(b.end.getTime()).toBe(a.end.getTime())
    })
})

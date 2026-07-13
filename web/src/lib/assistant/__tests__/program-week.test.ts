// Semana atual do programa no contexto (fix 13/jul): sem ela o modelo improvisa
// aritmética com nº de sessões para responder "é a última semana?" — visto em prod.

import { describe, it, expect } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-key'

const { describeProgramWeek } = await import('../context-builder')

const NOW = new Date('2026-07-13T12:00:00-03:00')

describe('describeProgramWeek', () => {
    it('computa a semana corrente a partir de started_at', () => {
        // Iniciado há 22 dias → 4ª semana.
        expect(describeProgramWeek('2026-06-21T12:00:00-03:00', 4, NOW)).toBe(
            'semana 4 de 4; iniciado em 21/06',
        )
        // Iniciado hoje → semana 1.
        expect(describeProgramWeek('2026-07-13T08:00:00-03:00', 8, NOW)).toBe(
            'semana 1 de 8; iniciado em 13/07',
        )
    })

    it('passou da duração → avisa explicitamente', () => {
        expect(describeProgramWeek('2026-05-01T12:00:00-03:00', 4, NOW)).toContain(
            'JÁ PASSOU da duração planejada',
        )
    })

    it('sem started_at ou data inválida/futura → só a duração', () => {
        expect(describeProgramWeek(null, 4, NOW)).toBe('4 semanas')
        expect(describeProgramWeek('data-torta', 4, NOW)).toBe('4 semanas')
        expect(describeProgramWeek('2026-08-01T00:00:00Z', 4, NOW)).toBe('4 semanas')
        expect(describeProgramWeek(null, null, NOW)).toBe('duração não definida')
    })
})

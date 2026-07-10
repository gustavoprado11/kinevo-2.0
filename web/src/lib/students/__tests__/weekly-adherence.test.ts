import { describe, it, expect } from 'vitest'
import { getWeekRange } from '@kinevo/shared/utils/schedule-projection'
import { computeWeeklyAdherence } from '../weekly-adherence'

/**
 * Prova de paridade com o cálculo inline antigo de students/[id]/page.tsx:
 *   completedThisWeek = sessions.filter(completed_at ∈ getWeekRange).length
 *   expectedPerWeek   = Σ workout.scheduled_days.length
 * Se esta suíte passar, o refactor é byte-idêntico ao comportamento da página.
 */

// Referência fixa: quarta-feira 2026-07-08 12:00 (America/Sao_Paulo).
const NOW = new Date('2026-07-08T15:00:00.000Z') // 12:00 em São Paulo (UTC-3)
const TZ = 'America/Sao_Paulo'

// Replica exata do cálculo antigo da página, para comparar 1:1.
function legacyCompute(
    sessions: { completed_at: string | null }[],
    workouts: { scheduled_days: number[] | null }[] | undefined,
    now: Date,
) {
    const range = getWeekRange(now, TZ)
    const completedThisWeek = sessions.filter(s => {
        if (!s.completed_at) return false
        const d = new Date(s.completed_at)
        return d >= range.start && d <= range.end
    }).length || 0
    let expectedPerWeek = 0
    if (workouts) for (const w of workouts) expectedPerWeek += w.scheduled_days?.length || 0
    return { completedThisWeek, expectedPerWeek }
}

describe('computeWeeklyAdherence', () => {
    it('bate exatamente com o cálculo inline antigo (done/expected)', () => {
        const sessions = [
            { completed_at: '2026-07-06T14:00:00Z' }, // segunda desta semana
            { completed_at: '2026-07-08T13:00:00Z' }, // quarta desta semana
            { completed_at: '2026-06-30T14:00:00Z' }, // semana passada — fora
            { completed_at: null },                    // sem data — ignorado
        ]
        const workouts = [
            { scheduled_days: [1, 4] },       // 2
            { scheduled_days: [2, 5] },       // 2
            { scheduled_days: null },         // 0
        ]
        const legacy = legacyCompute(sessions, workouts, NOW)
        const got = computeWeeklyAdherence(sessions, workouts, { now: NOW, timeZone: TZ })
        expect(got.done).toBe(legacy.completedThisWeek)
        expect(got.expected).toBe(legacy.expectedPerWeek)
        expect(got.done).toBe(2)
        expect(got.expected).toBe(4)
    })

    it('não deduplica dias repetidos entre treinos (soma comprimentos, como a página)', () => {
        const workouts = [
            { scheduled_days: [1, 3] }, // 2
            { scheduled_days: [1, 3] }, // 2 (mesmos dias) → total 4, não 2
        ]
        const got = computeWeeklyAdherence([], workouts, { now: NOW, timeZone: TZ })
        expect(got.expected).toBe(4)
    })

    it('sem programa/treinos → expected 0 e pct 0', () => {
        const got = computeWeeklyAdherence(
            [{ completed_at: '2026-07-08T13:00:00Z' }],
            [],
            { now: NOW, timeZone: TZ },
        )
        expect(got).toEqual({ done: 1, expected: 0, pct: 0 })
    })

    it('semana sem sessões → done 0 e pct 0', () => {
        const got = computeWeeklyAdherence([], [{ scheduled_days: [1, 4] }], { now: NOW, timeZone: TZ })
        expect(got).toEqual({ done: 0, expected: 2, pct: 0 })
    })

    it('pct = min(100, round(done/expected*100))', () => {
        // 3 de 4 = 75%
        const s = [
            { completed_at: '2026-07-06T14:00:00Z' },
            { completed_at: '2026-07-07T14:00:00Z' },
            { completed_at: '2026-07-08T13:00:00Z' },
        ]
        const got = computeWeeklyAdherence(s, [{ scheduled_days: [1, 2, 3, 4] }], { now: NOW, timeZone: TZ })
        expect(got.pct).toBe(75)
    })

    it('pct nunca passa de 100 (mais sessões que o esperado)', () => {
        const s = [
            { completed_at: '2026-07-06T14:00:00Z' },
            { completed_at: '2026-07-07T14:00:00Z' },
            { completed_at: '2026-07-08T13:00:00Z' },
        ]
        const got = computeWeeklyAdherence(s, [{ scheduled_days: [1] }], { now: NOW, timeZone: TZ })
        expect(got.done).toBe(3)
        expect(got.expected).toBe(1)
        expect(got.pct).toBe(100)
    })

    it('null/undefined em sessions e workouts é seguro', () => {
        expect(computeWeeklyAdherence(null, null, { now: NOW, timeZone: TZ })).toEqual({ done: 0, expected: 0, pct: 0 })
        expect(computeWeeklyAdherence(undefined, undefined, { now: NOW, timeZone: TZ })).toEqual({ done: 0, expected: 0, pct: 0 })
    })
})

import { describe, expect, it } from 'vitest'
import type { CardioConfig, CardioWeekOverride } from '../../../types/workout-items'
import {
    applyOverride,
    hasProgression,
    maxProgressionWeek,
    programWeekNumber,
    resolveCardioForWeek,
    sortedProgression,
} from '../progression'

// ============================================================================
// programWeekNumber — convenção canônica do produto (getProgramWeek: dias
// civis LOCAIS nos dois lados). Datas de teste SEM fuso → parse local →
// determinístico em qualquer TZ de CI.
// ============================================================================

describe('programWeekNumber', () => {
    const started = new Date(2026, 6, 22) // 22/jul local (dia escolhido)

    it('dia do início → semana 1; dia 6 → semana 1; dia 7 → semana 2', () => {
        expect(programWeekNumber(started, new Date(2026, 6, 22, 8, 0))).toBe(1)
        expect(programWeekNumber(started, new Date(2026, 6, 28, 23, 59))).toBe(1)
        expect(programWeekNumber(started, new Date(2026, 6, 29, 0, 1))).toBe(2)
    })

    it('a hora do dia não muda a semana (startOfDay nos dois lados)', () => {
        expect(programWeekNumber(new Date(2026, 6, 22, 19, 30), new Date(2026, 6, 28, 21, 30))).toBe(1)
    })

    it('semana 12 e além (não clampa na duração)', () => {
        expect(programWeekNumber(started, new Date(2026, 9, 7))).toBe(12) // 77 dias
        expect(programWeekNumber(started, new Date(2026, 9, 14))).toBe(13)
    })

    it('futuro → 1; ausente/inválida → null', () => {
        expect(programWeekNumber(started, new Date(2026, 6, 10))).toBe(1)
        expect(programWeekNumber(null)).toBeNull()
        expect(programWeekNumber('data-torta')).toBeNull()
        expect(programWeekNumber(undefined)).toBeNull()
    })
})

// ============================================================================
// resolveCardioForWeek — semântica "vale a partir da semana N"
// ============================================================================

const longao: CardioConfig = {
    mode: 'continuous',
    equipment: 'outdoor_run',
    objective: 'distance',
    distance_km: 6,
    intensity: 'RPE 4',
    intensity_target: { type: 'rpe', rpe: 4 },
    notes: 'Hidratar bem.',
    progression: [
        { week: 2, distance_km: 7 },
        { week: 3, distance_km: 8 },
        { week: 4, distance_km: 6, label: 'Regenerativa' },
        { week: 5, distance_km: 9 },
        { week: 12, distance_km: 15, label: 'Semana da prova' },
    ],
}

describe('resolveCardioForWeek', () => {
    it('semana sem override antes do primeiro → base', () => {
        const r = resolveCardioForWeek(longao, 1)
        expect(r.config.distance_km).toBe(6)
        expect(r.overrideWeek).toBeNull()
        expect(r.label).toBeNull()
        expect(r.config.progression).toBeUndefined()
    })

    it('override exato da semana', () => {
        const r = resolveCardioForWeek(longao, 3)
        expect(r.config.distance_km).toBe(8)
        expect(r.overrideWeek).toBe(3)
        // merge raso preserva o resto da base
        expect(r.config.intensity).toBe('RPE 4')
        expect(r.config.equipment).toBe('outdoor_run')
        expect(r.config.notes).toBe('Hidratar bem.')
    })

    it('semana entre overrides usa o anterior ("vale a partir de")', () => {
        const r = resolveCardioForWeek(longao, 8)
        expect(r.config.distance_km).toBe(9) // override da semana 5
        expect(r.overrideWeek).toBe(5)
    })

    it('semana além da última definida usa a última (clamp natural)', () => {
        const r = resolveCardioForWeek(longao, 14)
        expect(r.config.distance_km).toBe(15)
        expect(r.overrideWeek).toBe(12)
        expect(r.label).toBe('Semana da prova')
    })

    it('rótulo da semana regenerativa', () => {
        expect(resolveCardioForWeek(longao, 4).label).toBe('Regenerativa')
    })

    it('week null (template) ou config sem progressão → base', () => {
        expect(resolveCardioForWeek(longao, null).config.distance_km).toBe(6)
        const semProg: CardioConfig = { mode: 'continuous', duration_minutes: 30 }
        expect(resolveCardioForWeek(semProg, 5).config.duration_minutes).toBe(30)
    })

    it('funciona com progression fora de ordem', () => {
        const bagunçado: CardioConfig = {
            ...longao,
            progression: [...(longao.progression ?? [])].reverse(),
        }
        expect(resolveCardioForWeek(bagunçado, 8).config.distance_km).toBe(9)
    })
})

// ============================================================================
// applyOverride — merge raso vs substituição estrutural + higiene
// ============================================================================

describe('applyOverride (merge raso)', () => {
    it('alvo novo sem string nova descarta a intensity herdada', () => {
        const out = applyOverride(longao, { week: 5, intensity_target: { type: 'zone', zone: 3 } })
        expect(out.intensity_target?.zone).toBe(3)
        expect(out.intensity).toBeUndefined()
    })

    it('intervals novos sem protocolo descartam o selo herdado', () => {
        const base: CardioConfig = {
            mode: 'interval',
            intervals: { work_seconds: 20, rest_seconds: 10, rounds: 8 },
            protocol_key: 'tabata',
        }
        const out = applyOverride(base, {
            week: 3,
            intervals: { work_seconds: 30, rest_seconds: 30, rounds: 10 },
        })
        expect(out.protocol_key).toBeUndefined()
        expect(out.intervals?.rounds).toBe(10)
    })

    it('segments novos descartam total/resumo herdados', () => {
        const base: CardioConfig = {
            mode: 'phased',
            duration_minutes: 32,
            intensity: '8min RPE 4 → 7× 60/120 RPE 7 → 5min RPE 3',
            segments: [{ kind: 'steady', duration_minutes: 8 }],
        }
        const out = applyOverride(base, {
            week: 5,
            segments: [{ kind: 'steady', duration_minutes: 20 }],
        })
        expect(out.duration_minutes).toBeUndefined()
        expect(out.intensity).toBeUndefined()
        expect(out.segments).toHaveLength(1)
    })
})

describe('applyOverride (substituição estrutural, override com mode)', () => {
    // Caso Alysson: qualidade fartlek (phased) que vira tempo run (continuous).
    const qualidade: CardioConfig = {
        mode: 'phased',
        equipment: 'outdoor_run',
        duration_minutes: 32,
        intensity: '8min RPE 4 → 7× 60/120 RPE 7 → 5min RPE 3',
        segments: [
            { kind: 'steady', label: 'Aquecimento', duration_minutes: 8 },
            { kind: 'interval', label: 'Fartlek', intervals: { work_seconds: 60, rest_seconds: 120, rounds: 7 } },
            { kind: 'steady', label: 'Volta à calma', duration_minutes: 5 },
        ],
        notes: 'Sempre aquecer antes.',
    }

    const tempoRun: CardioWeekOverride = {
        week: 9,
        label: 'Fase tempo',
        mode: 'continuous',
        objective: 'time',
        duration_minutes: 25,
        intensity_target: { type: 'rpe', rpe: 7 },
    }

    it('estrutura da base é descartada; equipment e notes herdam', () => {
        const out = applyOverride(qualidade, tempoRun)
        expect(out.mode).toBe('continuous')
        expect(out.segments).toBeUndefined()
        expect(out.intervals).toBeUndefined()
        expect(out.intensity).toBeUndefined() // resumo phased não vaza
        expect(out.duration_minutes).toBe(25)
        expect(out.equipment).toBe('outdoor_run')
        expect(out.notes).toBe('Sempre aquecer antes.')
    })

    it('notes do override vencem as da base', () => {
        const out = applyOverride(qualidade, { ...tempoRun, notes: 'Sem tiros hoje.' })
        expect(out.notes).toBe('Sem tiros hoje.')
    })

    it('via resolveCardioForWeek: semana 10 pega a fase tempo da semana 9', () => {
        const cfg: CardioConfig = { ...qualidade, progression: [tempoRun] }
        const r = resolveCardioForWeek(cfg, 10)
        expect(r.config.mode).toBe('continuous')
        expect(r.overrideWeek).toBe(9)
        expect(r.label).toBe('Fase tempo')
    })
})

// ============================================================================
// Utilitários
// ============================================================================

describe('utilitários', () => {
    it('hasProgression / maxProgressionWeek / sortedProgression', () => {
        expect(hasProgression(longao)).toBe(true)
        expect(hasProgression({ mode: 'continuous' })).toBe(false)
        expect(hasProgression({ mode: 'continuous', progression: [] })).toBe(false)
        expect(hasProgression(null)).toBe(false)
        expect(maxProgressionWeek(longao)).toBe(12)
        expect(maxProgressionWeek({ mode: 'continuous' })).toBeNull()
        const sorted = sortedProgression({ ...longao, progression: [{ week: 9 }, { week: 2 }] })
        expect(sorted.map(o => o.week)).toEqual([2, 9])
    })
})

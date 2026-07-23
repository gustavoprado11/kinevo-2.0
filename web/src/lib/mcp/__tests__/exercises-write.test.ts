// Guardrail do create_exercise: atividade aeróbia não vira exercício de
// biblioteca (visto em prod jul/2026: "Corrida — Longão" criado como força,
// "registrar km no campo de reps"). Match por palavra inteira, sem acentos.

import { describe, expect, it } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-key'

const { looksLikeAerobicActivity } = await import('../tools/exercises-write')

describe('looksLikeAerobicActivity', () => {
    it('detecta os nomes reais criados pelo agente em prod', () => {
        expect(looksLikeAerobicActivity('Corrida — Longão')).toBe(true)
        expect(looksLikeAerobicActivity('Corrida — Qualidade (Fartlek/Intervalado/Tempo)')).toBe(true)
        expect(looksLikeAerobicActivity('Corrida — Fácil (Zona 2)')).toBe(true)
    })

    it('detecta modalidades aeróbias comuns (com e sem acento)', () => {
        expect(looksLikeAerobicActivity('Caminhada inclinada')).toBe(true)
        expect(looksLikeAerobicActivity('Bike ergométrica')).toBe(true)
        expect(looksLikeAerobicActivity('Natação livre')).toBe(true)
        expect(looksLikeAerobicActivity('natacao livre')).toBe(true)
        expect(looksLikeAerobicActivity('HIIT na esteira')).toBe(true)
        expect(looksLikeAerobicActivity('Remo 500m')).toBe(true)
        expect(looksLikeAerobicActivity('Trote regenerativo')).toBe(true)
        expect(looksLikeAerobicActivity('Cardio LISS')).toBe(true)
    })

    it('NÃO dispara em exercícios de força legítimos', () => {
        expect(looksLikeAerobicActivity('Remada curvada')).toBe(false)
        expect(looksLikeAerobicActivity('Agachamento búlgaro com halteres')).toBe(false)
        expect(looksLikeAerobicActivity('Supino reto')).toBe(false)
        expect(looksLikeAerobicActivity('Levantamento terra romeno')).toBe(false)
        expect(looksLikeAerobicActivity('Panturrilha em pé')).toBe(false)
        expect(looksLikeAerobicActivity('Escalador (mountain climber)')).toBe(false)
    })

    it('falso positivo conhecido tem escape (confirm_strength): corrida de trenó', () => {
        // O guard DISPARA (palavra "corrida") — o escape é o confirm_strength.
        expect(looksLikeAerobicActivity('Corrida de trenó')).toBe(true)
    })
})

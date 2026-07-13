// Regras do timer de descanso (Sala de Treino web + mobile).
//
// Dois pontos sensíveis, ambos vindos de bugs reais:
// - `0` é escolha do treinador ("emenda direto"), NÃO ausência de descanso: em
//   prod são 182 filhos de superset e 97 exercícios soltos com 0 explícito.
//   Só `null` (11 itens) significa "não prescrito" e cai no padrão do treinador.
// - No superset o descanso é por exercício, e o do último filho é o da rodada.

import { describe, it, expect } from 'vitest'
import { resolveRestSeconds, effectiveRestSeconds, type RestTimerExercise } from '../rest-timer'

const PREFS = { restTimerAuto: true, defaultRestSeconds: 90 }

const set = (completed = false) => ({ completed })

function exercise(over: Partial<RestTimerExercise> = {}): RestTimerExercise {
    return {
        id: 'ex-1',
        rest_seconds: 60,
        setsData: [set(), set(), set()],
        setScheme: [],
        supersetId: null,
        ...over,
    }
}

describe('effectiveRestSeconds', () => {
    it('null (não prescrito) vira a duração padrão do treinador', () => {
        expect(effectiveRestSeconds(null, PREFS)).toBe(90)
    })

    it('0 (sem descanso, escolha do treinador) continua 0', () => {
        expect(effectiveRestSeconds(0, PREFS)).toBe(0)
    })

    it('valor prescrito é preservado', () => {
        expect(effectiveRestSeconds(45, PREFS)).toBe(45)
    })
})

describe('resolveRestSeconds — exercício solto', () => {
    it('dispara com o descanso do exercício', () => {
        expect(resolveRestSeconds([exercise()], 0, 0, PREFS)).toBe(60)
    })

    it('não dispara com o timer automático desligado', () => {
        const prefs = { ...PREFS, restTimerAuto: false }
        expect(resolveRestSeconds([exercise()], 0, 0, prefs)).toBeNull()
    })

    it('não dispara ao DESmarcar série já concluída', () => {
        const ex = exercise({ setsData: [set(true), set(), set()] })
        expect(resolveRestSeconds([ex], 0, 0, PREFS)).toBeNull()
    })

    it('não dispara depois da última série', () => {
        const ex = exercise({ setsData: [set(true), set(true), set()] })
        expect(resolveRestSeconds([ex], 0, 2, PREFS)).toBeNull()
    })

    it('descanso não prescrito (null) usa a duração padrão', () => {
        expect(resolveRestSeconds([exercise({ rest_seconds: null })], 0, 0, PREFS)).toBe(90)
    })

    it('descanso 0 do exercício = sem timer (não cai no padrão)', () => {
        expect(resolveRestSeconds([exercise({ rest_seconds: 0 })], 0, 0, PREFS)).toBeNull()
    })

    it('descanso por série vence o do exercício', () => {
        const ex = exercise({
            rest_seconds: 60,
            setScheme: [{ rest_seconds: 120 }, { rest_seconds: 45 }, { rest_seconds: 30 }],
        })
        expect(resolveRestSeconds([ex], 0, 0, PREFS)).toBe(120)
        expect(resolveRestSeconds([ex], 0, 1, PREFS)).toBe(45)
    })

    it('descanso 0 por série (drop-set) = sem timer', () => {
        const ex = exercise({
            rest_seconds: 90,
            setScheme: [{ rest_seconds: 0 }, { rest_seconds: 0 }, { rest_seconds: 120 }],
        })
        expect(resolveRestSeconds([ex], 0, 0, PREFS)).toBeNull()
        expect(resolveRestSeconds([ex], 0, 1, PREFS)).toBeNull()
    })
})

describe('resolveRestSeconds — superset (descanso por exercício)', () => {
    // A emenda direto no B (0s); B descansa 90s = descanso da rodada.
    const group = (over: { a?: Partial<RestTimerExercise>; b?: Partial<RestTimerExercise> } = {}) => [
        exercise({ id: 'A', supersetId: 'ss-1', rest_seconds: 0, setsData: [set(), set()], ...over.a }),
        exercise({ id: 'B', supersetId: 'ss-1', rest_seconds: 90, setsData: [set(), set()], ...over.b }),
    ]

    it('filho com 0 = emenda direto, sem timer', () => {
        expect(resolveRestSeconds(group(), 0, 0, PREFS)).toBeNull()
    })

    it('filho do meio com descanso próprio dispara mesmo na última série dele', () => {
        // A tem descanso 30s e já concluiu a 1ª série; conclui a 2ª (última DELE),
        // mas o B ainda tem a 2ª rodada pela frente → descansa antes de emendar.
        const exercises = group({
            a: { rest_seconds: 30, setsData: [set(true), set()] },
            b: { setsData: [set(true), set()] },
        })
        expect(resolveRestSeconds(exercises, 0, 1, PREFS)).toBe(30)
    })

    it('último filho dispara o descanso da rodada quando ainda há rodada', () => {
        const exercises = group({ a: { setsData: [set(true), set()] } })
        expect(resolveRestSeconds(exercises, 1, 0, PREFS)).toBe(90)
    })

    it('último filho na última rodada NÃO dispara (não sobra timer no fim)', () => {
        const exercises = group({
            a: { setsData: [set(true), set(true)] },
            b: { setsData: [set(true), set()] },
        })
        expect(resolveRestSeconds(exercises, 1, 1, PREFS)).toBeNull()
    })

    it('filho sem descanso prescrito (null) cai no padrão do treinador', () => {
        const exercises = group({ a: { rest_seconds: null } })
        expect(resolveRestSeconds(exercises, 0, 0, PREFS)).toBe(90)
    })

    it('ignora o setScheme do filho (regra V1: filho não tem prescrição por série)', () => {
        const exercises = group({ a: { rest_seconds: 30, setScheme: [{ rest_seconds: 999 }] } })
        expect(resolveRestSeconds(exercises, 0, 0, PREFS)).toBe(30)
    })
})

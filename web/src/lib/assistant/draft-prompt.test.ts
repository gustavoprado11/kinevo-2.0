import { describe, it, expect } from 'vitest'
import { buildContextBlock, parseDraftOutput, type InsightForDraft } from './draft-prompt'
import type { DraftContext } from './student-context'

const insight: InsightForDraft = {
    title: 'João está estagnado no supino',
    body: 'Mesma carga há 3 semanas.',
    insight_key: 'stagnation:abc:def:2026-06-15',
    action_metadata: {},
}

const richCtx: DraftContext = {
    studentName: 'João',
    sessionsLast30d: 8,
    lastSessionAt: '2026-06-10T10:00:00.000Z',
    daysSinceLast: 5,
    avgRpe: 7.5,
    checkins: [
        { date: '2026-06-10T10:00:00.000Z', context: 'post_workout', formTitle: 'Check-in pós', answers: { energia: 2 } },
    ],
    hasData: true,
}

const emptyCtx: DraftContext = {
    studentName: 'Maria',
    sessionsLast30d: 0,
    lastSessionAt: null,
    daysSinceLast: null,
    avgRpe: null,
    checkins: [],
    hasData: false,
}

describe('buildContextBlock', () => {
    it('inclui o que o insight detectou e os dados de progresso', () => {
        const block = buildContextBlock({ trainerName: 'Carlos', insight, ctx: richCtx })
        expect(block).toContain('João está estagnado no supino')
        expect(block).toContain('8 treino(s)')
        expect(block).toContain('Último treino há 5 dia(s)')
        expect(block).toContain('RPE médio')
        expect(block).toContain('Check-in pós')
    })

    it('adiciona o aviso de contexto pobre quando não há dados', () => {
        const block = buildContextBlock({ trainerName: 'Carlos', insight, ctx: emptyCtx })
        expect(block).toContain('ATENÇÃO')
        expect(block).toContain('Nenhum check-in recente')
    })
})

describe('parseDraftOutput', () => {
    it('parseia uma resposta válida', () => {
        const raw = JSON.stringify({
            message: 'Oi João, vi que você sumiu faz 5 dias. Tá tudo bem?',
            references: ['Último treino há 5 dias'],
            confidence: 'high',
        })
        const out = parseDraftOutput(raw, true)
        expect(out).not.toBeNull()
        expect(out!.message).toContain('João')
        expect(out!.references).toEqual(['Último treino há 5 dias'])
        expect(out!.confidence).toBe('high')
    })

    it('força confidence=low quando não havia dados, mesmo se o modelo disse high', () => {
        const raw = JSON.stringify({ message: 'Oi, como vai?', references: [], confidence: 'high' })
        const out = parseDraftOutput(raw, false)
        expect(out!.confidence).toBe('low')
    })

    it('retorna null em JSON inválido', () => {
        expect(parseDraftOutput('not json', true)).toBeNull()
    })

    it('retorna null quando falta message', () => {
        expect(parseDraftOutput(JSON.stringify({ references: [] }), true)).toBeNull()
    })

    it('descarta references não-string', () => {
        const raw = JSON.stringify({ message: 'oi', references: ['ok', 42, null], confidence: 'low' })
        const out = parseDraftOutput(raw, true)
        expect(out!.references).toEqual(['ok'])
    })
})

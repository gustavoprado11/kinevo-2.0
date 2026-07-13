// A entrevista precisa TERMINAR, sempre, na mesma ordem, mesmo que o modelo se
// perca. Quem garante isso é o estado — o roteiro é recomputado em código a cada
// turno, e o modelo só lê. Estes testes travam essa propriedade.

import { describe, it, expect } from 'vitest'
import {
    buildStyleInterviewInstructions,
    emptyStyleState,
    isInterviewComplete,
    nextPendingSlot,
    parseStyleState,
    remainingSlots,
    type StyleState,
} from './style-state'
import { STYLE_SLOT_IDS } from './style-slots'

function stateWith(over: Partial<StyleState> = {}): StyleState {
    return { ...emptyStyleState(), ...over }
}

describe('progresso da entrevista', () => {
    it('sem mineração, pergunta o roteiro inteiro na ordem', () => {
        const state = stateWith()
        expect(remainingSlots(state)).toEqual([...STYLE_SLOT_IDS])
        expect(nextPendingSlot(state)).toBe('split')
    })

    it('slot minerado é pulado', () => {
        const state = stateWith({ minedSlots: ['split', 'reps', 'rest', 'volume', 'supersets'] })
        // Restam methods + os 3 de filosofia (nunca mineráveis).
        expect(remainingSlots(state)).toEqual(['methods', 'progression', 'warmup', 'notes'])
        expect(nextPendingSlot(state)).toBe('methods')
    })

    it('slot respondido é pulado, e a ordem se mantém', () => {
        const state = stateWith({
            minedSlots: ['split'],
            answers: { reps: 'Compostos 6–8, acessórios 10–15' },
        })
        expect(nextPendingSlot(state)).toBe('rest')
    })

    it('a entrevista termina quando não sobra slot', () => {
        const answers = Object.fromEntries(STYLE_SLOT_IDS.map((s) => [s, 'resposta']))
        const state = stateWith({ answers })
        expect(nextPendingSlot(state)).toBeNull()
        expect(isInterviewComplete(state)).toBe(true)
    })

    it('mineração + respostas cobrindo tudo também encerra', () => {
        const state = stateWith({
            minedSlots: ['split', 'reps', 'rest', 'volume', 'methods', 'supersets'],
            answers: { progression: 'dupla progressão', warmup: 'aproximação', notes: 'Nada a acrescentar' },
        })
        expect(isInterviewComplete(state)).toBe(true)
    })
})

describe('prompt do entrevistador', () => {
    it('manda perguntar só o primeiro slot pendente', () => {
        const state = stateWith({ minedSlots: ['split', 'reps'] })
        const prompt = buildStyleInterviewInstructions(state, 'Gustavo Prado')

        expect(prompt).toContain('slot="rest"')
        expect(prompt).toContain('Uma pergunta por turno')
        // Slots minerados aparecem marcados para NÃO serem perguntados.
        expect(prompt).toContain('split — JÁ MINERADO')
        expect(prompt).toContain('reps — JÁ MINERADO')
    })

    it('mostra a resposta já dada, para o modelo não repetir a pergunta', () => {
        const state = stateWith({ answers: { split: 'PPL' } })
        const prompt = buildStyleInterviewInstructions(state)
        expect(prompt).toContain('split — RESPONDIDO: "PPL"')
        expect(prompt).toContain('slot="reps"')
    })

    it('roteiro completo → manda propor o estilo, não perguntar', () => {
        const answers = Object.fromEntries(STYLE_SLOT_IDS.map((s) => [s, 'resposta']))
        const prompt = buildStyleInterviewInstructions(stateWith({ answers }))
        expect(prompt).toContain('propor_ao_treinador')
        expect(prompt).toContain('salvar_estilo')
        expect(prompt).not.toContain('perguntar_estilo` com slot')
    })

    it('sem programas suficientes, avisa que o roteiro inteiro vai ser perguntado', () => {
        const prompt = buildStyleInterviewInstructions(stateWith({ programsAnalyzed: 2 }))
        expect(prompt).toContain('piso é 5')
    })
})

describe('parseStyleState', () => {
    it('estado ausente ou corrompido vira estado vazio (a entrevista recomeça, não quebra)', () => {
        expect(parseStyleState(null)).toEqual(emptyStyleState())
        expect(parseStyleState('lixo')).toEqual(emptyStyleState())
    })

    it('preserva o que veio do banco', () => {
        const state = parseStyleState({
            mined: { reps_compound: '6–8' },
            minedSlots: ['reps'],
            programsAnalyzed: 21,
            answers: { progression: 'dupla progressão' },
            pendingSlot: 'warmup',
        })
        expect(state.programsAnalyzed).toBe(21)
        expect(state.pendingSlot).toBe('warmup')
        expect(state.answers.progression).toBe('dupla progressão')
    })
})

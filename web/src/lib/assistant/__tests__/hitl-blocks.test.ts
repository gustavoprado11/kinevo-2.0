// P4: montagem por sinal do bloco HITL. O contrato: núcleo sempre presente;
// regras de mensagem só com sinal de comunicação; playbook de build só em turno
// de prescrição; SEM sinal nenhum vai tudo (nunca amputar sem confiança).

import { describe, it, expect } from 'vitest'
import { buildMcpHitlInstructions } from '../hitl-instructions'

const CORE = 'EFICIÊNCIA (importante)'
const CORE_B = 'HOMÔNIMOS'
const CORE_C = 'Nunca dispare uma ação sensível em lote'
const MESSAGING = 'ENVIAR MENSAGEM a um aluno'
const BUILD = 'CRIAR / MONTAR um programa de treino'

describe('buildMcpHitlInstructions', () => {
    it('núcleo está presente em QUALQUER combinação de sinais', () => {
        for (const intents of [[], ['financeiro'], ['comunicacao'], ['prescricao']] as const) {
            const s = buildMcpHitlInstructions({ intents: [...intents], buildTurn: false })
            expect(s).toContain(CORE)
            expect(s).toContain(CORE_B)
            expect(s).toContain(CORE_C)
        }
    })

    it('turno de financeiro não carrega mensagens nem build', () => {
        const s = buildMcpHitlInstructions({ intents: ['financeiro'], buildTurn: false })
        expect(s).not.toContain(MESSAGING)
        expect(s).not.toContain(BUILD)
    })

    it('sinal de comunicação traz as regras de mensagem', () => {
        const s = buildMcpHitlInstructions({ intents: ['comunicacao'], buildTurn: false })
        expect(s).toContain(MESSAGING)
        expect(s).not.toContain(BUILD)
    })

    it('prescrição OU buildTurn trazem o playbook de build', () => {
        expect(buildMcpHitlInstructions({ intents: ['prescricao'], buildTurn: false })).toContain(BUILD)
        expect(buildMcpHitlInstructions({ intents: ['agenda'], buildTurn: true })).toContain(BUILD)
    })

    it('sem sinal nenhum vai TUDO (nunca amputar sem confiança)', () => {
        const s = buildMcpHitlInstructions({ intents: [], buildTurn: false })
        expect(s).toContain(MESSAGING)
        expect(s).toContain(BUILD)
    })
})

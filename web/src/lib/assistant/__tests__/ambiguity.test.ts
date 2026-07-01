import { describe, it, expect } from 'vitest'
import { ambiguousStudentTarget, firstNameOf, normalizeName, type StudentRef } from '../ambiguity'

const roster: StudentRef[] = [
    { id: 'j1', name: 'João Silva' },
    { id: 'j2', name: 'João Pedro Costa' },
    { id: 'm1', name: 'Maria Souza' },
    { id: 'g1', name: 'Gustavo Prado' },
    { id: 'g2', name: 'Giovanna Prado' },
]

describe('ambiguity — normalização', () => {
    it('normaliza caixa e acentos', () => {
        expect(normalizeName('JOÃO')).toBe('joao')
        expect(firstNameOf('João Pedro Costa')).toBe('joao')
        expect(firstNameOf('  Maria Souza ')).toBe('maria')
    })
})

describe('ambiguousStudentTarget', () => {
    it('primeiro nome ambíguo (2 Joões) → devolve candidatos, alvo primeiro', () => {
        const cands = ambiguousStudentTarget('manda uma mensagem pro João', 'j1', roster)
        expect(cands).not.toBeNull()
        expect(cands![0].id).toBe('j1')
        expect(cands!.map((c) => c.id).sort()).toEqual(['j1', 'j2'])
    })

    it('acento não esconde a ambiguidade ("Joao" sem acento)', () => {
        expect(ambiguousStudentTarget('agenda uma sessão com o Joao', 'j2', roster)).not.toBeNull()
    })

    it('nome completo do alvo citado → escolha explícita, passa', () => {
        expect(ambiguousStudentTarget('manda mensagem pro João Silva', 'j1', roster)).toBeNull()
        expect(ambiguousStudentTarget('cria contrato pro João Pedro', 'j2', roster)).toBeNull()
    })

    it('nome completo de OUTRO homônimo citado (alvo errado) → ambíguo', () => {
        // Pedido fala do João Pedro, modelo mirou o j1 (João Silva) — bloqueia.
        expect(ambiguousStudentTarget('cria contrato pro João Pedro', 'j1', roster)).not.toBeNull()
    })

    it('sem homônimo → passa', () => {
        expect(ambiguousStudentTarget('manda mensagem pra Maria', 'm1', roster)).toBeNull()
    })

    it('primeiros nomes DIFERENTES (Gustavo × Giovanna) não são homônimos', () => {
        expect(ambiguousStudentTarget('manda mensagem pro Gustavo', 'g1', roster)).toBeNull()
    })

    it('pedido não cita o nome (referência por contexto) → passa', () => {
        expect(ambiguousStudentTarget('atualiza o objetivo desse aluno', 'j1', roster)).toBeNull()
    })

    it('aluno em foco na conversa (escopo explícito) desarma a guarda', () => {
        expect(ambiguousStudentTarget('manda mensagem pro João', 'j1', roster, 'j1')).toBeNull()
        // foco em OUTRO aluno não desarma (o alvo veio de outro lugar):
        expect(ambiguousStudentTarget('manda mensagem pro João', 'j1', roster, 'm1')).not.toBeNull()
    })

    it('alvo fora da carteira → passa (posse é validada em outra camada)', () => {
        expect(ambiguousStudentTarget('manda mensagem pro João', 'desconhecido', roster)).toBeNull()
    })
})

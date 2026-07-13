// Detecção de turno de build: cada caso aqui é um modo de falha real ou um
// falso positivo que custaria caro. O caso "planejar o próximo programa" e o
// da aprovação truncada vieram de prod (13/jul).

import { describe, it, expect } from 'vitest'
import { isBuildTurn } from '../build-signals'

const u = (content: string) => ({ role: 'user', content })
const a = (content: string) => ({ role: 'assistant', content })

describe('isBuildTurn', () => {
    it('verbos clássicos seguem casando', () => {
        expect(isBuildTurn('Monta um treino de hipertrofia pro João', [])).toBe(true)
        expect(isBuildTurn('cria um programa 4x pra Maria', [])).toBe(true)
    })

    it('REGRESSÃO prod 13/jul: "planejar o próximo programa" é build', () => {
        expect(isBuildTurn('Me ajude a planejar o próximo programa de treinos', [])).toBe(true)
    })

    it('frases nominais de renovação são build ("próximo programa", "ciclo novo")', () => {
        expect(isBuildTurn('vamos de próximo programa então', [])).toBe(true)
        expect(isBuildTurn('quero um ciclo novo pra ela', [])).toBe(true)
    })

    it('REGRESSÃO prod 13/jul: aprovação de proposta numa conversa de programa é build', () => {
        const history = [
            u('Me ajude a planejar o próximo programa de treinos'),
            a('Qual a frequência semanal?'),
            u('5x por semana'),
            a('Aprova a proposta abaixo?'),
        ]
        expect(
            isBuildTurn('Aprovado. Valores finais — Frequência: 5x por semana; Ênfase: Costas', history),
        ).toBe(true)
    })

    it('sinal também vem do histórico recente (turno de resposta curta)', () => {
        const history = [u('Me ajude a planejar o próximo programa de treinos'), a('Qual a ênfase?')]
        expect(isBuildTurn('Costas', history)).toBe(true)
    })

    it('consultas NÃO viram build: agenda, financeiro, "próximo treino"', () => {
        expect(isBuildTurn('quanto faturei esse mês?', [])).toBe(false)
        expect(isBuildTurn('qual o próximo treino do João?', [])).toBe(false)
        expect(isBuildTurn('reagenda a sessão de quinta', [])).toBe(false)
        // Aprovação de proposta que NÃO é de programa (ex.: plano financeiro).
        expect(isBuildTurn('Aprovado. Valores finais — Valor: R$ 250/mês', [u('cria um plano de cobrança mensal'), a('Aprova?')])).toBe(false)
    })
})

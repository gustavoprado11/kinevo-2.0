import { describe, it, expect } from 'vitest'
import { extractFrequencyFromName } from '../extract-frequency'

describe('extractFrequencyFromName', () => {
    it('extrai dia único em PT-BR após hífen', () => {
        expect(extractFrequencyFromName('Superior A - segunda')).toEqual({ name: 'Superior A', frequency: ['mon'] })
        expect(extractFrequencyFromName('Inferior A - terça')).toEqual({ name: 'Inferior A', frequency: ['tue'] })
        expect(extractFrequencyFromName('Treino A - quarta')).toEqual({ name: 'Treino A', frequency: ['wed'] })
        expect(extractFrequencyFromName('Treino A - quinta')).toEqual({ name: 'Treino A', frequency: ['thu'] })
        expect(extractFrequencyFromName('Treino A - sexta')).toEqual({ name: 'Treino A', frequency: ['fri'] })
        expect(extractFrequencyFromName('Treino A - sábado')).toEqual({ name: 'Treino A', frequency: ['sat'] })
        expect(extractFrequencyFromName('Treino A - domingo')).toEqual({ name: 'Treino A', frequency: ['sun'] })
    })

    it('aceita abreviações PT-BR', () => {
        expect(extractFrequencyFromName('A - seg')).toEqual({ name: 'A', frequency: ['mon'] })
        expect(extractFrequencyFromName('A - qui')).toEqual({ name: 'A', frequency: ['thu'] })
        expect(extractFrequencyFromName('A - 2a')).toEqual({ name: 'A', frequency: ['mon'] })
    })

    it('aceita inglês', () => {
        expect(extractFrequencyFromName('Push - Monday')).toEqual({ name: 'Push', frequency: ['mon'] })
        expect(extractFrequencyFromName('Push - mon')).toEqual({ name: 'Push', frequency: ['mon'] })
    })

    it('aceita múltiplos dias separados por vírgula, /, e/and', () => {
        expect(extractFrequencyFromName('Push - segunda e quinta'))
            .toEqual({ name: 'Push', frequency: ['mon', 'thu'] })
        expect(extractFrequencyFromName('Push - mon, wed, fri'))
            .toEqual({ name: 'Push', frequency: ['mon', 'wed', 'fri'] })
        expect(extractFrequencyFromName('Push - mon/wed/fri'))
            .toEqual({ name: 'Push', frequency: ['mon', 'wed', 'fri'] })
    })

    it('aceita parênteses', () => {
        expect(extractFrequencyFromName('Inferior A (terça)'))
            .toEqual({ name: 'Inferior A', frequency: ['tue'] })
        expect(extractFrequencyFromName('Push (mon, wed)'))
            .toEqual({ name: 'Push', frequency: ['mon', 'wed'] })
    })

    it('aceita ":" como separador', () => {
        expect(extractFrequencyFromName('Superior A: segunda'))
            .toEqual({ name: 'Superior A', frequency: ['mon'] })
    })

    it('NÃO infere quando o sufixo não é dia ("foco peito" preserva nome)', () => {
        expect(extractFrequencyFromName('Treino A - foco peito'))
            .toEqual({ name: 'Treino A - foco peito', frequency: [] })
        expect(extractFrequencyFromName('Treino A - intenso'))
            .toEqual({ name: 'Treino A - intenso', frequency: [] })
    })

    it('NÃO infere quando há mistura de dia e não-dia', () => {
        expect(extractFrequencyFromName('Treino A - segunda parte'))
            .toEqual({ name: 'Treino A - segunda parte', frequency: [] })
    })

    it('preserva nome quando não há separador', () => {
        expect(extractFrequencyFromName('Treino A')).toEqual({ name: 'Treino A', frequency: [] })
        expect(extractFrequencyFromName('Push')).toEqual({ name: 'Push', frequency: [] })
    })

    it('é case-insensitive e trata acentos', () => {
        expect(extractFrequencyFromName('SUPERIOR A - SEGUNDA'))
            .toEqual({ name: 'SUPERIOR A', frequency: ['mon'] })
        expect(extractFrequencyFromName('Treino - Sábado'))
            .toEqual({ name: 'Treino', frequency: ['sat'] })
    })

    it('deduplica dias repetidos', () => {
        expect(extractFrequencyFromName('Push - segunda e seg'))
            .toEqual({ name: 'Push', frequency: ['mon'] })
    })
})

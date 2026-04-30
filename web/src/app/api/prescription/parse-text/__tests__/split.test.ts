import { describe, it, expect } from 'vitest'
import { splitWorkoutBlocks } from '../lib'

describe('splitWorkoutBlocks', () => {
    it('reconhece cabeçalhos brasileiros (Superior A - segunda, Inferior A - terça, ...)', () => {
        const text = `Superior A - segunda
Supino inclinado halter 3x8

Inferior A - terça
Leg press horizontal 3x8 120kg

Superior B - quarta
Supino reto Barra 3x6 80kg

Inferior B - quinta
Leg press 45 3x8

Superior C - sexta
Supino inclinado halter 3x8`

        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(5)
        expect(blocks[0]).toMatch(/^Superior A - segunda/)
        expect(blocks[1]).toMatch(/^Inferior A - terça/)
        expect(blocks[2]).toMatch(/^Superior B - quarta/)
        expect(blocks[3]).toMatch(/^Inferior B - quinta/)
        expect(blocks[4]).toMatch(/^Superior C - sexta/)
    })

    it('mantém cabeçalhos legados (Treino A, Treino B)', () => {
        const text = `Treino A
Supino 3x10

Treino B
Agachamento 3x10`
        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0]).toMatch(/^Treino A/)
        expect(blocks[1]).toMatch(/^Treino B/)
    })

    it('reconhece Push 1 / Pull 1 / Legs 1', () => {
        const text = `Push 1
Supino 3x10

Pull 1
Remada 3x10

Legs 1
Agachamento 3x10`
        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(3)
    })

    it('texto sem heading vira um único bloco', () => {
        const text = `supino 3x10
remada 3x10`
        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(1)
    })

    it('linha de "Aquecimento" dentro do bloco não vira heading separado', () => {
        const text = `Treino A
Aquecimento 5min esteira
Supino 3x10
Remada 3x10`
        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(1)
        expect(blocks[0]).toContain('Aquecimento 5min esteira')
        expect(blocks[0]).toContain('Supino 3x10')
    })

    it('seções internas sem linha em branco antes não viram heading', () => {
        const text = `Treino A
Aquecimento
Supino 3x10
Trabalho principal
Agachamento 3x10`
        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(1)
    })

    it('cabeçalho fora do dicionário ainda funciona quando precedido por linha em branco', () => {
        const text = `Empurrar - segunda
Supino 3x10

Puxar - terça
Remada 3x10`
        const blocks = splitWorkoutBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0]).toMatch(/^Empurrar - segunda/)
        expect(blocks[1]).toMatch(/^Puxar - terça/)
    })
})

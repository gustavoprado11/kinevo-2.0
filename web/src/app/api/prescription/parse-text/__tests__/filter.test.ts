import { describe, it, expect } from 'vitest'
import { filterCatalogByText } from '../lib'

const distractors = Array.from({ length: 23 }, (_, i) => ({
    id: `dx${i}`,
    name: `Distrator ${i}`,
}))

const catalog = [
    { id: '1', name: 'Cadeira Flexora' },
    { id: '2', name: 'Cadeira Extensora' },
    { id: '3', name: 'Mesa Flexora' },
    { id: '4', name: 'Mesa Extensora' },
    { id: '5', name: 'Leg Press 45' },
    { id: '6', name: 'Stiff Barra Livre' },
    { id: '7', name: 'Panturrilha em Pé no Smith' },
    ...distractors,
]

describe('filterCatalogByText (Inferior B)', () => {
    it('inclui Cadeira Flexora e Cadeira Extensora mesmo escrito como banco flexor/extensor', () => {
        const text = `Inferior B - quinta
Leg press 45 3x8
Stiff barra 3x8
Banco extensor unilateral 3x8
Banco flexor 3x12
Panturrilha em pé 3x12`

        const filtered = filterCatalogByText(text, catalog)
        const names = filtered.map(e => e.name)
        expect(names).toContain('Cadeira Flexora')
        expect(names).toContain('Cadeira Extensora')
    })
})

describe('filterCatalogByText (aliases & stems)', () => {
    it('pulldown casa com Puxada Aberta', () => {
        const cat = [
            { id: '1', name: 'Puxada Aberta Barra reta' },
            ...distractors,
        ]
        const filtered = filterCatalogByText('pulldown 3x10', cat)
        expect(filtered.map(e => e.name)).toContain('Puxada Aberta Barra reta')
    })

    it('agacho búlgaro casa com Agachamento Búlgaro', () => {
        const cat = [
            { id: '1', name: 'Agachamento Búlgaro' },
            ...distractors,
        ]
        const filtered = filterCatalogByText('agacho búlgaro 3x8', cat)
        const top = filtered[0]
        expect(top?.name).toBe('Agachamento Búlgaro')
    })
})

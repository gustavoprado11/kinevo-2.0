// Seleção em lote do kinevo_list_exercises (fix do build 13/jul): o matching de
// nomes de grupo e o balanceamento por grupo são o que impede o modelo de fazer
// 10 chamadas seriais (e o que garante que nenhum grupo do split volte vazio).

import { describe, it, expect } from 'vitest'
import { resolveGroupNames, balanceAcrossGroups } from '../tools/exercise-selection'

const CATALOG = [
    { id: 'mg-peito', name: 'Peito' },
    { id: 'mg-costas', name: 'Costas' },
    { id: 'mg-quadriceps', name: 'Quadríceps' },
    { id: 'mg-gluteo', name: 'Glúteo' },
    { id: 'mg-mob-ombro', name: 'Mobilidade Ombro' },
    { id: 'mg-ombros', name: 'Ombros' },
]

describe('resolveGroupNames', () => {
    it('casa nome exato e é insensível a acento/caixa ("Quadriceps" → "Quadríceps")', () => {
        const r = resolveGroupNames(['Quadriceps', 'peito'], CATALOG)
        expect([...r.matches.keys()]).toEqual(['Quadríceps', 'Peito'])
        expect(r.unmatched).toEqual([])
    })

    it('casa por substring nos DOIS sentidos ("Peitoral" acha "Peito")', () => {
        const r = resolveGroupNames(['Peitoral'], CATALOG)
        expect(r.matches.get('Peito')).toEqual(['mg-peito'])
    })

    it('nome exato vence substring como chave canônica ("Ombros" não vira "Mobilidade Ombro")', () => {
        const r = resolveGroupNames(['Ombros'], CATALOG)
        expect([...r.matches.keys()]).toEqual(['Ombros'])
        // Mas os ids de TODOS os hits entram no filtro (Mobilidade Ombro contém "Ombro"… não "Ombros").
        expect(r.matches.get('Ombros')).toContain('mg-ombros')
    })

    it('reporta os que não casaram e deduplica pedidos repetidos', () => {
        const r = resolveGroupNames(['Peito', 'PEITO', 'Panturrilha'], CATALOG)
        expect([...r.matches.keys()]).toEqual(['Peito'])
        expect(r.unmatched).toEqual(['Panturrilha'])
    })
})

// Helper: n exercícios do grupo g ("g:0" primário, resto acessório — a ordem de
// entrada emula o SQL, primários primeiro).
function makeItems(groups: Record<string, number>): {
    items: Array<{ id: string; name: string }>
    membership: Map<string, string[]>
} {
    const primaries: Array<{ id: string; name: string }> = []
    const accessories: Array<{ id: string; name: string }> = []
    const membership = new Map<string, string[]>()
    for (const [g, n] of Object.entries(groups)) {
        for (let i = 0; i < n; i++) {
            const item = { id: `${g}:${i}`, name: `${g} ${i}` }
            ;(i === 0 ? primaries : accessories).push(item)
            membership.set(item.id, [g])
        }
    }
    return { items: [...primaries, ...accessories], membership }
}

describe('balanceAcrossGroups', () => {
    it('distribui a quota entre os grupos e agrupa a saída na ordem pedida', () => {
        const { items, membership } = makeItems({ A: 20, B: 20, C: 20 })
        const { selected, perGroup } = balanceAcrossGroups(items, ['A', 'B', 'C'], membership, 30)
        expect(selected).toHaveLength(30)
        expect(perGroup).toEqual([
            { group: 'A', count: 10 },
            { group: 'B', count: 10 },
            { group: 'C', count: 10 },
        ])
        // Saída agrupada: os 10 primeiros são todos de A, e o primário de A lidera.
        expect(selected.slice(0, 10).every((i) => i.id.startsWith('A:'))).toBe(true)
        expect(selected[0].id).toBe('A:0')
    })

    it('nenhum grupo volta zerado mesmo com muitos grupos (quota mínima)', () => {
        const { items, membership } = makeItems({ A: 30, B: 30, C: 30, D: 30, E: 30, F: 30, G: 30, H: 30 })
        const { perGroup } = balanceAcrossGroups(items, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], membership, 100)
        for (const g of perGroup) expect(g.count).toBeGreaterThanOrEqual(6)
    })

    it('sobra de um grupo raso é redistribuída (round-robin) sem passar do limite', () => {
        const { items, membership } = makeItems({ A: 2, B: 40 })
        const { selected, perGroup } = balanceAcrossGroups(items, ['A', 'B'], membership, 20)
        expect(selected).toHaveLength(20)
        expect(perGroup.find((g) => g.group === 'A')?.count).toBe(2)
        expect(perGroup.find((g) => g.group === 'B')?.count).toBe(18)
    })

    it('exercício em 2 grupos entra UMA vez, no primeiro grupo da ordem pedida', () => {
        const shared = { id: 'x', name: 'Levantamento terra' }
        const membership = new Map<string, string[]>([['x', ['Posterior', 'Glúteo']]])
        const { selected, perGroup } = balanceAcrossGroups([shared], ['Posterior', 'Glúteo'], membership, 10)
        expect(selected).toHaveLength(1)
        expect(perGroup).toEqual([
            { group: 'Posterior', count: 1 },
            { group: 'Glúteo', count: 0 },
        ])
    })

    it('limite menor que grupos×quota mínima ainda respeita o limite', () => {
        const { items, membership } = makeItems({ A: 10, B: 10, C: 10 })
        const { selected } = balanceAcrossGroups(items, ['A', 'B', 'C'], membership, 5)
        expect(selected).toHaveLength(5)
    })
})

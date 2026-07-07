import { describe, it, expect } from 'vitest';
import {
    normalizeSupersetsAfterChange,
    removeItemDissolvingSuperset,
    sortItemsHierarchically,
} from '../item-helpers';

interface TestItem {
    id: string;
    parent_item_id?: string | null;
    order_index: number;
}

const item = (id: string, order_index: number, parent_item_id: string | null = null): TestItem => ({
    id,
    order_index,
    parent_item_id,
});

// ── sortItemsHierarchically ──

describe('sortItemsHierarchically', () => {
    it('mantém lista sem supersets ordenada por order_index', () => {
        const out = sortItemsHierarchically([item('b', 1), item('a', 0), item('c', 2)]);
        expect(out.map(i => i.id)).toEqual(['a', 'b', 'c']);
    });

    it('agrupa filhos logo após o pai com order_index POR PAI (convenção web/RPC)', () => {
        // Web grava filhos 0..n por pai — no sort plano eles empatavam com as
        // raízes e subiam pro topo da lista (bug C2 do relatório).
        const out = sortItemsHierarchically([
            item('root0', 0),
            item('ss', 1),
            item('child0', 0, 'ss'),
            item('child1', 1, 'ss'),
            item('root2', 2),
        ]);
        expect(out.map(i => i.id)).toEqual(['root0', 'ss', 'child0', 'child1', 'root2']);
    });

    it('agrupa filhos com order_index GLOBAL (convenção do save mobile)', () => {
        const out = sortItemsHierarchically([
            item('root0', 0),
            item('ss', 1),
            item('child0', 2, 'ss'),
            item('child1', 3, 'ss'),
            item('root2', 4),
        ]);
        expect(out.map(i => i.id)).toEqual(['root0', 'ss', 'child0', 'child1', 'root2']);
    });

    it('dois supersets: cada filho fica sob o próprio pai', () => {
        const out = sortItemsHierarchically([
            item('ssA', 0),
            item('a1', 0, 'ssA'),
            item('a2', 1, 'ssA'),
            item('ssB', 1),
            item('b1', 0, 'ssB'),
            item('b2', 1, 'ssB'),
        ]);
        expect(out.map(i => i.id)).toEqual(['ssA', 'a1', 'a2', 'ssB', 'b1', 'b2']);
    });

    it('filho órfão (pai fora da lista) não some — vai pro fim', () => {
        const out = sortItemsHierarchically([
            item('root0', 0),
            item('orfao', 0, 'pai-deletado'),
        ]);
        expect(out.map(i => i.id)).toEqual(['root0', 'orfao']);
    });
});

// ── removeItemDissolvingSuperset ──

describe('removeItemDissolvingSuperset', () => {
    it('remove item comum e reindexa', () => {
        const out = removeItemDissolvingSuperset(
            [item('a', 0), item('b', 1), item('c', 2)],
            'b',
        );
        expect(out.map(i => i.id)).toEqual(['a', 'c']);
        expect(out.map(i => i.order_index)).toEqual([0, 1]);
    });

    it('remover superset DISSOLVE: filhos sobrevivem como raízes na posição do bloco', () => {
        // Bug C2: removeItem antigo deixava os filhos órfãos no draft e o save
        // os deletava via CASCADE de parent_item_id.
        const out = removeItemDissolvingSuperset(
            [
                item('root0', 0),
                item('ss', 1),
                item('child0', 2, 'ss'),
                item('child1', 3, 'ss'),
                item('root2', 4),
            ],
            'ss',
        );
        expect(out.map(i => i.id)).toEqual(['root0', 'child0', 'child1', 'root2']);
        expect(out.every(i => !i.parent_item_id)).toBe(true);
        expect(out.map(i => i.order_index)).toEqual([0, 1, 2, 3]);
    });

    it('remover um filho não afeta o pai nem os irmãos', () => {
        const out = removeItemDissolvingSuperset(
            [
                item('ss', 0),
                item('child0', 1, 'ss'),
                item('child1', 2, 'ss'),
            ],
            'child0',
        );
        expect(out.map(i => i.id)).toEqual(['ss', 'child1']);
        expect(out.find(i => i.id === 'child1')?.parent_item_id).toBe('ss');
    });
});

// ── normalizeSupersetsAfterChange (R22/R23) ──

interface SupersetTestItem extends TestItem {
    item_type: string;
    rest_seconds: number;
}

const sitem = (
    id: string,
    order_index: number,
    rest_seconds: number,
    parent_item_id: string | null = null,
    item_type: string = parent_item_id ? 'exercise' : 'exercise',
): SupersetTestItem => ({ id, order_index, rest_seconds, parent_item_id, item_type });

const container = (id: string, order_index: number, rest_seconds: number): SupersetTestItem =>
    ({ id, order_index, rest_seconds, parent_item_id: null, item_type: 'superset' });

describe('normalizeSupersetsAfterChange', () => {
    it('pai espelha o rest do último filho após reorder (R23)', () => {
        // B(90) era o último; depois do drag A(0) vira o último → pai = 0,
        // rótulo "descanso entre rodadas" passa a bater com o timer real.
        const out = normalizeSupersetsAfterChange([
            container('ss', 0, 90),
            sitem('b', 1, 90, 'ss'),
            sitem('a', 2, 0, 'ss'),
        ]);
        expect(out.find(i => i.id === 'ss')?.rest_seconds).toBe(0);
    });

    it('remover filho re-deriva o pai para o novo último (R22)', () => {
        // Simula o pós-remoção do último filho B(90): sobra A(0)+C(45),
        // C é o último → pai = 45.
        const out = normalizeSupersetsAfterChange([
            container('ss', 0, 90),
            sitem('a', 1, 0, 'ss'),
            sitem('c', 2, 45, 'ss'),
        ]);
        expect(out.find(i => i.id === 'ss')?.rest_seconds).toBe(45);
    });

    it('superset com 1 filho é dissolvido; sobrevivente com rest 0 herda o do pai', () => {
        const out = normalizeSupersetsAfterChange([
            container('ss', 0, 90),
            sitem('a', 1, 0, 'ss'),
            sitem('root', 2, 60),
        ]);
        expect(out.find(i => i.id === 'ss')).toBeUndefined();
        const a = out.find(i => i.id === 'a');
        expect(a?.parent_item_id).toBeNull();
        expect(a?.rest_seconds).toBe(90);
        expect(out.map(i => i.order_index)).toEqual([0, 1]);
    });

    it('lista sem supersets passa intocada (só reindex)', () => {
        const out = normalizeSupersetsAfterChange([
            sitem('a', 0, 60),
            sitem('b', 1, 90),
        ]);
        expect(out.map(i => i.id)).toEqual(['a', 'b']);
        expect(out.find(i => i.id === 'b')?.rest_seconds).toBe(90);
    });
});

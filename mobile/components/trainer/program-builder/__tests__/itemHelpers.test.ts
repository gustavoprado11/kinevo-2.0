import { describe, it, expect } from 'vitest';
import {
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

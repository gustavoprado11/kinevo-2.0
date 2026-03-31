import { describe, it, expect } from 'vitest';
import { sortExerciseItems } from '../sortExerciseItems';

const makeItem = (name: string, order_index: number, parent_item_id: string | null = null) => ({
    name,
    order_index,
    parent_item_id,
});

const makeMap = (entries: [string, number][]) =>
    new Map(entries.map(([id, order_index]) => [id, { order_index }]));

describe('sortExerciseItems', () => {
    it('sorts exercises by order_index when no supersets', () => {
        const items = [
            makeItem('Crucifixo', 2),
            makeItem('Supino', 0),
            makeItem('Puxada', 1),
        ];

        const sorted = sortExerciseItems(items, new Map());

        expect(sorted.map((i) => i.name)).toEqual(['Supino', 'Puxada', 'Crucifixo']);
    });

    it('places superset children at parent position, sub-sorted by own order_index', () => {
        const supersetMap = makeMap([['superset_A', 2]]);

        const items = [
            makeItem('Supino', 0),
            makeItem('Puxada', 1),
            makeItem('Rosca', 0, 'superset_A'),
            makeItem('Pulldown', 1, 'superset_A'),
            makeItem('Crucifixo', 3),
        ];

        const sorted = sortExerciseItems(items, supersetMap);

        expect(sorted.map((i) => i.name)).toEqual([
            'Supino',
            'Puxada',
            'Rosca',
            'Pulldown',
            'Crucifixo',
        ]);
    });

    it('handles multiple supersets interleaved with normal exercises', () => {
        const supersetMap = makeMap([
            ['ss_A', 1],
            ['ss_B', 3],
        ]);

        const items = [
            makeItem('Ex Normal 0', 0),
            makeItem('SS_A Child 0', 0, 'ss_A'),
            makeItem('SS_A Child 1', 1, 'ss_A'),
            makeItem('Ex Normal 2', 2),
            makeItem('SS_B Child 0', 0, 'ss_B'),
            makeItem('SS_B Child 1', 1, 'ss_B'),
            makeItem('Ex Normal 4', 4),
        ];

        const sorted = sortExerciseItems(items, supersetMap);

        expect(sorted.map((i) => i.name)).toEqual([
            'Ex Normal 0',
            'SS_A Child 0',
            'SS_A Child 1',
            'Ex Normal 2',
            'SS_B Child 0',
            'SS_B Child 1',
            'Ex Normal 4',
        ]);
    });

    it('breaks ties by subOrder for superset children', () => {
        const supersetMap = makeMap([['ss_A', 5]]);

        const items = [
            makeItem('Child B', 1, 'ss_A'),
            makeItem('Child A', 0, 'ss_A'),
        ];

        const sorted = sortExerciseItems(items, supersetMap);

        expect(sorted.map((i) => i.name)).toEqual(['Child A', 'Child B']);
        expect(sorted[0].effectiveOrder).toBe(5);
        expect(sorted[0].subOrder).toBe(0);
        expect(sorted[1].effectiveOrder).toBe(5);
        expect(sorted[1].subOrder).toBe(1);
    });

    it('returns empty array for empty input', () => {
        expect(sortExerciseItems([], new Map())).toEqual([]);
    });

    it('sets effectiveOrder and subOrder correctly', () => {
        const supersetMap = makeMap([['ss_A', 3]]);

        const items = [
            makeItem('Normal', 1),
            makeItem('Child', 0, 'ss_A'),
        ];

        const sorted = sortExerciseItems(items, supersetMap);

        // Normal exercise: effectiveOrder = own order_index, subOrder = 0
        expect(sorted[0].effectiveOrder).toBe(1);
        expect(sorted[0].subOrder).toBe(0);

        // Superset child: effectiveOrder = parent order_index, subOrder = own order_index
        expect(sorted[1].effectiveOrder).toBe(3);
        expect(sorted[1].subOrder).toBe(0);
    });

    it('handles superset child whose parent is not in the map (orphan)', () => {
        // If parent_item_id refers to a superset not in the map, falls back to own order_index
        const items = [
            makeItem('Orphan Child', 0, 'missing_parent'),
            makeItem('Normal', 1),
        ];

        const sorted = sortExerciseItems(items, new Map());

        expect(sorted.map((i) => i.name)).toEqual(['Orphan Child', 'Normal']);
        // Orphan: parentOrder is undefined → effectiveOrder = own order_index (0), subOrder = 0
        expect(sorted[0].effectiveOrder).toBe(0);
        expect(sorted[0].subOrder).toBe(0);
    });

    it('reproduces the original bug scenario: superset children before normal exercises', () => {
        // This is the exact scenario that caused the Watch ordering bug:
        // Superset children had order_index=0,1 (relative to parent) which made them
        // sort before normal exercises with order_index=0,1 when using naive sort.
        const supersetMap = makeMap([['superset_biceps', 4]]);

        const items = [
            makeItem('Supino Reto com Halteres', 0),
            makeItem('Puxada Aberta Barra Reta', 1),
            makeItem('Crucifixo Máquina', 2),
            makeItem('Remada Baixa Supinada', 3),
            makeItem('Rosca Scott Máquina', 0, 'superset_biceps'),
            makeItem('Pulldown Barra Reta', 1, 'superset_biceps'),
        ];

        const sorted = sortExerciseItems(items, supersetMap);

        expect(sorted.map((i) => i.name)).toEqual([
            'Supino Reto com Halteres',
            'Puxada Aberta Barra Reta',
            'Crucifixo Máquina',
            'Remada Baixa Supinada',
            'Rosca Scott Máquina',
            'Pulldown Barra Reta',
        ]);
    });
});

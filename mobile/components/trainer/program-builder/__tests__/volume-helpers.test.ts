import { describe, it, expect } from 'vitest';
import { calculateVolume } from '../volume-helpers';

const exerciseItem = (sets: number, group: string, rounds?: number | null) => ({
    item_type: 'exercise',
    sets,
    rounds: rounds ?? null,
    exercise_muscle_groups: [group],
});

describe('calculateVolume', () => {
    it('counts linear methods as sets × frequency (legacy programs without rounds)', () => {
        // Pirâmide ↓ 4 séries × 2 dias/semana = 8 sets/semana
        const out = calculateVolume([
            {
                frequency: ['mon', 'thu'],
                items: [exerciseItem(4, 'Peito')],
            },
        ]);
        expect(out.Peito).toBe(8);
    });

    it('linear with rounds=1 keeps sets × frequency', () => {
        const out = calculateVolume([
            {
                frequency: ['mon', 'thu'],
                items: [exerciseItem(5, 'Pernas', 1)],
            },
        ]);
        expect(out.Pernas).toBe(10);
    });

    it('compound (rounds > 1) counts ROUNDS × frequency, not phases', () => {
        // Drop-set materializado: 9 fases (sets=9), rounds=3.
        // Volume efetivo = 3 rondas × 2 dias = 6 sets/semana.
        const out = calculateVolume([
            {
                frequency: ['mon', 'thu'],
                items: [exerciseItem(9, 'Peito', 3)],
            },
        ]);
        expect(out.Peito).toBe(6);
    });

    it('mix of linear and compound on the same workout', () => {
        const out = calculateVolume([
            {
                frequency: ['mon', 'thu'], // 2x/semana
                items: [
                    exerciseItem(4, 'Peito'),       // pirâmide → 4 × 2 = 8
                    exerciseItem(9, 'Peito', 3),    // drop-set → 3 × 2 = 6
                ],
            },
        ]);
        expect(out.Peito).toBe(14);
    });

    it('frequency of zero clamps to 1 (defensive)', () => {
        const out = calculateVolume([
            {
                frequency: [],
                items: [exerciseItem(3, 'Costas')],
            },
        ]);
        expect(out.Costas).toBe(3);
    });
});

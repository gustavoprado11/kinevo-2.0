import { describe, it, expect } from 'vitest';
import { estimateOneRepMax } from '../estimate-one-rep-max';

describe('estimateOneRepMax', () => {
    it('reps == 1 usa Epley (levemente acima do peso; Brzycki daria o próprio peso)', () => {
        expect(estimateOneRepMax(100, 1)).toBeCloseTo(103.33, 1); // Epley 100*(1+1/30)
    });

    it('usa a maior das duas fórmulas', () => {
        // reps baixas: Epley ganha (100kg×5 → Epley 116,7 vs Brzycki 112,5)
        expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1);
        // reps altas: Brzycki ganha (100kg×15 → Brzycki 163,6 vs Epley 150)
        expect(estimateOneRepMax(100, 15)).toBeCloseTo(163.64, 1);
    });

    it('clampa reps >= 37 (Brzycki explode no denominador)', () => {
        const result = estimateOneRepMax(50, 40);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
    });

    it('input inválido retorna 0', () => {
        expect(estimateOneRepMax(0, 10)).toBe(0);
        expect(estimateOneRepMax(100, 0)).toBe(0);
        expect(estimateOneRepMax(-50, 5)).toBe(0);
    });
});

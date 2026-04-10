import { describe, it, expect } from 'vitest';
import { calculateVolume, getVolumeColor, getVolumeHint } from '../volume-helpers';
import { computeOccupiedDays } from '../day-helpers';

// ── calculateVolume ──

describe('calculateVolume', () => {
    it('returns empty for no workouts', () => {
        expect(calculateVolume([])).toEqual({});
    });

    it('returns empty for workouts with no exercises', () => {
        const result = calculateVolume([{ frequency: ['mon'], items: [] }]);
        expect(result).toEqual({});
    });

    it('calculates simple volume (1 workout, 1 exercise, no frequency)', () => {
        const result = calculateVolume([{
            frequency: [],
            items: [{ item_type: 'exercise', sets: 3, exercise_muscle_groups: ['Peito'] }],
        }]);
        // frequency.length = 0, so Math.max(1, 0) = 1 → 3 * 1 = 3
        expect(result).toEqual({ 'Peito': 3 });
    });

    it('multiplies by frequency', () => {
        const result = calculateVolume([{
            frequency: ['mon', 'wed', 'fri'],
            items: [{ item_type: 'exercise', sets: 4, exercise_muscle_groups: ['Costas'] }],
        }]);
        // 4 sets * 3 days = 12
        expect(result).toEqual({ 'Costas': 12 });
    });

    it('accumulates multiple exercises targeting same muscle', () => {
        const result = calculateVolume([{
            frequency: ['mon'],
            items: [
                { item_type: 'exercise', sets: 3, exercise_muscle_groups: ['Peito'] },
                { item_type: 'exercise', sets: 4, exercise_muscle_groups: ['Peito', 'Tríceps'] },
            ],
        }]);
        expect(result).toEqual({ 'Peito': 7, 'Tríceps': 4 });
    });

    it('accumulates across multiple workouts', () => {
        const result = calculateVolume([
            {
                frequency: ['mon', 'thu'],
                items: [{ item_type: 'exercise', sets: 3, exercise_muscle_groups: ['Peito'] }],
            },
            {
                frequency: ['tue', 'fri'],
                items: [{ item_type: 'exercise', sets: 4, exercise_muscle_groups: ['Peito'] }],
            },
        ]);
        // Workout 1: 3 * 2 = 6, Workout 2: 4 * 2 = 8 → total 14
        expect(result).toEqual({ 'Peito': 14 });
    });

    it('ignores items with 0 sets', () => {
        const result = calculateVolume([{
            frequency: ['mon'],
            items: [{ item_type: 'exercise', sets: 0, exercise_muscle_groups: ['Peito'] }],
        }]);
        expect(result).toEqual({});
    });

    it('ignores non-exercise item types', () => {
        const result = calculateVolume([{
            frequency: ['mon'],
            items: [{ item_type: 'note', sets: 0, exercise_muscle_groups: [] }],
        }]);
        expect(result).toEqual({});
    });
});

// ── getVolumeColor ──

describe('getVolumeColor', () => {
    it('returns blue for low volume (< 10)', () => {
        expect(getVolumeColor(5)).toBe('#60a5fa');
        expect(getVolumeColor(9)).toBe('#60a5fa');
    });

    it('returns green for productive range (10-20)', () => {
        expect(getVolumeColor(10)).toBe('#34d399');
        expect(getVolumeColor(15)).toBe('#34d399');
        expect(getVolumeColor(20)).toBe('#34d399');
    });

    it('returns yellow for high volume (> 20)', () => {
        expect(getVolumeColor(21)).toBe('#fbbf24');
        expect(getVolumeColor(30)).toBe('#fbbf24');
    });
});

// ── getVolumeHint ──

describe('getVolumeHint', () => {
    it('returns correct hint for each range', () => {
        expect(getVolumeHint(5)).toBe('Volume baixo');
        expect(getVolumeHint(15)).toBe('Faixa produtiva');
        expect(getVolumeHint(25)).toBe('Volume alto');
    });
});

// ── computeOccupiedDays ──

describe('computeOccupiedDays', () => {
    it('returns empty when only one workout', () => {
        const result = computeOccupiedDays(
            [{ id: 'w1', frequency: ['mon', 'wed'] }],
            'w1'
        );
        expect(result).toEqual([]);
    });

    it('returns days from other workouts', () => {
        const result = computeOccupiedDays(
            [
                { id: 'w1', frequency: ['mon', 'wed'] },
                { id: 'w2', frequency: ['tue', 'thu'] },
            ],
            'w1'
        );
        expect(result).toEqual(['tue', 'thu']);
    });

    it('deduplicates overlapping days', () => {
        const result = computeOccupiedDays(
            [
                { id: 'w1', frequency: ['mon'] },
                { id: 'w2', frequency: ['tue', 'fri'] },
                { id: 'w3', frequency: ['tue', 'sat'] },
            ],
            'w1'
        );
        expect(result.sort()).toEqual(['fri', 'sat', 'tue']);
    });

    it('returns all other days when currentWorkoutId is null', () => {
        const result = computeOccupiedDays(
            [
                { id: 'w1', frequency: ['mon'] },
                { id: 'w2', frequency: ['tue'] },
            ],
            null
        );
        expect(result.sort()).toEqual(['mon', 'tue']);
    });
});

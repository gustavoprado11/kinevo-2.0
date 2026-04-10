import { describe, it, expect } from 'vitest';
import { CACHE_KEYS, CACHE_TTL } from '../cache-keys';

describe('CACHE_KEYS', () => {
    it('has correct static keys', () => {
        expect(CACHE_KEYS.DASHBOARD_STATS).toBe('cache:dashboard:stats');
        expect(CACHE_KEYS.STUDENTS_LIST).toBe('cache:students:list');
        expect(CACHE_KEYS.EXERCISE_LIBRARY).toBe('cache:exercises:all');
        expect(CACHE_KEYS.MUSCLE_GROUPS).toBe('cache:exercises:muscles');
    });

    it('STUDENT_DETAIL generates dynamic key with student id', () => {
        expect(CACHE_KEYS.STUDENT_DETAIL('abc-123')).toBe('cache:student:abc-123');
        expect(CACHE_KEYS.STUDENT_DETAIL('xyz')).toBe('cache:student:xyz');
    });

    it('all static keys start with "cache:" prefix', () => {
        const staticKeys = [
            CACHE_KEYS.DASHBOARD_STATS,
            CACHE_KEYS.STUDENTS_LIST,
            CACHE_KEYS.EXERCISE_LIBRARY,
            CACHE_KEYS.MUSCLE_GROUPS,
        ];
        for (const key of staticKeys) {
            expect(key).toMatch(/^cache:/);
        }
    });
});

describe('CACHE_TTL', () => {
    it('DASHBOARD is 2 minutes', () => {
        expect(CACHE_TTL.DASHBOARD).toBe(2 * 60 * 1000);
    });

    it('STUDENTS_LIST is 5 minutes', () => {
        expect(CACHE_TTL.STUDENTS_LIST).toBe(5 * 60 * 1000);
    });

    it('EXERCISE_LIBRARY is 30 minutes', () => {
        expect(CACHE_TTL.EXERCISE_LIBRARY).toBe(30 * 60 * 1000);
    });

    it('STUDENT_DETAIL is 5 minutes', () => {
        expect(CACHE_TTL.STUDENT_DETAIL).toBe(5 * 60 * 1000);
    });

    it('all TTLs are positive numbers', () => {
        for (const [, value] of Object.entries(CACHE_TTL)) {
            expect(value).toBeGreaterThan(0);
            expect(typeof value).toBe('number');
        }
    });
});

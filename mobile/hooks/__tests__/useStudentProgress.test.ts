import { describe, it, expect } from 'vitest';

/**
 * Tests for the pure computation logic used by useStudentProgress.
 * Since getISOWeekMonday and computeSessionTonnage are not exported,
 * we re-implement and verify the same logic here.
 */

// ── getISOWeekMonday logic ──────────────────────────────────────────
function getISOWeekMonday(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

describe('getISOWeekMonday', () => {
    it('returns Monday for a Monday date', () => {
        // 2026-04-06 is a Monday
        expect(getISOWeekMonday(new Date('2026-04-06T12:00:00'))).toBe('2026-04-06');
    });

    it('returns Monday for a Wednesday date', () => {
        // 2026-04-08 is a Wednesday → Monday is 2026-04-06
        expect(getISOWeekMonday(new Date('2026-04-08T12:00:00'))).toBe('2026-04-06');
    });

    it('returns Monday for a Sunday date', () => {
        // 2026-04-12 is a Sunday → Monday is 2026-04-06
        expect(getISOWeekMonday(new Date('2026-04-12T12:00:00'))).toBe('2026-04-06');
    });

    it('returns Monday for a Saturday date', () => {
        // 2026-04-11 is a Saturday → Monday is 2026-04-06
        expect(getISOWeekMonday(new Date('2026-04-11T12:00:00'))).toBe('2026-04-06');
    });

    it('handles year boundary', () => {
        // 2026-01-01 is a Thursday → Monday is 2025-12-29
        expect(getISOWeekMonday(new Date('2026-01-01T12:00:00'))).toBe('2025-12-29');
    });
});

// ── computeSessionTonnage logic ─────────────────────────────────────
interface SetLog {
    weight: number | null;
    reps_completed: number | null;
}

interface SessionRow {
    id: string;
    completed_at: string;
    duration_seconds: number | null;
    rpe: number | null;
    set_logs: SetLog[];
}

function computeSessionTonnage(session: SessionRow): number {
    const setLogs = session.set_logs || [];
    let tonnage = 0;

    for (const log of setLogs) {
        if (log.weight != null && log.reps_completed != null && log.weight > 0 && log.reps_completed > 0) {
            tonnage += log.weight * log.reps_completed;
        }
    }

    // RPE proxy fallback if no weight data
    if (tonnage === 0 && session.rpe != null && session.duration_seconds != null) {
        tonnage = session.duration_seconds * (session.rpe / 10) * 0.5;
    }

    return tonnage;
}

describe('computeSessionTonnage', () => {
    const baseSession: SessionRow = {
        id: '1',
        completed_at: '2026-04-01T10:00:00Z',
        duration_seconds: null,
        rpe: null,
        set_logs: [],
    };

    it('sums weight × reps for each set', () => {
        const session: SessionRow = {
            ...baseSession,
            set_logs: [
                { weight: 80, reps_completed: 10 },
                { weight: 80, reps_completed: 8 },
                { weight: 60, reps_completed: 12 },
            ],
        };
        // 80*10 + 80*8 + 60*12 = 800 + 640 + 720 = 2160
        expect(computeSessionTonnage(session)).toBe(2160);
    });

    it('ignores sets with null weight', () => {
        const session: SessionRow = {
            ...baseSession,
            set_logs: [
                { weight: null, reps_completed: 10 },
                { weight: 50, reps_completed: 10 },
            ],
        };
        expect(computeSessionTonnage(session)).toBe(500);
    });

    it('ignores sets with null reps', () => {
        const session: SessionRow = {
            ...baseSession,
            set_logs: [
                { weight: 50, reps_completed: null },
                { weight: 50, reps_completed: 10 },
            ],
        };
        expect(computeSessionTonnage(session)).toBe(500);
    });

    it('ignores sets with zero weight or zero reps', () => {
        const session: SessionRow = {
            ...baseSession,
            set_logs: [
                { weight: 0, reps_completed: 10 },
                { weight: 50, reps_completed: 0 },
                { weight: 50, reps_completed: 5 },
            ],
        };
        expect(computeSessionTonnage(session)).toBe(250);
    });

    it('falls back to RPE proxy when no weight data', () => {
        const session: SessionRow = {
            ...baseSession,
            duration_seconds: 3600,
            rpe: 8,
            set_logs: [],
        };
        // 3600 * (8/10) * 0.5 = 3600 * 0.8 * 0.5 = 1440
        expect(computeSessionTonnage(session)).toBe(1440);
    });

    it('does NOT use RPE fallback if weight data exists', () => {
        const session: SessionRow = {
            ...baseSession,
            duration_seconds: 3600,
            rpe: 8,
            set_logs: [{ weight: 100, reps_completed: 1 }],
        };
        // Has weight data, so RPE proxy is NOT used
        expect(computeSessionTonnage(session)).toBe(100);
    });

    it('returns 0 for empty session without RPE', () => {
        const session: SessionRow = {
            ...baseSession,
            set_logs: [],
        };
        expect(computeSessionTonnage(session)).toBe(0);
    });
});

// ── tonnageTrend calculation ────────────────────────────────────────
describe('tonnageTrend calculation', () => {
    function calcTrend(recentTonnages: number[], previousTonnages: number[]) {
        const recentAvg = recentTonnages.reduce((s, v) => s + v, 0) / recentTonnages.length;
        const previousAvg = previousTonnages.length > 0
            ? previousTonnages.reduce((s, v) => s + v, 0) / previousTonnages.length
            : 0;

        let tonnageTrend = 0;
        let direction: 'up' | 'down' | 'neutral' = 'neutral';

        if (previousAvg > 0) {
            tonnageTrend = ((recentAvg - previousAvg) / previousAvg) * 100;
            direction = tonnageTrend > 5 ? 'up' : tonnageTrend < -5 ? 'down' : 'neutral';
        }

        return {
            tonnageTrend: Math.round(tonnageTrend * 10) / 10,
            direction,
        };
    }

    it('returns up when recent is significantly higher', () => {
        const result = calcTrend([200, 200, 200, 200], [100, 100, 100, 100]);
        expect(result.direction).toBe('up');
        expect(result.tonnageTrend).toBe(100);
    });

    it('returns down when recent is significantly lower', () => {
        const result = calcTrend([50, 50, 50, 50], [100, 100, 100, 100]);
        expect(result.direction).toBe('down');
        expect(result.tonnageTrend).toBe(-50);
    });

    it('returns neutral for small changes (< 5%)', () => {
        const result = calcTrend([102, 102, 102, 102], [100, 100, 100, 100]);
        expect(result.direction).toBe('neutral');
    });

    it('returns neutral when previousAvg is 0', () => {
        const result = calcTrend([200, 200, 200, 200], [0, 0, 0, 0]);
        expect(result.direction).toBe('neutral');
        expect(result.tonnageTrend).toBe(0);
    });
});

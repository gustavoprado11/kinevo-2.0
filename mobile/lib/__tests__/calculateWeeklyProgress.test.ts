import { describe, it, expect } from 'vitest';
import {
    calculateWeeklyProgress,
    type WorkoutWithMeta,
    type SessionRef,
} from '@kinevo/shared/utils/schedule-projection';

// Helper: create a date for a specific day of the week within a given week
function dateForDow(weekStart: Date, dow: number): Date {
    const d = new Date(weekStart);
    const offset = ((dow - weekStart.getDay()) + 7) % 7;
    d.setDate(d.getDate() + offset);
    return d;
}

function makeWorkout(id: string, name: string, scheduledDays: number[], exerciseCount = 3): WorkoutWithMeta {
    return {
        id,
        name,
        scheduled_days: scheduledDays,
        items: Array.from({ length: exerciseCount }, (_, i) => ({ id: `item-${i}` })),
    };
}

function makeSession(workoutId: string, date: Date, status: 'completed' | 'in_progress' = 'completed'): SessionRef {
    return {
        id: `session-${workoutId}-${date.toISOString()}`,
        assigned_workout_id: workoutId,
        started_at: date.toISOString(),
        completed_at: status === 'completed' ? date.toISOString() : null,
        status,
    };
}

describe('calculateWeeklyProgress — pending workouts', () => {
    // Week of March 30, 2026 (Monday = March 30)
    // dow: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const weekStart = new Date(2026, 2, 29); // Sunday March 29

    it('no missed workouts when completed on scheduled day', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', [1, 3]), // Mon + Wed
        ];
        const monday = dateForDow(weekStart, 1);
        const sessions = [makeSession('w1', monday)];

        // "Today" is Monday — completed 1 of 2, but only Monday has passed
        const fakeToday = monday;
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, fakeToday);

        expect(result.pendingWorkouts).toHaveLength(0);
    });

    it('shows missed workout when past day has no session', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', [1, 3]), // Mon + Wed
        ];
        const monday = dateForDow(weekStart, 1);
        const sessions = [makeSession('w1', monday)];

        // "Today" is Thursday — Monday covered, Wednesday missed
        const thursday = dateForDow(weekStart, 4);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, thursday);

        expect(result.pendingWorkouts).toHaveLength(1);
        expect(result.pendingWorkouts[0].workoutName).toBe('Treino A');
        expect(result.pendingWorkouts[0].originalDay).toBe('Quarta');
    });

    it('no missed workouts when all sessions completed', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', [1, 3]), // Mon + Wed
        ];
        const monday = dateForDow(weekStart, 1);
        const wednesday = dateForDow(weekStart, 3);
        const sessions = [
            makeSession('w1', monday),
            makeSession('w1', wednesday),
        ];

        const thursday = dateForDow(weekStart, 4);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, thursday);

        expect(result.pendingWorkouts).toHaveLength(0);
        expect(result.isWeekComplete).toBe(true);
    });

    it('shows 2 missed when no sessions and both days passed', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', [1, 3]), // Mon + Wed
        ];
        const sessions: SessionRef[] = [];

        const thursday = dateForDow(weekStart, 4);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, thursday);

        expect(result.pendingWorkouts).toHaveLength(2);
        expect(result.pendingWorkouts[0].originalDay).toBe('Segunda');
        expect(result.pendingWorkouts[1].originalDay).toBe('Quarta');
    });

    it('no missed when workout scheduled once and completed once', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', [1]), // Mon only
        ];
        const monday = dateForDow(weekStart, 1);
        const sessions = [makeSession('w1', monday)];

        const tuesday = dateForDow(weekStart, 2);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, tuesday);

        expect(result.pendingWorkouts).toHaveLength(0);
    });

    it('no missed when workout has no scheduled days', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', []),
        ];
        const sessions: SessionRef[] = [];

        const wednesday = dateForDow(weekStart, 3);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, wednesday);

        // No scheduled days → flexible mode, no specific occurrences to miss
        expect(result.pendingWorkouts).toHaveLength(0);
    });

    it('session done on wrong day still covers oldest occurrence', () => {
        // Treino A scheduled Mon + Wed, but done on Tuesday
        // The session still counts as 1 completed, covering Monday's occurrence
        const workouts = [
            makeWorkout('w1', 'Treino A', [1, 3]), // Mon + Wed
        ];
        const tuesday = dateForDow(weekStart, 2);
        const sessions = [makeSession('w1', tuesday)];

        // Today is Thursday — Monday covered by Tuesday's session, Wednesday missed
        const thursday = dateForDow(weekStart, 4);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, thursday);

        expect(result.pendingWorkouts).toHaveLength(1);
        expect(result.pendingWorkouts[0].originalDay).toBe('Quarta');
    });

    it('in_progress sessions are not counted as completed', () => {
        const workouts = [
            makeWorkout('w1', 'Treino A', [1]), // Mon
        ];
        const monday = dateForDow(weekStart, 1);
        const sessions = [makeSession('w1', monday, 'in_progress')];

        const tuesday = dateForDow(weekStart, 2);
        const result = calculateWeeklyProgressAt(workouts, sessions, weekStart, tuesday);

        expect(result.pendingWorkouts).toHaveLength(1);
        expect(result.pendingWorkouts[0].originalDay).toBe('Segunda');
    });
});

/**
 * Wrapper that allows overriding "today" for testing.
 * The real calculateWeeklyProgress uses `new Date()` internally.
 * We mock it via vi.useFakeTimers.
 */
function calculateWeeklyProgressAt(
    workouts: WorkoutWithMeta[],
    sessions: SessionRef[],
    weekStart: Date,
    fakeToday: Date,
) {
    // Temporarily override Date to control "today"
    const RealDate = globalThis.Date;
    const fakeNow = fakeToday.getTime();

    globalThis.Date = class extends RealDate {
        constructor(...args: any[]) {
            if (args.length === 0) {
                super(fakeNow);
            } else {
                // @ts-ignore
                super(...args);
            }
        }
        static now() {
            return fakeNow;
        }
    } as any;

    try {
        return calculateWeeklyProgress(workouts, sessions, weekStart);
    } finally {
        globalThis.Date = RealDate;
    }
}

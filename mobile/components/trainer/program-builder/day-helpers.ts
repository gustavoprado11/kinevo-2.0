// Pure helpers for day selection (exported for testing)

export const DAYS = [
    { key: 'sun', label: 'D' },
    { key: 'mon', label: 'S' },
    { key: 'tue', label: 'T' },
    { key: 'wed', label: 'Q' },
    { key: 'thu', label: 'Q' },
    { key: 'fri', label: 'S' },
    { key: 'sat', label: 'S' },
] as const;

export function computeOccupiedDays(
    workouts: { id: string; frequency: string[] }[],
    currentWorkoutId: string | null
): string[] {
    const days = new Set<string>();
    workouts.forEach(w => {
        if (w.id !== currentWorkoutId) {
            w.frequency.forEach(d => days.add(d));
        }
    });
    return Array.from(days);
}

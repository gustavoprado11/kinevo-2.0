export const CACHE_KEYS = {
    DASHBOARD_STATS: "cache:dashboard:stats",
    STUDENTS_LIST: "cache:students:list",
    EXERCISE_LIBRARY: "cache:exercises:all",
    MUSCLE_GROUPS: "cache:exercises:muscles",
    STUDENT_DETAIL: (id: string) => `cache:student:${id}`,
    STUDIO_MEMBERSHIP: "cache:studio:membership",
    STUDIO_DASHBOARD: "cache:studio:dashboard",
} as const;

// TTLs in milliseconds
export const CACHE_TTL = {
    DASHBOARD: 2 * 60 * 1000, // 2 minutes
    STUDENTS_LIST: 5 * 60 * 1000, // 5 minutes
    EXERCISE_LIBRARY: 30 * 60 * 1000, // 30 minutes
    STUDENT_DETAIL: 5 * 60 * 1000, // 5 minutes
    STUDIO_MEMBERSHIP: 10 * 60 * 1000, // 10 minutes (muda raro)
    STUDIO_DASHBOARD: 2 * 60 * 1000, // 2 minutes
} as const;

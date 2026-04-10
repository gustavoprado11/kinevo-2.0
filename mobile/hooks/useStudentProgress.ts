import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";

export interface WeeklyProgress {
    weekLabel: string;
    weekStart: string;
    totalTonnage: number;
    sessionCount: number;
    expectedSessions: number;
}

export interface ProgressSummary {
    tonnageTrend: number;
    tonnageTrendDirection: "up" | "down" | "neutral";
    adherencePercent: number;
    currentStreak: number;
    totalSessions: number;
}

export interface UseStudentProgressReturn {
    weeklyData: WeeklyProgress[];
    summary: ProgressSummary;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

interface SessionRow {
    id: string;
    completed_at: string;
    duration_seconds: number | null;
    rpe: number | null;
    set_logs: {
        weight: number | null;
        reps_completed: number | null;
    }[];
}

function getISOWeekMonday(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
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

export function useStudentProgress(
    studentId: string,
    expectedPerWeek: number = 0,
): UseStudentProgressReturn {
    const [sessions, setSessions] = useState<SessionRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        if (!studentId) return;

        try {
            const twelveWeeksAgo = new Date();
            twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);

            const { data, error: queryError } = await supabase
                .from("workout_sessions")
                .select(`
                    id,
                    completed_at,
                    duration_seconds,
                    rpe,
                    set_logs(
                        weight,
                        reps_completed
                    )
                `)
                .eq("student_id", studentId)
                .eq("status", "completed")
                .gte("completed_at", twelveWeeksAgo.toISOString())
                .order("completed_at", { ascending: true }) as { data: SessionRow[] | null; error: any };

            if (queryError) throw new Error(queryError.message);
            setSessions(data || []);
            setError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Erro ao buscar dados";
            if (__DEV__) console.error("[useStudentProgress]", message);
            setError(message);
            setSessions([]);
        }
    }, [studentId]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchSessions();
            if (mounted) setIsLoading(false);
        })();
        return () => { mounted = false; };
    }, [fetchSessions]);

    const refresh = useCallback(async () => {
        await fetchSessions();
    }, [fetchSessions]);

    const weeklyData = useMemo<WeeklyProgress[]>(() => {
        if (sessions.length === 0) return [];

        // Group sessions by ISO week
        const weekMap = new Map<string, { tonnage: number; count: number }>();

        for (const session of sessions) {
            const monday = getISOWeekMonday(new Date(session.completed_at));
            const existing = weekMap.get(monday) || { tonnage: 0, count: 0 };
            existing.tonnage += computeSessionTonnage(session);
            existing.count += 1;
            weekMap.set(monday, existing);
        }

        // Generate all weeks in the 12-week range
        const now = new Date();
        const weeks: WeeklyProgress[] = [];
        const currentMonday = getISOWeekMonday(now);

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i * 7);
            const monday = getISOWeekMonday(d);
            const entry = weekMap.get(monday);

            weeks.push({
                weekLabel: `Sem ${12 - i}`,
                weekStart: monday,
                totalTonnage: entry?.tonnage ?? 0,
                sessionCount: entry?.count ?? 0,
                expectedSessions: expectedPerWeek,
            });
        }

        return weeks;
    }, [sessions, expectedPerWeek]);

    const summary = useMemo<ProgressSummary>(() => {
        const totalSessions = sessions.length;

        if (weeklyData.length === 0) {
            return {
                tonnageTrend: 0,
                tonnageTrendDirection: "neutral",
                adherencePercent: 0,
                currentStreak: 0,
                totalSessions: 0,
            };
        }

        // Tonnage trend: last 4 weeks vs previous 4 weeks
        const recent4 = weeklyData.slice(-4);
        const previous4 = weeklyData.slice(-8, -4);

        const recentAvg = recent4.reduce((s, w) => s + w.totalTonnage, 0) / recent4.length;
        const previousAvg = previous4.length > 0
            ? previous4.reduce((s, w) => s + w.totalTonnage, 0) / previous4.length
            : 0;

        let tonnageTrend = 0;
        let tonnageTrendDirection: "up" | "down" | "neutral" = "neutral";

        if (previousAvg > 0) {
            tonnageTrend = ((recentAvg - previousAvg) / previousAvg) * 100;
            tonnageTrendDirection = tonnageTrend > 5 ? "up" : tonnageTrend < -5 ? "down" : "neutral";
        }

        // Adherence
        const weeksWithExpected = expectedPerWeek > 0 ? weeklyData.length : 0;
        const totalExpected = expectedPerWeek * weeksWithExpected;
        const totalCompleted = weeklyData.reduce((s, w) => s + w.sessionCount, 0);
        const adherencePercent = totalExpected > 0
            ? Math.min(100, Math.round((totalCompleted / totalExpected) * 100))
            : 0;

        // Streak: consecutive weeks from the end with >= 1 session
        let currentStreak = 0;
        for (let i = weeklyData.length - 1; i >= 0; i--) {
            if (weeklyData[i].sessionCount > 0) {
                currentStreak++;
            } else {
                break;
            }
        }

        return {
            tonnageTrend: Math.round(tonnageTrend * 10) / 10,
            tonnageTrendDirection,
            adherencePercent,
            currentStreak,
            totalSessions,
        };
    }, [weeklyData, sessions.length, expectedPerWeek]);

    return { weeklyData, summary, isLoading, error, refresh };
}

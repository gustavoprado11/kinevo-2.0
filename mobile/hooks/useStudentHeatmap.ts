import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";

interface HeatmapSession {
    id: string;
    workout_name: string;
    duration_seconds: number | null;
    completed_at: string;
}

export interface HeatmapDay {
    date: string;
    count: number;
    sessions: HeatmapSession[];
}

export function useStudentHeatmap(studentId: string) {
    const [days, setDays] = useState<HeatmapDay[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [monthOffset, setMonthOffset] = useState(0);

    // Compute date range for 3 months centered on current monthOffset
    const { startDate, endDate, currentMonth } = useMemo(() => {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const start = new Date(target.getFullYear(), target.getMonth() - 1, 1);
        const end = new Date(target.getFullYear(), target.getMonth() + 2, 0);
        return {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            currentMonth: target,
        };
    }, [monthOffset]);

    const fetchHeatmap = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any).rpc("get_student_sessions_heatmap", {
                p_student_id: studentId,
                p_start_date: startDate,
                p_end_date: endDate,
            });

            if (error) {
                console.error("[heatmap] RPC error:", error.message);
                setDays([]);
            } else {
                setDays(data || []);
            }
        } catch (err) {
            console.error("[heatmap] Unexpected error:", err);
            setDays([]);
        } finally {
            setIsLoading(false);
        }
    }, [studentId, startDate, endDate]);

    useEffect(() => {
        fetchHeatmap();
    }, [fetchHeatmap]);

    const navigateMonth = useCallback((direction: 1 | -1) => {
        setMonthOffset((prev) => prev + direction);
        setSelectedDate(null);
    }, []);

    // Build lookup map for quick access
    const dayMap = useMemo(() => {
        const map = new Map<string, HeatmapDay>();
        for (const day of days) {
            map.set(day.date, day);
        }
        return map;
    }, [days]);

    const selectedDay = selectedDate ? dayMap.get(selectedDate) ?? null : null;

    return {
        days,
        dayMap,
        isLoading,
        selectedDate,
        setSelectedDate,
        selectedDay,
        currentMonth,
        navigateMonth,
    };
}

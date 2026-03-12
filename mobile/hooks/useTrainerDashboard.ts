import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

// Phase 2: useTrainerWorkoutSession — Zustand store ported from web/src/stores/training-room-store.ts
// Phase 2: trainer_finish_workout_session RPC — SECURITY DEFINER to create workout_session + set_logs

// ── Types ──

export interface TrainerStats {
    activeStudentsCount: number;
    sessionsThisWeek: number;
    expectedSessionsThisWeek: number;
    mrr: number;
    adherencePercent: number;
    hasActivePrograms: boolean;
}

export interface PendingFinancialItem {
    id: string;
    student_name: string;
    student_avatar: string | null;
    amount: number;
    billing_type: string;
    status: string;
    current_period_end: string | null;
}

export interface PendingFormItem {
    id: string;
    student_name: string;
    student_avatar: string | null;
    template_title: string;
    submitted_at: string;
}

export interface InactiveStudentItem {
    id: string;
    name: string;
    avatar_url: string | null;
    program_name: string;
    days_since_last_session: number;
}

export interface ExpiringProgramItem {
    student_name: string;
    student_avatar: string | null;
    program_name: string;
    duration_weeks: number;
    ends_in_days: number;
}

export interface DailyActivityItem {
    id: string;
    student_name: string;
    student_id: string;
    workout_name: string;
    completed_at: string;
    duration_seconds: number | null;
    rpe: number | null;
    feedback: string | null;
}

export interface PendingActions {
    pendingFinancial: PendingFinancialItem[];
    pendingForms: PendingFormItem[];
    inactiveStudents: InactiveStudentItem[];
    expiringPrograms: ExpiringProgramItem[];
}

// ── Hook ──

export function useTrainerDashboard() {
    const { trainerId } = useRoleMode();
    const [stats, setStats] = useState<TrainerStats | null>(null);
    const [pendingActions, setPendingActions] = useState<PendingActions | null>(null);
    const [dailyActivity, setDailyActivity] = useState<DailyActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        if (!trainerId) return;

        try {
            // Parallel RPC calls for all 3 dashboard sections
            const [statsRes, pendingRes, activityRes] = await Promise.all([
                supabase.rpc("get_trainer_stats" as any),
                supabase.rpc("get_trainer_pending_actions" as any),
                supabase.rpc("get_trainer_daily_activity" as any),
            ]);

            if (statsRes.error) throw new Error(statsRes.error.message);
            if (pendingRes.error) throw new Error(pendingRes.error.message);
            if (activityRes.error) throw new Error(activityRes.error.message);

            setStats(statsRes.data as TrainerStats);
            setPendingActions(pendingRes.data as PendingActions);
            setDailyActivity((activityRes.data || []) as DailyActivityItem[]);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useTrainerDashboard] fetch error:", err);
            setError(err.message);
        }
    }, [trainerId]);

    useEffect(() => {
        if (!trainerId) return;

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchDashboard();
            if (mounted) setIsLoading(false);
        })();

        return () => { mounted = false; };
    }, [trainerId, fetchDashboard]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchDashboard();
        setIsRefreshing(false);
    }, [fetchDashboard]);

    return {
        stats,
        pendingActions,
        dailyActivity,
        isLoading,
        isRefreshing,
        error,
        refresh,
    };
}

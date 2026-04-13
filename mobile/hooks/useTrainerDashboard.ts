import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import { useCachedQuery } from "./useCachedQuery";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cache-keys";

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
    student_id: string;
    student_name: string;
    student_avatar: string | null;
    amount: number;
    billing_type: string;
    status: string;
    current_period_end: string | null;
}

export interface PendingFormItem {
    id: string;
    student_id: string;
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
    student_id: string;
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

interface DashboardData {
    stats: TrainerStats;
    pendingActions: PendingActions;
    dailyActivity: DailyActivityItem[];
}

// ── Hook ──

export function useTrainerDashboard() {
    const { trainerId } = useRoleMode();

    const fetcher = useCallback(async (): Promise<DashboardData> => {
        const [statsRes, pendingRes, activityRes] = await Promise.all([
            supabase.rpc("get_trainer_stats" as any),
            supabase.rpc("get_trainer_pending_actions" as any),
            supabase.rpc("get_trainer_daily_activity" as any),
        ]);

        if (statsRes.error) throw new Error(statsRes.error.message);
        if (pendingRes.error) throw new Error(pendingRes.error.message);
        if (activityRes.error) throw new Error(activityRes.error.message);

        return {
            stats: statsRes.data as TrainerStats,
            pendingActions: pendingRes.data as PendingActions,
            dailyActivity: (activityRes.data || []) as DailyActivityItem[],
        };
    }, [trainerId]);

    const { data, isLoading, isRefreshing, error, refresh } = useCachedQuery<DashboardData>({
        cacheKey: CACHE_KEYS.DASHBOARD_STATS,
        fetcher,
        ttl: CACHE_TTL.DASHBOARD,
        enabled: !!trainerId,
    });

    return {
        stats: data?.stats ?? null,
        pendingActions: data?.pendingActions ?? null,
        dailyActivity: data?.dailyActivity ?? [],
        isLoading,
        isRefreshing,
        error,
        refresh,
    };
}

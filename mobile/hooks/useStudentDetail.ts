import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface StudentDetailData {
    student: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        status: string;
        modality: string | null;
        avatar_url: string | null;
        is_trainer_profile: boolean;
        created_at: string;
    };
    activeProgram: {
        id: string;
        name: string;
        description: string | null;
        duration_weeks: number | null;
        started_at: string | null;
        current_week: number | null;
        ai_generated: boolean;
        workouts: {
            id: string;
            name: string;
            order_index: number;
            scheduled_days: number[];
        }[];
    } | null;
    programHistory: {
        id: string;
        name: string;
        duration_weeks: number | null;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        ai_generated: boolean;
    }[];
    recentSessions: {
        id: string;
        workout_name: string;
        completed_at: string;
        duration_seconds: number | null;
        rpe: number | null;
        feedback: string | null;
    }[];
    formSubmissions: {
        id: string;
        template_title: string;
        category: string;
        status: string;
        submitted_at: string;
        feedback_sent_at: string | null;
    }[];
    prescriptionProfile: {
        id: string;
        training_level: string;
        goal: string;
        available_days: number[];
        session_duration_minutes: number;
        available_equipment: string[];
        medical_restrictions: any[];
        ai_mode: string;
        updated_at: string;
    } | null;
    aiEnabled: boolean;
    sessionsThisWeek: number;
    expectedPerWeek: number;
    totalSessions: number;
    lastSessionDate: string | null;
}

export function useStudentDetail(studentId: string | null) {
    const { trainerId } = useRoleMode();
    const [data, setData] = useState<StudentDetailData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!trainerId || !studentId) return;

        try {
            const { data: result, error: rpcError } = await supabase.rpc(
                "get_student_profile_detail" as any,
                { p_student_id: studentId }
            );
            if (rpcError) throw new Error(rpcError.message);
            setData(result as StudentDetailData);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useStudentDetail] fetch error:", err);
            setError(err.message);
        }
    }, [trainerId, studentId]);

    useEffect(() => {
        if (!trainerId || !studentId) return;

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchDetail();
            if (mounted) setIsLoading(false);
        })();

        return () => { mounted = false; };
    }, [trainerId, studentId, fetchDetail]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchDetail();
        setIsRefreshing(false);
    }, [fetchDetail]);

    return { data, isLoading, isRefreshing, error, refresh };
}

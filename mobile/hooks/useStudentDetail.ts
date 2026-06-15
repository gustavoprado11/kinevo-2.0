import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import { useCachedQuery } from "./useCachedQuery";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cache-keys";

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
    /** Rascunhos persistidos no banco (criados fora do builder, ex.: assistente via MCP). */
    draftPrograms: {
        id: string;
        name: string;
        workouts: { id: string; name: string; scheduled_days: number[] }[];
    }[];
}

export function useStudentDetail(studentId: string | null) {
    const { trainerId } = useRoleMode();

    const fetcher = useCallback(async (): Promise<StudentDetailData> => {
        // A RPC só retorna o programa ativo + histórico. Os rascunhos de banco
        // (status='draft', ex.: criados pelo assistente via MCP) são buscados em
        // paralelo via query direta (RLS garante posse do treinador).
        const [profileRes, draftsRes] = await Promise.all([
            supabase.rpc("get_student_profile_detail" as any, { p_student_id: studentId }),
            (supabase as any)
                .from("assigned_programs")
                .select("id, name, assigned_workouts(id, name, order_index, scheduled_days)")
                .eq("student_id", studentId)
                .eq("status", "draft")
                .order("created_at", { ascending: false }),
        ]);
        if (profileRes.error) throw new Error(profileRes.error.message);

        const draftPrograms = (draftsRes.data ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            workouts: (p.assigned_workouts ?? [])
                .slice()
                .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((w: any) => ({ id: w.id, name: w.name, scheduled_days: w.scheduled_days ?? [] })),
        }));

        return { ...(profileRes.data as StudentDetailData), draftPrograms };
    }, [trainerId, studentId]);

    const { data, isLoading, isRefreshing, error, refresh } = useCachedQuery<StudentDetailData>({
        cacheKey: CACHE_KEYS.STUDENT_DETAIL(studentId ?? ""),
        fetcher,
        ttl: CACHE_TTL.STUDENT_DETAIL,
        enabled: !!trainerId && !!studentId,
    });

    return { data, isLoading, isRefreshing, error, refresh };
}

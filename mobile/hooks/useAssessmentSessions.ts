import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";
import type {
    AssessmentSessionListItem,
    AssessmentSessionStatus,
} from "@kinevo/shared/types/assessments";

// Placeholder hook for Milestone 1. Provides typed RPC access only — UI lives in M3.

export interface UseAssessmentSessionsOptions {
    studentId?: string;
    status?: AssessmentSessionStatus;
    limit?: number;
}

export function useAssessmentSessions(options: UseAssessmentSessionsOptions = {}) {
    const { trainerId } = useRoleMode();
    const { studentId, status, limit = 50 } = options;

    const [sessions, setSessions] = useState<AssessmentSessionListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        if (!trainerId) return;

        try {
            const { data, error: rpcError } = await supabase.rpc(
                "get_assessment_sessions" as never,
                {
                    p_student_id: studentId ?? null,
                    p_status: status ?? null,
                    p_limit: limit,
                } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            setSessions(((data as unknown) as AssessmentSessionListItem[]) ?? []);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useAssessmentSessions] fetch error:", err);
            setError(err.message);
        }
    }, [trainerId, studentId, status, limit]);

    useEffect(() => {
        if (!trainerId) return;

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchSessions();
            if (mounted) setIsLoading(false);
        })();

        return () => {
            mounted = false;
        };
    }, [trainerId, fetchSessions]);

    return {
        sessions,
        isLoading,
        error,
        refresh: fetchSessions,
    };
}

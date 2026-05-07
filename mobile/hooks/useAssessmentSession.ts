import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
    AssessmentSessionDetail,
    MeasurementInput,
    FinalizeAssessmentResult,
    ComputedMetrics,
} from "@kinevo/shared/types/assessments";

// Placeholder hook for Milestone 1. UI consumers come in M3.

export function useAssessmentSession(sessionId: string | null) {
    const [detail, setDetail] = useState<AssessmentSessionDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!sessionId);
    const [error, setError] = useState<string | null>(null);

    const fetchSession = useCallback(async () => {
        if (!sessionId) return;
        try {
            const { data, error: rpcError } = await supabase.rpc(
                "get_assessment_session" as never,
                { p_session_id: sessionId } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            setDetail((data as unknown) as AssessmentSessionDetail);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useAssessmentSession] fetch error:", err);
            setError(err.message);
            setDetail(null);
        }
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) {
            setDetail(null);
            setIsLoading(false);
            return;
        }

        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchSession();
            if (mounted) setIsLoading(false);
        })();

        return () => {
            mounted = false;
        };
    }, [sessionId, fetchSession]);

    const saveMeasurements = useCallback(
        async (measurements: MeasurementInput[]): Promise<number> => {
            if (!sessionId) throw new Error("No session id");
            const { data, error: rpcError } = await supabase.rpc(
                "save_assessment_measurements" as never,
                {
                    p_session_id: sessionId,
                    p_measurements: measurements,
                } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            return (data as unknown) as number;
        },
        [sessionId],
    );

    const finalize = useCallback(
        async (
            computedMetrics: ComputedMetrics,
            notes?: string,
        ): Promise<FinalizeAssessmentResult> => {
            if (!sessionId) throw new Error("No session id");
            const { data, error: rpcError } = await supabase.rpc(
                "finalize_assessment_session" as never,
                {
                    p_session_id: sessionId,
                    p_computed_metrics: computedMetrics,
                    p_notes: notes ?? null,
                } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            return (data as unknown) as FinalizeAssessmentResult;
        },
        [sessionId],
    );

    return {
        detail,
        isLoading,
        error,
        refresh: fetchSession,
        saveMeasurements,
        finalize,
    };
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
    AssessmentSessionDetail,
    MeasurementInput,
    FinalizeAssessmentResult,
    ComputedMetrics,
} from "@kinevo/shared/types/assessments";
import { useAssessmentDraftStore } from "../stores/assessmentDraftStore";

// Placeholder hook for Milestone 1. UI consumers come in M3.

/**
 * RPC error message returned by `get_assessment_session` when the row
 * doesn't exist or the caller has no access. Matched verbatim against
 * the SECURITY DEFINER `RAISE EXCEPTION` in migration 122.
 */
const SESSION_NOT_FOUND_MARKERS = [
    'Session not found or access denied',
    'Session not found',
];

function isSessionNotFoundError(message: string | undefined): boolean {
    if (!message) return false;
    return SESSION_NOT_FOUND_MARKERS.some((m) => message.includes(m));
}

export function useAssessmentSession(sessionId: string | null) {
    const [detail, setDetail] = useState<AssessmentSessionDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!sessionId);
    const [error, setError] = useState<string | null>(null);
    const [orphaned, setOrphaned] = useState<boolean>(false);

    const removeDraft = useAssessmentDraftStore((s) => s.removeDraft);

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
            setOrphaned(false);
        } catch (err: any) {
            const msg = err?.message ?? '';
            if (isSessionNotFoundError(msg)) {
                // Remote session is gone (deleted, never created, or RLS now
                // forbids access). Clean the local draft so the pinned
                // section and tab badge update, and let the screen redirect.
                if (__DEV__) {
                    console.log(
                        '[useAssessmentSession] orphaned draft detected — purging',
                        sessionId,
                    );
                }
                removeDraft(sessionId);
                setOrphaned(true);
                setError(null);
                setDetail(null);
                return;
            }
            if (__DEV__) console.error("[useAssessmentSession] fetch error:", err);
            setError(msg);
            setDetail(null);
        }
    }, [sessionId, removeDraft]);

    useEffect(() => {
        if (!sessionId) {
            setDetail(null);
            setIsLoading(false);
            setOrphaned(false);
            return;
        }

        // Reset transient flags when the session id changes so a previous
        // orphan flag doesn't bleed into the next mount.
        setOrphaned(false);

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
        orphaned,
        refresh: fetchSession,
        saveMeasurements,
        finalize,
    };
}

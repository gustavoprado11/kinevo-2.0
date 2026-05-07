import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
    AssessmentSessionListItem,
    ComputedMetricKey,
    ComputedMetrics,
} from '@kinevo/shared/types/assessments';

/**
 * Time-series of one computed metric across the student's completed
 * assessment sessions. Used by HistoryMiniChart and the result screen.
 *
 * Sourced from `get_assessment_sessions` RPC filtered by status='completed'
 * — the chart only meaningfully plots finalized data anyway.
 */
export interface MetricPoint {
    session_id: string;
    completed_at: string;       // ISO
    value: number;
}

export interface UseStudentMetricsTimelineOptions {
    studentId: string | null;
    metricKey: ComputedMetricKey;
    /** Hard cap on how many points to fetch. Default 12 (≈ 1y monthly). */
    limit?: number;
}

export function useStudentMetricsTimeline(opts: UseStudentMetricsTimelineOptions) {
    const { studentId, metricKey, limit = 12 } = opts;

    const [points, setPoints] = useState<MetricPoint[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!studentId);
    const [error, setError] = useState<string | null>(null);

    const fetchTimeline = useCallback(async () => {
        if (!studentId) {
            setPoints([]);
            return;
        }
        try {
            const { data, error: rpcError } = await supabase.rpc(
                'get_assessment_sessions' as never,
                {
                    p_student_id: studentId,
                    p_status: 'completed',
                    p_limit: limit,
                } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            const rows = ((data as unknown) as AssessmentSessionListItem[] | null) ?? [];
            const series = rows
                .map<MetricPoint | null>((r) => {
                    const m = r.computed_metrics as ComputedMetrics | null;
                    if (!m || !r.completed_at) return null;
                    const v = m[metricKey];
                    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
                    return {
                        session_id: r.id,
                        completed_at: r.completed_at,
                        value: v,
                    };
                })
                .filter((x): x is MetricPoint => x !== null)
                // Backend returns DESC; chart wants ASC.
                .sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at));
            setPoints(series);
            setError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao buscar histórico';
            if (__DEV__) console.error('[useStudentMetricsTimeline]', err);
            setError(msg);
            setPoints([]);
        }
    }, [studentId, metricKey, limit]);

    useEffect(() => {
        if (!studentId) {
            setIsLoading(false);
            setPoints([]);
            return;
        }
        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchTimeline();
            if (mounted) setIsLoading(false);
        })();
        return () => {
            mounted = false;
        };
    }, [studentId, fetchTimeline]);

    return {
        points,
        isLoading,
        error,
        refresh: fetchTimeline,
    };
}

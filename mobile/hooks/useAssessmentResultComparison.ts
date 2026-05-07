import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
    AssessmentSessionListItem,
    ComputedMetricKey,
    ComputedMetrics,
} from '@kinevo/shared/types/assessments';

export interface MetricDelta {
    metric_key: ComputedMetricKey;
    current: number;
    previous: number | null;
    delta_absolute: number | null;   // current - previous
    delta_percent: number | null;    // (current - previous) / previous × 100
}

export interface AssessmentComparison {
    /** Previous completed session of the same student, same template if
     *  possible — otherwise the most recent completed session of the student. */
    previousSession: AssessmentSessionListItem | null;
    deltas: MetricDelta[];
    /** True when the previous session matched on template_id. */
    isSameTemplate: boolean;
}

const TRACKED_METRICS: ComputedMetricKey[] = [
    'bmi',
    'body_fat_percent',
    'lean_mass_kg',
    'fat_mass_kg',
    'rcq',
    'body_density',
];

/**
 * Build the result-screen comparison: pull the student's previous completed
 * session, compute per-metric deltas vs the current `computed_metrics`.
 *
 * If no previous completed session exists, returns `previousSession=null`
 * and an empty deltas list. The result screen renders a "first assessment"
 * empty-state in that case.
 */
export function useAssessmentResultComparison(params: {
    studentId: string | null;
    currentSessionId: string | null;
    currentTemplateId: string | null;
    currentMetrics: ComputedMetrics | null;
}) {
    const { studentId, currentSessionId, currentTemplateId, currentMetrics } = params;

    const [comparison, setComparison] = useState<AssessmentComparison | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!studentId && !!currentMetrics);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!studentId || !currentMetrics) {
            setComparison(null);
            return;
        }
        try {
            const { data, error: rpcError } = await supabase.rpc(
                'get_assessment_sessions' as never,
                {
                    p_student_id: studentId,
                    p_status: 'completed',
                    p_limit: 10,
                } as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            const rows = ((data as unknown) as AssessmentSessionListItem[] | null) ?? [];

            // Filter out the current session (which may already be in the
            // list if the caller refetched after finalize).
            const others = rows.filter((r) => r.id !== currentSessionId);

            // Prefer same-template, fall back to most-recent.
            const sameTemplate = currentTemplateId
                ? others.find((r) => r.template_id === currentTemplateId)
                : undefined;
            const previous = sameTemplate ?? others[0] ?? null;
            const isSameTemplate = !!sameTemplate;

            const deltas = computeDeltas(currentMetrics, previous?.computed_metrics ?? null);

            setComparison({ previousSession: previous, deltas, isSameTemplate });
            setError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao buscar comparativo';
            if (__DEV__) console.error('[useAssessmentResultComparison]', err);
            setError(msg);
            setComparison(null);
        }
    }, [studentId, currentSessionId, currentTemplateId, currentMetrics]);

    useEffect(() => {
        if (!studentId || !currentMetrics) {
            setIsLoading(false);
            setComparison(null);
            return;
        }
        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetch();
            if (mounted) setIsLoading(false);
        })();
        return () => {
            mounted = false;
        };
    }, [studentId, currentMetrics, fetch]);

    return { comparison, isLoading, error, refresh: fetch };
}

function computeDeltas(
    current: ComputedMetrics,
    previous: ComputedMetrics | null,
): MetricDelta[] {
    const deltas: MetricDelta[] = [];
    for (const key of TRACKED_METRICS) {
        const cur = current[key];
        if (typeof cur !== 'number' || !Number.isFinite(cur)) continue;
        const prevRaw = previous ? previous[key] : undefined;
        const prev = typeof prevRaw === 'number' && Number.isFinite(prevRaw) ? prevRaw : null;
        const delta_absolute = prev !== null ? cur - prev : null;
        const delta_percent = prev !== null && prev !== 0 ? ((cur - prev) / prev) * 100 : null;
        deltas.push({
            metric_key: key,
            current: cur,
            previous: prev,
            delta_absolute,
            delta_percent,
        });
    }
    return deltas;
}

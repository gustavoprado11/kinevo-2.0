import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAssessmentDraftStore } from '../stores/assessmentDraftStore';
import {
    calculateBodyComposition,
    type BodyCompositionInput,
} from '@kinevo/shared/lib/assessment-protocols';
import type {
    ComputedMetrics,
    FinalizeAssessmentResult,
    MeasurementInput,
} from '@kinevo/shared/types/assessments';

/**
 * High-level lifecycle ops for one assessment session: create on the
 * backend, sync local measurements in batches, finalize. Loading/error
 * state per action.
 *
 * Used by:
 *   - CreateSessionModal → create
 *   - MeasurementWizard  → syncBatch (after each test)
 *   - SessionScreen      → finalize
 *
 * The hook intentionally does NOT own the draft state. The draft store
 * is the source of truth; this hook just talks to Supabase RPCs and
 * marks the draft as synced when batches succeed.
 */
export function useAssessmentSessionLifecycle() {
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    const [finalizing, setFinalizing] = useState(false);
    const [finalizeError, setFinalizeError] = useState<string | null>(null);

    /** In-flight guard: while a finalize RPC is in motion, additional calls
     *  are ignored. Synchronous (ref) so concurrent invocations within the
     *  same React tick are caught — `setFinalizing(true)` only flushes on
     *  the next render. */
    const finalizingRef = useRef(false);

    const markSynced = useAssessmentDraftStore((s) => s.markSynced);
    const removeDraft = useAssessmentDraftStore((s) => s.removeDraft);

    const create = useCallback(
        async (params: {
            student_id: string;
            template_id: string;
            scheduled_at?: string | null;
            notes?: string | null;
        }): Promise<string | null> => {
            setCreating(true);
            setCreateError(null);
            try {
                const { data, error } = await supabase.rpc(
                    'create_assessment_session' as never,
                    {
                        p_student_id: params.student_id,
                        p_template_id: params.template_id,
                        p_scheduled_at: params.scheduled_at ?? null,
                        p_notes: params.notes ?? null,
                    } as never,
                );
                if (error) throw new Error(error.message);
                return data as unknown as string;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Erro ao criar sessão';
                if (__DEV__) console.error('[lifecycle.create]', err);
                setCreateError(msg);
                return null;
            } finally {
                setCreating(false);
            }
        },
        [],
    );

    /**
     * Send pending measurements to the backend and mark the draft as
     * synced on success. The caller passes ALL measurements from the
     * draft; this function filters out the ones already synced
     * (`raw_input._synced === true`) and strips that internal flag from
     * the RPC payload.
     *
     * Returns true on success (including the no-op case where there's
     * nothing to send).
     */
    const syncBatch = useCallback(
        async (sessionId: string, measurements: MeasurementInput[]): Promise<boolean> => {
            const pending = measurements.filter((m) => {
                const r = m.raw_input as { _synced?: boolean } | null | undefined;
                return !r || r._synced !== true;
            });
            if (pending.length === 0) {
                // Nothing to send. Still flip is_dirty=false so the UI banner
                // settles even when the caller invokes us defensively.
                markSynced(sessionId);
                return true;
            }
            setSyncing(true);
            setSyncError(null);
            try {
                const payload = pending.map((m) => ({
                    ...m,
                    raw_input: stripSyncFlag(m.raw_input),
                }));
                const { error } = await supabase.rpc(
                    'save_assessment_measurements' as never,
                    {
                        p_session_id: sessionId,
                        p_measurements: payload,
                    } as never,
                );
                if (error) throw new Error(error.message);
                markSynced(sessionId);
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Erro ao sincronizar';
                if (__DEV__) console.error('[lifecycle.syncBatch]', err);
                setSyncError(msg);
                return false;
            } finally {
                setSyncing(false);
            }
        },
        [markSynced],
    );

    /**
     * Compute body composition (when the session has the inputs the engine
     * needs) and finalize. On success, removes the draft from local store.
     *
     * Pass `precomputedMetrics` to bypass the engine call (useful when the
     * caller already has the metrics — e.g. read-only retry).
     */
    const finalize = useCallback(
        async (params: {
            session_id: string;
            engineInput?: BodyCompositionInput;
            precomputedMetrics?: ComputedMetrics;
            notes?: string | null;
        }): Promise<FinalizeAssessmentResult | null> => {
            // Defense in depth #1: synchronous in-flight guard. A second
            // invocation within the same render tick (React StrictMode in
            // dev, double-tap before disable kicks in, useEffect re-fire)
            // returns null immediately without touching the RPC.
            if (finalizingRef.current) {
                if (__DEV__) console.log('[lifecycle.finalize] ignored — already in flight');
                return null;
            }
            finalizingRef.current = true;
            setFinalizing(true);
            setFinalizeError(null);
            try {
                let metrics: ComputedMetrics;
                if (params.precomputedMetrics) {
                    metrics = params.precomputedMetrics;
                } else if (params.engineInput) {
                    const r = calculateBodyComposition(params.engineInput);
                    metrics = {
                        body_density: r.body_density ?? undefined,
                        body_fat_percent: r.body_fat_percent,
                        fat_mass_kg: r.fat_mass_kg,
                        lean_mass_kg: r.lean_mass_kg,
                    };
                } else {
                    metrics = {};
                }

                const { data, error } = await supabase.rpc(
                    'finalize_assessment_session' as never,
                    {
                        p_session_id: params.session_id,
                        p_computed_metrics: metrics,
                        p_notes: params.notes ?? null,
                    } as never,
                );
                if (error) {
                    // Defense in depth #2: if the RPC reports the session is
                    // already completed, treat it as a benign idempotent
                    // success — the desired terminal state is reached, the
                    // first call did the work. Just clean up local state.
                    if (/already completed/i.test(error.message)) {
                        if (__DEV__) {
                            console.log(
                                '[lifecycle.finalize] session already completed — treating as success',
                            );
                        }
                        removeDraft(params.session_id);
                        return null;
                    }
                    throw new Error(error.message);
                }
                removeDraft(params.session_id);
                return data as unknown as FinalizeAssessmentResult;
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Erro ao finalizar';
                if (__DEV__) console.error('[lifecycle.finalize]', err);
                setFinalizeError(msg);
                return null;
            } finally {
                finalizingRef.current = false;
                setFinalizing(false);
            }
        },
        [removeDraft],
    );

    return {
        create,
        creating,
        createError,

        syncBatch,

        syncing,
        syncError,

        finalize,
        finalizing,
        finalizeError,
    };
}

/** Drop the `_synced` marker from `raw_input` before persisting on the
 *  server — that flag is purely client-side bookkeeping. */
function stripSyncFlag(raw_input: MeasurementInput['raw_input']): MeasurementInput['raw_input'] {
    if (!raw_input || typeof raw_input !== 'object') return raw_input;
    const { _synced: _drop, ...rest } = raw_input as Record<string, unknown>;
    return rest as MeasurementInput['raw_input'];
}


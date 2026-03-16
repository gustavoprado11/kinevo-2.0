import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface TriggerData {
    formTemplateId: string;
    title: string;
    schemaJson: any;
}

export interface UseWorkoutFormTriggersReturn {
    preWorkoutTrigger: TriggerData | null;
    postWorkoutTrigger: TriggerData | null;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Fetches pre/post workout form triggers for a given assigned program.
 * Caches the result — does not re-fetch on re-render.
 * On error or offline, returns nulls (triggers never block the workout).
 */
export function useWorkoutFormTriggers(assignedProgramId: string | null): UseWorkoutFormTriggersReturn {
    const [preWorkoutTrigger, setPreWorkoutTrigger] = useState<TriggerData | null>(null);
    const [postWorkoutTrigger, setPostWorkoutTrigger] = useState<TriggerData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const fetchedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!assignedProgramId) return;
        // Skip if already fetched for this program
        if (fetchedRef.current === assignedProgramId) return;

        let mounted = true;

        async function fetchTriggers() {
            setIsLoading(true);
            setError(null);

            try {
                const { data, error: rpcError }: { data: any; error: any } = await supabase
                    .rpc('get_active_workout_triggers' as any, {
                        p_assigned_program_id: assignedProgramId,
                    });

                if (rpcError) throw rpcError;

                const result = data as { ok: boolean; triggers: any[] };
                if (!result?.ok || !Array.isArray(result.triggers)) {
                    if (mounted) fetchedRef.current = assignedProgramId;
                    return;
                }

                const triggers = result.triggers;
                const pre = triggers.find((t: any) => t.trigger_type === 'pre_workout');
                const post = triggers.find((t: any) => t.trigger_type === 'post_workout');

                if (mounted) {
                    setPreWorkoutTrigger(
                        pre
                            ? { formTemplateId: pre.form_template_id, title: pre.form_title, schemaJson: pre.schema_json }
                            : null
                    );
                    setPostWorkoutTrigger(
                        post
                            ? { formTemplateId: post.form_template_id, title: post.form_title, schemaJson: post.schema_json }
                            : null
                    );
                    fetchedRef.current = assignedProgramId;
                }
            } catch (err: any) {
                if (__DEV__) console.error('[useWorkoutFormTriggers] Error:', err?.message);
                if (mounted) setError(err);
                // Still mark as fetched — don't retry on re-render
                if (mounted) fetchedRef.current = assignedProgramId;
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        fetchTriggers();
        return () => { mounted = false; };
    }, [assignedProgramId]);

    return { preWorkoutTrigger, postWorkoutTrigger, isLoading, error };
}

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

        // A9: erro transitório de rede NÃO pode zerar os check-ins permanentemente.
        // Antes, o catch marcava fetchedRef e o player criava a sessão sem pré/pós
        // check-in. Agora re-tentamos algumas vezes (mantendo isLoading=true, o que
        // segura o player) e só desistimos — sem bloquear o treino — após esgotar.
        const MAX_ATTEMPTS = 3;

        async function attemptFetch(attempt: number): Promise<void> {
            try {
                const { data, error: rpcError }: { data: any; error: any } = await supabase
                    .rpc('get_active_workout_triggers' as any, {
                        p_assigned_program_id: assignedProgramId,
                    });

                if (rpcError) throw rpcError;

                const result = data as { ok: boolean; triggers: any[] };
                if (!result?.ok || !Array.isArray(result.triggers)) {
                    // Resposta bem-formada "sem triggers" — não é erro, não re-tenta.
                    if (mounted) { fetchedRef.current = assignedProgramId; setIsLoading(false); }
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
                    setIsLoading(false);
                }
            } catch (err: any) {
                // Re-tenta erros (rede/RPC) antes de liberar o treino sem check-in.
                if (mounted && attempt < MAX_ATTEMPTS) {
                    await new Promise((r) => setTimeout(r, 800 * attempt));
                    if (mounted) await attemptFetch(attempt + 1);
                    return;
                }
                if (__DEV__) console.error('[useWorkoutFormTriggers] Error (após retries):', err?.message);
                if (mounted) {
                    setError(err);
                    // Desiste após N tentativas — não bloqueia o treino.
                    fetchedRef.current = assignedProgramId;
                    setIsLoading(false);
                }
            }
        }

        setIsLoading(true);
        setError(null);
        attemptFetch(1);
        return () => { mounted = false; };
    }, [assignedProgramId]);

    return { preWorkoutTrigger, postWorkoutTrigger, isLoading, error };
}

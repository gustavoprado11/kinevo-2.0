import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

/**
 * Listing of assessment templates (category='assessment') usable in
 * CreateSessionModal. Reuses the existing `get_trainer_form_templates`
 * RPC and filters client-side — that RPC already returns every active
 * template of the trainer.
 *
 * @deprecated M11 — não retorna system templates Kinevo (RPC filtra
 * `WHERE ft.trainer_id = v_trainer_id`). Para listings que precisam mostrar
 * tanto custom quanto system, use `useTrainerAssessmentTemplates` (M11/B2)
 * que faz query direta a `form_templates` cobrindo `trainer_id IS NULL`.
 *
 * Esse hook ainda é consumido por `CreateSessionModal` (mobile) — manter
 * intacto até decidirmos migrar o modal pro novo hook em milestone futuro.
 */
export interface AssessmentTemplate {
    id: string;
    title: string;
    description: string | null;
    category: string;            // expected to be 'assessment' once filtered
    version: number;
    is_active: boolean;
    created_at: string;
    question_count: number;      // for assessments this is unused; kept for parity
    response_count: number;
}

export function useAssessmentTemplates() {
    const { trainerId } = useRoleMode();
    const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!trainerId) return;
        try {
            const { data, error: rpcError } = await supabase.rpc(
                "get_trainer_form_templates" as never,
            );
            if (rpcError) throw new Error(rpcError.message);
            const all = ((data as unknown) as AssessmentTemplate[] | null) ?? [];
            setTemplates(all.filter((t) => t.category === "assessment"));
            setError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Erro ao buscar templates";
            if (__DEV__) console.error("[useAssessmentTemplates]", err);
            setError(msg);
        }
    }, [trainerId]);

    useEffect(() => {
        if (!trainerId) return;
        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetch();
            if (mounted) setIsLoading(false);
        })();
        return () => {
            mounted = false;
        };
    }, [trainerId, fetch]);

    return { templates, isLoading, error, refresh: fetch };
}

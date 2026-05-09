import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRoleMode } from '../contexts/RoleModeContext';
import type { AssessmentTemplateSchema } from '@kinevo/shared/types/assessments';

// M11/B2 — listing dedicado de templates de avaliação para o trainer.
//
// Difere do `useAssessmentTemplates.ts` (legacy) em duas dimensões:
//   1. Query direta a `form_templates` em vez da RPC `get_trainer_form_templates`,
//      o que faz com que **system templates Kinevo** (`trainer_id IS NULL`)
//      apareçam — eles eram invisíveis no hook antigo. Espelha o pattern do
//      web `/avaliacoes/templates`.
//   2. Inclui `isRefreshing` pra paridade com pull-to-refresh dos outros hooks
//      do screen (`useTrainerFormTemplates`, `useAssessmentSessions`).
//
// O hook antigo `useAssessmentTemplates` continua existindo (consumido pelo
// CreateSessionModal) e só lista templates do trainer — comportamento
// adequado pra criar sessão (trainer escolhe entre system + customs do Kinevo,
// mas o RPC original já cobria o caso prático). Não foi alterado em M11.

export interface TrainerAssessmentTemplate {
    id: string;
    title: string;
    description: string | null;
    category: 'assessment';
    schema: AssessmentTemplateSchema | null;
    section_count: number;
    /** null = system template Kinevo; UUID = template do trainer. */
    trainer_id: string | null;
    is_active: boolean;
    created_at: string;
}

export function useTrainerAssessmentTemplates() {
    const { trainerId } = useRoleMode();
    const [templates, setTemplates] = useState<TrainerAssessmentTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        if (!trainerId) return;
        try {
            const { data, error: queryError } = await supabase
                .from('form_templates')
                .select('id, title, description, category, schema_json, trainer_id, is_active, created_at')
                .or(`trainer_id.eq.${trainerId},trainer_id.is.null`)
                .eq('category', 'assessment')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (queryError) throw new Error(queryError.message);

            const rows: TrainerAssessmentTemplate[] = (data ?? []).map((row: any) => {
                const schema = (row.schema_json as AssessmentTemplateSchema | null) ?? null;
                const sectionCount = schema?.sections?.length ?? 0;
                return {
                    id: row.id,
                    title: row.title,
                    description: row.description ?? null,
                    category: 'assessment',
                    schema,
                    section_count: sectionCount,
                    trainer_id: row.trainer_id ?? null,
                    is_active: !!row.is_active,
                    created_at: row.created_at,
                };
            });
            setTemplates(rows);
            setError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao buscar templates de avaliação';
            if (__DEV__) console.error('[useTrainerAssessmentTemplates]', err);
            setError(msg);
        }
    }, [trainerId]);

    useEffect(() => {
        if (!trainerId) return;
        let mounted = true;
        (async () => {
            setIsLoading(true);
            await fetchTemplates();
            if (mounted) setIsLoading(false);
        })();
        return () => { mounted = false; };
    }, [trainerId, fetchTemplates]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchTemplates();
        setIsRefreshing(false);
    }, [fetchTemplates]);

    return { templates, isLoading, isRefreshing, error, refresh };
}

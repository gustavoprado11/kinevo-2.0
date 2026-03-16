import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface FormTemplate {
    id: string;
    title: string;
    description: string | null;
    category: "anamnese" | "checkin" | "survey";
    version: number;
    is_active: boolean;
    created_at: string;
    question_count: number;
    response_count: number;
}

export function useTrainerFormTemplates() {
    const { trainerId } = useRoleMode();
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        if (!trainerId) return;

        try {
            const { data, error: rpcError } = await supabase.rpc("get_trainer_form_templates" as any);
            if (rpcError) throw new Error(rpcError.message);
            setTemplates((data || []) as FormTemplate[]);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useTrainerFormTemplates] fetch error:", err);
            setError(err.message);
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

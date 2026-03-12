import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRoleMode } from "../contexts/RoleModeContext";

export interface ProgramTemplate {
    id: string;
    name: string;
    description: string | null;
    duration_weeks: number | null;
    created_at: string;
    workout_count: number;
}

export function useTrainerProgramTemplates() {
    const { trainerId } = useRoleMode();
    const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        if (!trainerId) return;

        try {
            const { data, error: rpcError } = await supabase.rpc("get_trainer_program_templates" as any);
            if (rpcError) throw new Error(rpcError.message);
            setTemplates((data || []) as ProgramTemplate[]);
            setError(null);
        } catch (err: any) {
            if (__DEV__) console.error("[useTrainerProgramTemplates] fetch error:", err);
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

    return { templates, isLoading, error, refetch: fetchTemplates };
}

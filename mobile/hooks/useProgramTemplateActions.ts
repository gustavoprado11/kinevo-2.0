import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Mutations for the Program Template Library: delete and duplicate. Both rely
 * on RLS / ownership enforcement (delete via the trainer-owned row policy,
 * duplicate via the SECURITY DEFINER RPC's `current_trainer_id()` check).
 */
export function useProgramTemplateActions() {
    const [isWorking, setIsWorking] = useState(false);

    /** Hard-deletes a template (cascades to workouts/items/sets). Assigned
     *  programs already given to students keep their copy — the FK
     *  `assigned_programs.source_template_id` is ON DELETE SET NULL. */
    const deleteTemplate = useCallback(async (templateId: string): Promise<void> => {
        setIsWorking(true);
        try {
            const { error } = await supabase
                .from("program_templates")
                .delete()
                .eq("id", templateId);
            if (error) throw new Error(error.message);
        } finally {
            setIsWorking(false);
        }
    }, []);

    /** Server-side deep copy via RPC (overload 2-arg da migration 231 —
     *  transacional, copia métodos/séries por item/check-ins; a 1-arg antiga
     *  da 152 não copia). Returns the new template id. */
    const duplicateTemplate = useCallback(async (templateId: string): Promise<string> => {
        setIsWorking(true);
        try {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("Sessão expirada. Entre novamente.");
            const { data: trainer, error: trainerError } = await supabase
                .from("trainers")
                .select("id")
                .eq("auth_user_id", auth.user.id)
                .single();
            if (trainerError || !trainer) throw new Error("Treinador não encontrado.");
            const { data, error } = await supabase.rpc(
                "duplicate_program_template" as any,
                { p_trainer_id: trainer.id, p_template_id: templateId } as any,
            );
            if (error) throw new Error(error.message);
            return data as unknown as string;
        } finally {
            setIsWorking(false);
        }
    }, []);

    return { deleteTemplate, duplicateTemplate, isWorking };
}

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useRoleMode } from "../contexts/RoleModeContext";
import * as Crypto from "expo-crypto";
import { invalidateCache } from "../lib/cache";
import { CACHE_KEYS } from "../lib/cache-keys";

export interface ExerciseFormData {
    name: string;
    muscle_group_ids: string[];
    equipment: string | null;
    instructions: string | null;
    difficulty_level: string | null;
    video_file?: { uri: string; name: string; type: string } | null;
    video_url?: string | null;
}

export function useExerciseCrud(onMutationSuccess?: () => void) {
    const { user } = useAuth();
    /* `trainerId` é o id da linha em `trainers` (mapeada via auth_user_id na
     * RoleModeContext). A RLS policy de `exercises` exige
     * `owner_id = current_trainer_id()`, que retorna esse id — não o
     * `auth.users.id`. Antes a hook usava `user.id` direto, o que batia com
     * `auth_user_id` e violava a policy (erro 42501). */
    const { trainerId } = useRoleMode();
    const [isSaving, setIsSaving] = useState(false);

    const uploadVideo = async (file: { uri: string; name: string; type: string }): Promise<string> => {
        const ext = file.name.split(".").pop() || "mp4";
        const fileName = `${user!.id}/${Date.now()}-${Crypto.randomUUID()}.${ext}`;

        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
            .from("trainer-videos")
            .upload(fileName, blob, { contentType: file.type });

        if (uploadError) throw new Error(`Erro ao enviar vídeo: ${uploadError.message}`);

        const { data } = supabase.storage.from("trainer-videos").getPublicUrl(fileName);
        return data.publicUrl;
    };

    const createExercise = async (data: ExerciseFormData) => {
        if (!trainerId) {
            throw new Error(
                "Sessão sem trainer ativo. Entre como treinador antes de criar exercícios.",
            );
        }
        setIsSaving(true);
        try {
            let videoUrl = data.video_url || null;
            if (data.video_file) {
                videoUrl = await uploadVideo(data.video_file);
            }

            /* `difficulty_level` é NOT NULL no DB com DEFAULT 'intermediate'.
             * O default só aplica se a coluna for omitida do INSERT — passar
             * `null` explícito bypassa o default e quebra com 23502. Quando
             * o trainer não escolhe dificuldade, omitimos o campo pra deixar
             * o DB resolver. */
            const insertPayload: Record<string, unknown> = {
                name: data.name.trim(),
                equipment: data.equipment?.trim() || null,
                owner_id: trainerId,
                video_url: videoUrl,
                instructions: data.instructions?.trim() || null,
            };
            if (data.difficulty_level) {
                insertPayload.difficulty_level = data.difficulty_level;
            }

            const { data: exercise, error } = await (supabase as any)
                .from("exercises")
                .insert(insertPayload)
                .select("id")
                .single();

            if (error) throw error;

            if (data.muscle_group_ids.length > 0) {
                const { error: relError } = await (supabase as any)
                    .from("exercise_muscle_groups")
                    .insert(
                        data.muscle_group_ids.map((mgId) => ({
                            exercise_id: exercise.id,
                            muscle_group_id: mgId,
                        }))
                    );
                if (relError) throw relError;
            }

            invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
            onMutationSuccess?.();
            return exercise;
        } finally {
            setIsSaving(false);
        }
    };

    const updateExercise = async (id: string, data: ExerciseFormData) => {
        setIsSaving(true);
        try {
            let videoUrl = data.video_url || null;
            if (data.video_file) {
                videoUrl = await uploadVideo(data.video_file);
            }

            /* Mesmo cuidado do create: `difficulty_level` é NOT NULL no DB.
             * Em UPDATE, omitir a coluna deixa o valor atual intacto — bem
             * mais útil do que sobrescrever com null e quebrar. */
            const updatePayload: Record<string, unknown> = {
                name: data.name.trim(),
                equipment: data.equipment?.trim() || null,
                video_url: videoUrl,
                instructions: data.instructions?.trim() || null,
            };
            if (data.difficulty_level) {
                updatePayload.difficulty_level = data.difficulty_level;
            }

            const { error } = await (supabase as any)
                .from("exercises")
                .update(updatePayload)
                .eq("id", id);

            if (error) throw error;

            // Replace muscle groups
            await (supabase as any).from("exercise_muscle_groups").delete().eq("exercise_id", id);
            if (data.muscle_group_ids.length > 0) {
                const { error: relError } = await (supabase as any)
                    .from("exercise_muscle_groups")
                    .insert(
                        data.muscle_group_ids.map((mgId) => ({
                            exercise_id: id,
                            muscle_group_id: mgId,
                        }))
                    );
                if (relError) throw relError;
            }

            invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
            onMutationSuccess?.();
        } finally {
            setIsSaving(false);
        }
    };

    const deleteExercise = async (id: string) => {
        setIsSaving(true);
        try {
            const { error } = await (supabase as any).from("exercises").delete().eq("id", id);
            if (error) throw error;
            invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
            onMutationSuccess?.();
        } finally {
            setIsSaving(false);
        }
    };

    return { createExercise, updateExercise, deleteExercise, isSaving };
}

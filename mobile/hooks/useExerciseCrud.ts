import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
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
        setIsSaving(true);
        try {
            let videoUrl = data.video_url || null;
            if (data.video_file) {
                videoUrl = await uploadVideo(data.video_file);
            }

            const { data: exercise, error } = await (supabase as any)
                .from("exercises")
                .insert({
                    name: data.name.trim(),
                    equipment: data.equipment?.trim() || null,
                    owner_id: user!.id,
                    video_url: videoUrl,
                    instructions: data.instructions?.trim() || null,
                    difficulty_level: data.difficulty_level,
                })
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

            const { error } = await (supabase as any)
                .from("exercises")
                .update({
                    name: data.name.trim(),
                    equipment: data.equipment?.trim() || null,
                    video_url: videoUrl,
                    instructions: data.instructions?.trim() || null,
                    difficulty_level: data.difficulty_level,
                })
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

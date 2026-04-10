import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { invalidateCache } from "../lib/cache";
import { CACHE_KEYS } from "../lib/cache-keys";

export interface MuscleGroupFull {
    id: string;
    name: string;
    owner_id: string | null;
    created_at: string;
}

export function useMuscleGroupCrud() {
    const { user } = useAuth();
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroupFull[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchMuscleGroups = useCallback(async () => {
        const { data, error } = await (supabase as any)
            .from("muscle_groups")
            .select("id, name, owner_id, created_at")
            .order("name");

        if (!error && data) {
            setMuscleGroups(data);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchMuscleGroups();
    }, [fetchMuscleGroups]);

    const createMuscleGroup = useCallback(async (name: string): Promise<MuscleGroupFull | null> => {
        if (!user) return null;

        // Check duplicates (case-insensitive)
        const exists = muscleGroups.find(
            (m) => m.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (exists) return exists;

        setIsSaving(true);
        try {
            const { data, error } = await (supabase as any)
                .from("muscle_groups")
                .insert({ name: name.trim(), owner_id: user.id })
                .select("id, name, owner_id, created_at")
                .single();

            if (error) throw error;

            if (data) {
                setMuscleGroups((prev) =>
                    [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
                );
                invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
                return data;
            }
            return null;
        } finally {
            setIsSaving(false);
        }
    }, [user, muscleGroups]);

    const updateMuscleGroup = useCallback(async (id: string, newName: string): Promise<boolean> => {
        if (!user) return false;

        const exists = muscleGroups.some(
            (g) => g.id !== id && g.name.toLowerCase() === newName.trim().toLowerCase()
        );
        if (exists) return false;

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from("muscle_groups")
                .update({ name: newName.trim() })
                .eq("id", id)
                .eq("owner_id", user.id);

            if (error) throw error;

            setMuscleGroups((prev) =>
                prev
                    .map((g) => (g.id === id ? { ...g, name: newName.trim() } : g))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
            invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
            return true;
        } catch {
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [user, muscleGroups]);

    const deleteMuscleGroup = useCallback(async (id: string): Promise<boolean> => {
        if (!user) return false;

        setIsSaving(true);
        try {
            const { error } = await (supabase as any)
                .from("muscle_groups")
                .delete()
                .eq("id", id)
                .eq("owner_id", user.id);

            if (error) throw error;

            setMuscleGroups((prev) => prev.filter((g) => g.id !== id));
            invalidateCache(CACHE_KEYS.EXERCISE_LIBRARY);
            return true;
        } catch {
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [user]);

    const checkUsageCount = useCallback(async (id: string): Promise<number> => {
        const { count, error } = await (supabase as any)
            .from("exercise_muscle_groups")
            .select("*", { count: "exact", head: true })
            .eq("muscle_group_id", id);

        if (error) return 0;
        return count || 0;
    }, []);

    return {
        muscleGroups,
        isLoading,
        isSaving,
        createMuscleGroup,
        updateMuscleGroup,
        deleteMuscleGroup,
        checkUsageCount,
        refresh: fetchMuscleGroups,
    };
}

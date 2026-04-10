import { useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useDebounce } from "./useDebounce";
import { useCachedQuery } from "./useCachedQuery";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cache-keys";

export interface Exercise {
    id: string;
    name: string;
    equipment: string | null;
    owner_id: string | null;
    video_url: string | null;
    instructions: string | null;
    difficulty_level: string | null;
    muscle_groups: { id: string; name: string }[];
}

interface MuscleGroup {
    id: string;
    name: string;
}

interface ExerciseLibraryData {
    exercises: Exercise[];
    muscleGroups: MuscleGroup[];
}

export function useExerciseLibrary() {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

    const fetcher = useCallback(async (): Promise<ExerciseLibraryData> => {
        const [exerciseRes, muscleRes] = await Promise.all([
            (supabase as any)
                .from("exercises")
                .select("id, name, equipment, owner_id, video_url, instructions, difficulty_level, exercise_muscle_groups(muscle_groups(id, name))")
                .eq("is_archived", false)
                .order("name"),
            (supabase as any).from("muscle_groups").select("id, name").order("name"),
        ]);

        const exercises: Exercise[] = (exerciseRes.data ?? []).map((e: any) => ({
            id: e.id,
            name: e.name,
            equipment: e.equipment,
            owner_id: e.owner_id,
            video_url: e.video_url,
            instructions: e.instructions,
            difficulty_level: e.difficulty_level,
            muscle_groups: (e.exercise_muscle_groups ?? [])
                .map((emg: any) => emg.muscle_groups)
                .filter(Boolean),
        }));

        const muscleGroups: MuscleGroup[] = muscleRes.data ?? [];

        return { exercises, muscleGroups };
    }, []);

    const { data, isLoading, refresh } = useCachedQuery<ExerciseLibraryData>({
        cacheKey: CACHE_KEYS.EXERCISE_LIBRARY,
        fetcher,
        ttl: CACHE_TTL.EXERCISE_LIBRARY,
    });

    const allExercises = data?.exercises ?? [];
    const muscleGroups = data?.muscleGroups ?? [];

    const filtered = useMemo(() => {
        let result = allExercises;

        if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter((e) => e.name.toLowerCase().includes(q));
        }

        if (muscleFilter) {
            result = result.filter((e) =>
                e.muscle_groups.some((mg) => mg.id === muscleFilter)
            );
        }

        return result;
    }, [allExercises, debouncedSearch, muscleFilter]);

    return {
        exercises: filtered,
        allExercises,
        muscleGroups,
        search,
        setSearch,
        muscleFilter,
        setMuscleFilter,
        isLoading,
        refresh,
    };
}

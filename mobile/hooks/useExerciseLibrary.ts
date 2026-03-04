import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";

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

export function useExerciseLibrary() {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [exerciseRes, muscleRes] = await Promise.all([
                (supabase as any)
                    .from("exercises")
                    .select("id, name, equipment, owner_id, video_url, instructions, difficulty_level, exercise_muscle_groups(muscle_groups(id, name))")
                    .eq("is_archived", false)
                    .order("name"),
                (supabase as any).from("muscle_groups").select("id, name").order("name"),
            ]);

            if (exerciseRes.data) {
                const mapped: Exercise[] = exerciseRes.data.map((e: any) => ({
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
                setExercises(mapped);
            }

            if (muscleRes.data) {
                setMuscleGroups(muscleRes.data);
            }
        } catch (err) {
            console.error("[exercises] Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filtered = useMemo(() => {
        let result = exercises;

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter((e) => e.name.toLowerCase().includes(q));
        }

        if (muscleFilter) {
            result = result.filter((e) =>
                e.muscle_groups.some((mg) => mg.id === muscleFilter)
            );
        }

        return result;
    }, [exercises, search, muscleFilter]);

    return {
        exercises: filtered,
        allExercises: exercises,
        muscleGroups,
        search,
        setSearch,
        muscleFilter,
        setMuscleFilter,
        isLoading,
        refresh: fetchData,
    };
}

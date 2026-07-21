import { useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useDebounce } from "./useDebounce";
import { useCachedQuery } from "./useCachedQuery";
import { useRoleMode } from "../contexts/RoleModeContext";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cache-keys";
import { matchesSearch } from "@kinevo/shared/utils/search-text";

export type OwnerFilter = "all" | "mine";

export interface Exercise {
    id: string;
    name: string;
    equipment: string | null;
    owner_id: string | null;
    video_url: string | null;
    instructions: string | null;
    difficulty_level: string | null;
    muscle_groups: { id: string; name: string }[];
    /** Funções de treino ("pra quê": mobilidade, ativação, potência…). */
    functions: { id: string; name: string }[];
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
    // `trainerId` é o id da linha em `trainers` — mesmo valor gravado em
    // `exercises.owner_id` quando o treinador cria um exercício. Usado pelo
    // filtro "Meus exercícios". Null quando o usuário não está em modo trainer.
    const { trainerId } = useRoleMode();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
    const [functionFilter, setFunctionFilter] = useState<string | null>(null);
    const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");

    const fetcher = useCallback(async (): Promise<ExerciseLibraryData> => {
        const [exerciseRes, muscleRes] = await Promise.all([
            (supabase as any)
                .from("exercises")
                .select("id, name, equipment, owner_id, video_url, instructions, difficulty_level, exercise_muscle_groups(muscle_groups(id, name)), exercise_function_links(exercise_functions(id, name, sort_order))")
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
            functions: (e.exercise_function_links ?? [])
                .map((l: any) => l.exercise_functions)
                .filter(Boolean)
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((f: any) => ({ id: f.id, name: f.name })),
        }));

        const muscleGroups: MuscleGroup[] = muscleRes.data ?? [];

        return { exercises, muscleGroups };
    }, []);

    const { data, isLoading, refresh } = useCachedQuery<ExerciseLibraryData>({
        cacheKey: CACHE_KEYS.EXERCISE_LIBRARY,
        fetcher,
        ttl: CACHE_TTL.EXERCISE_LIBRARY,
        // The catalog changes rarely; within the 30 min TTL serve straight from
        // MMKV with no background roundtrip. Creating/editing/deleting an
        // exercise invalidates this key in useExerciseCrud, and pull-to-refresh
        // still refetches — so new exercises are never stranded stale.
        revalidateWhenFresh: false,
    });

    const allExercises = data?.exercises ?? [];
    const muscleGroups = data?.muscleGroups ?? [];

    // Funções presentes na biblioteca (o chip só existe se houver exercício
    // taggeado) — derivadas localmente, sem query extra.
    const exerciseFunctions = useMemo(() => {
        const seen = new Map<string, string>();
        for (const e of allExercises) for (const f of e.functions) seen.set(f.id, f.name);
        return [...seen.entries()].map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allExercises]);

    const filtered = useMemo(() => {
        let result = allExercises;

        if (debouncedSearch.trim()) {
            result = result.filter((e) => matchesSearch(e.name, debouncedSearch));
        }

        if (muscleFilter) {
            result = result.filter((e) =>
                e.muscle_groups.some((mg) => mg.id === muscleFilter)
            );
        }

        if (functionFilter) {
            result = result.filter((e) =>
                e.functions.some((f) => f.id === functionFilter)
            );
        }

        if (ownerFilter === "mine" && trainerId) {
            result = result.filter((e) => e.owner_id === trainerId);
        }

        return result;
    }, [allExercises, debouncedSearch, muscleFilter, functionFilter, ownerFilter, trainerId]);

    return {
        exercises: filtered,
        allExercises,
        muscleGroups,
        exerciseFunctions,
        search,
        setSearch,
        muscleFilter,
        setMuscleFilter,
        functionFilter,
        setFunctionFilter,
        ownerFilter,
        setOwnerFilter,
        // True quando o usuário está em modo trainer e portanto pode ter
        // exercícios próprios para filtrar. A UI usa isso para esconder o
        // chip "Meus" do aluno.
        canFilterOwn: !!trainerId,
        isLoading,
        refresh,
    };
}

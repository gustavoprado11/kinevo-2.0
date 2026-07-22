import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AssignedProgramHydrationData } from "../stores/program-builder-store";

export type AssignedProgramTree = AssignedProgramHydrationData & { student_id: string };

interface LoadResult {
    data: AssignedProgramTree | null;
    loading: boolean;
    error: string | null;
}

/**
 * Fetches an assigned program with its workouts, items and per-set rows,
 * flattening the embedded `exercises` relation onto each item. Shared by the
 * edit-hydration hook below and by the "copiar programa atual" flow in the
 * builder (which loads on demand instead of via hook).
 */
export async function fetchAssignedProgramTree(
    assignedProgramId: string,
): Promise<AssignedProgramTree> {
    const { data: program, error: programError } = await (supabase as any)
        .from("assigned_programs")
        .select(`
            id,
            student_id,
            name,
            description,
            duration_weeks,
            status,
            started_at,
            scheduled_start_date,
            assigned_workouts (
                id,
                name,
                order_index,
                scheduled_days,
                workout_type,
                assigned_workout_items (
                    id,
                    item_type,
                    order_index,
                    parent_item_id,
                    exercise_id,
                    substitute_exercise_ids,
                    sets,
                    reps,
                    rest_seconds,
                    notes,
                    item_config,
                    method_key,
                    rounds,
                    exercise_function,
                    exercises (
                        name,
                        equipment,
                        exercise_muscle_groups (
                            muscle_groups ( name )
                        )
                    ),
                    assigned_workout_item_sets (
                        set_number,
                        set_type,
                        reps,
                        rest_seconds,
                        weight_target_kg,
                        weight_target_pct1rm,
                        rir,
                        tempo,
                        notes,
                        round_number
                    )
                )
            )
        `)
        .eq("id", assignedProgramId)
        .single();

    if (programError || !program) {
        throw new Error(programError?.message ?? "Programa não encontrado");
    }

    // Exercise name/equipment/muscle groups now ride along on the first
    // query via the embedded `exercises` relation (programs are small —
    // max ~50 items — so the duplication is negligible). This removes the
    // second sequential roundtrip, which mattered most for clients far
    // from the us-west-2 DB. Flatten the embed onto each item so the
    // store's hydrator keeps reading exercise_name/exercise_equipment/
    // exercise_muscle_groups directly. Muscle groups feed the volume
    // summary — without them the per-group volume reads as zero and the
    // summary hides entirely when editing an existing program.
    const enrichedWorkouts = (program.assigned_workouts ?? []).map((w: any) => ({
        ...w,
        assigned_workout_items: (w.assigned_workout_items ?? []).map((it: any) => ({
            ...it,
            exercise_name: it.exercises?.name ?? "",
            exercise_equipment: it.exercises?.equipment ?? null,
            exercise_muscle_groups: (it.exercises?.exercise_muscle_groups ?? [])
                .map((emg: any) => emg.muscle_groups?.name)
                .filter((name: unknown): name is string => typeof name === "string"),
        })),
    }));

    return {
        id: program.id,
        student_id: program.student_id,
        name: program.name,
        description: program.description,
        duration_weeks: program.duration_weeks,
        status: program.status ?? null,
        started_at: program.started_at ?? null,
        scheduled_start_date: program.scheduled_start_date ?? null,
        assigned_workouts: enrichedWorkouts,
    };
}

/**
 * Loads an assigned program with its workouts, items and per-set rows so the
 * Program Builder can hydrate a draft for editing.
 */
export function useLoadAssignedProgram(assignedProgramId: string | null): LoadResult {
    const [data, setData] = useState<LoadResult["data"]>(null);
    const [loading, setLoading] = useState<boolean>(!!assignedProgramId);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!assignedProgramId) {
            setData(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchAssignedProgramTree(assignedProgramId)
            .then((tree) => {
                if (cancelled) return;
                setData(tree);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Erro ao carregar programa");
                setData(null);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [assignedProgramId]);

    return { data, loading, error };
}

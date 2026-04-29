import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AssignedProgramHydrationData } from "../stores/program-builder-store";

interface LoadResult {
    data: (AssignedProgramHydrationData & { student_id: string }) | null;
    loading: boolean;
    error: string | null;
}

/**
 * Loads an assigned program with its workouts, items and per-set rows so the
 * Program Builder can hydrate a draft for editing. Also resolves exercise
 * names in a second query (the join through `exercises` would otherwise
 * inflate the result and exceed RLS-friendly nesting).
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

        (async () => {
            const { data: program, error: programError } = await (supabase as any)
                .from("assigned_programs")
                .select(`
                    id,
                    student_id,
                    name,
                    description,
                    duration_weeks,
                    assigned_workouts (
                        id,
                        name,
                        order_index,
                        scheduled_days,
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

            if (cancelled) return;

            if (programError || !program) {
                setError(programError?.message ?? "Programa não encontrado");
                setData(null);
                setLoading(false);
                return;
            }

            // Resolve exercise names in one batched query so the builder can
            // render them without each item carrying a nested join payload.
            const exerciseIds = new Set<string>();
            for (const w of program.assigned_workouts ?? []) {
                for (const it of w.assigned_workout_items ?? []) {
                    if (it.exercise_id) exerciseIds.add(it.exercise_id);
                }
            }

            let nameMap: Record<string, { name: string; equipment: string | null }> = {};
            if (exerciseIds.size > 0) {
                const { data: exercises } = await (supabase as any)
                    .from("exercises")
                    .select("id, name, equipment")
                    .in("id", Array.from(exerciseIds));
                if (exercises) {
                    for (const ex of exercises) {
                        nameMap[ex.id] = { name: ex.name, equipment: ex.equipment ?? null };
                    }
                }
            }

            // Inject exercise_name on each item — the store's hydrator reads
            // it directly without re-querying.
            const enrichedWorkouts = (program.assigned_workouts ?? []).map((w: any) => ({
                ...w,
                assigned_workout_items: (w.assigned_workout_items ?? []).map((it: any) => ({
                    ...it,
                    exercise_name: it.exercise_id ? nameMap[it.exercise_id]?.name ?? "" : "",
                    exercise_equipment: it.exercise_id ? nameMap[it.exercise_id]?.equipment ?? null : null,
                })),
            }));

            setData({
                id: program.id,
                student_id: program.student_id,
                name: program.name,
                description: program.description,
                duration_weeks: program.duration_weeks,
                assigned_workouts: enrichedWorkouts,
            });
            setLoading(false);
        })().catch((err) => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : "Erro ao carregar programa");
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [assignedProgramId]);

    return { data, loading, error };
}

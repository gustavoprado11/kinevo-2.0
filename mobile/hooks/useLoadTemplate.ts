import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { TemplateHydrationData } from "../stores/program-builder-store";

interface LoadResult {
    data: TemplateHydrationData | null;
    loading: boolean;
    error: string | null;
}

/**
 * Loads a program template with its workouts, items and per-set rows so the
 * Program Builder can hydrate a draft for editing. Resolves exercise
 * names/equipment in a second batched query (templates don't carry the
 * denormalized snapshot that assigned_workout_items does). Mirrors
 * `useLoadAssignedProgram`.
 */
export function useLoadTemplate(templateId: string | null): LoadResult {
    const [data, setData] = useState<LoadResult["data"]>(null);
    const [loading, setLoading] = useState<boolean>(!!templateId);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!templateId) {
            setData(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            const { data: program, error: programError } = await (supabase as any)
                .from("program_templates")
                .select(`
                    id,
                    name,
                    description,
                    duration_weeks,
                    workout_templates (
                        id,
                        name,
                        order_index,
                        frequency,
                        workout_type,
                        workout_item_templates (
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
                            exercise_function,
                            item_config,
                            method_key,
                            rounds,
                            workout_item_set_templates (
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
                .eq("id", templateId)
                .single();

            if (cancelled) return;

            if (programError || !program) {
                setError(programError?.message ?? "Modelo não encontrado");
                setData(null);
                setLoading(false);
                return;
            }

            // Resolve exercise names in one batched query so the builder can
            // render them without each item carrying a nested join payload.
            const exerciseIds = new Set<string>();
            for (const w of program.workout_templates ?? []) {
                for (const it of w.workout_item_templates ?? []) {
                    if (it.exercise_id) exerciseIds.add(it.exercise_id);
                }
            }

            const nameMap: Record<string, { name: string; equipment: string | null; muscleGroups: string[] }> = {};
            if (exerciseIds.size > 0) {
                const { data: exercises } = await (supabase as any)
                    .from("exercises")
                    .select("id, name, equipment, exercise_muscle_groups(muscle_groups(name))")
                    .in("id", Array.from(exerciseIds));
                if (exercises) {
                    for (const ex of exercises) {
                        nameMap[ex.id] = {
                            name: ex.name,
                            equipment: ex.equipment ?? null,
                            muscleGroups: (ex.exercise_muscle_groups ?? [])
                                .map((emg: any) => emg.muscle_groups?.name)
                                .filter((name: unknown): name is string => typeof name === "string"),
                        };
                    }
                }
            }

            // Flatten name/equipment/muscle groups onto each item. Muscle groups
            // feed the builder's volume summary — without them the per-group
            // volume reads as zero and the summary hides when editing a template.
            const enrichedWorkouts = (program.workout_templates ?? []).map((w: any) => ({
                ...w,
                workout_item_templates: (w.workout_item_templates ?? []).map((it: any) => ({
                    ...it,
                    exercise_name: it.exercise_id ? nameMap[it.exercise_id]?.name ?? "" : "",
                    exercise_equipment: it.exercise_id ? nameMap[it.exercise_id]?.equipment ?? null : null,
                    exercise_muscle_groups: it.exercise_id ? nameMap[it.exercise_id]?.muscleGroups ?? [] : [],
                })),
            }));

            setData({
                id: program.id,
                name: program.name,
                description: program.description,
                duration_weeks: program.duration_weeks,
                workout_templates: enrichedWorkouts,
            });
            setLoading(false);
        })().catch((err) => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : "Erro ao carregar modelo");
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [templateId]);

    return { data, loading, error };
}

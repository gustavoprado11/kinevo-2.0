import { useCallback } from "react";
import { useProgramBuilderStore } from "../stores/program-builder-store";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";

export function useProgramBuilder() {
    const store = useProgramBuilderStore();

    const saveAsTemplate = useCallback(async (): Promise<string> => {
        const { draft } = store;

        if (!draft.name.trim()) {
            throw new Error("Nome do programa é obrigatório");
        }

        const hasExercises = draft.workouts.some(w => w.items.length > 0);
        if (!hasExercises) {
            throw new Error("Adicione pelo menos um exercício");
        }

        store.setSaving(true);

        try {
            // 1. Create program_templates
            const { data: newProgram, error: createError } = await supabase
                .from('program_templates')
                .insert({
                    name: draft.name.trim(),
                    description: draft.description.trim() || null,
                    duration_weeks: draft.duration_weeks,
                    is_template: !draft.studentId,
                } as any)
                .select('id')
                .single();

            if (createError) throw createError;
            const programId = (newProgram as any).id as string;

            // 2. For each workout: insert workout_templates
            for (const workout of draft.workouts) {
                const { data: savedWorkout, error: workoutError } = await supabase
                    .from('workout_templates')
                    .insert({
                        program_template_id: programId,
                        name: workout.name,
                        order_index: workout.order_index,
                        frequency: workout.frequency,
                    } as any)
                    .select('id')
                    .single();

                if (workoutError) throw workoutError;
                const workoutId = (savedWorkout as any).id as string;

                // 3. Two-pass insert: root items first, then children
                // Map local IDs → DB IDs for parent_item_id references
                const idMap = new Map<string, string>();

                // Pass 1: Insert root items (parent_item_id is null)
                const rootItems = workout.items.filter(i => !i.parent_item_id);
                for (const item of rootItems) {
                    const { data: savedItem, error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: workoutId,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
                            exercise_id: item.item_type === 'superset' ? null : item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids,
                            sets: item.sets,
                            reps: item.reps,
                            rest_seconds: item.rest_seconds,
                            notes: item.notes,
                            exercise_function: item.exercise_function || null,
                            item_config: item.item_config,
                        } as any)
                        .select('id')
                        .single();

                    if (itemError) throw itemError;
                    idMap.set(item.id, (savedItem as any).id);
                }

                // Pass 2: Insert child items (exercises inside supersets)
                const childItems = workout.items.filter(i => !!i.parent_item_id);
                for (const item of childItems) {
                    const dbParentId = idMap.get(item.parent_item_id!);
                    if (!dbParentId) continue; // safety check

                    const { error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: workoutId,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: dbParentId,
                            exercise_id: item.exercise_id,
                            substitute_exercise_ids: item.substitute_exercise_ids,
                            sets: item.sets,
                            reps: item.reps,
                            rest_seconds: item.rest_seconds,
                            notes: item.notes,
                            exercise_function: item.exercise_function || null,
                            item_config: item.item_config,
                        } as any);

                    if (itemError) throw itemError;
                }
            }

            return programId;
        } finally {
            store.setSaving(false);
        }
    }, [store]);

    const saveAndAssign = useCallback(async (targetStudentId: string): Promise<void> => {
        try {
            const programId = await saveAsTemplate();

            // Call assign Edge Function (same pattern as AssignProgramWizard)
            const { data: result, error } = await supabase.functions.invoke("assign-program", {
                body: {
                    studentId: targetStudentId,
                    templateId: programId,
                    startDate: new Date().toISOString(),
                    isScheduled: false,
                },
            });

            if (error) throw new Error(error.message || "Falha ao atribuir programa");
            if (result?.error) throw new Error(result.error);

            toast.success("Programa criado!", `"${store.draft.name}" foi atribuído ao aluno.`);
            store.reset();
        } catch (err: any) {
            toast.error("Erro", err.message || "Falha ao salvar programa.");
            throw err;
        }
    }, [saveAsTemplate, store]);

    return {
        draft: store.draft,
        currentWorkoutId: store.currentWorkoutId,
        isSaving: store.isSaving,
        isDirty: store.isDirty,
        initNewProgram: store.initNewProgram,
        updateName: store.updateName,
        updateDescription: store.updateDescription,
        updateDurationWeeks: store.updateDurationWeeks,
        addWorkout: store.addWorkout,
        removeWorkout: store.removeWorkout,
        renameWorkout: store.renameWorkout,
        updateWorkoutFrequency: store.updateWorkoutFrequency,
        setCurrentWorkout: store.setCurrentWorkout,
        addExercise: store.addExercise,
        updateItem: store.updateItem,
        removeItem: store.removeItem,
        reorderItems: store.reorderItems,
        reset: store.reset,
        saveAsTemplate,
        saveAndAssign,
    };
}

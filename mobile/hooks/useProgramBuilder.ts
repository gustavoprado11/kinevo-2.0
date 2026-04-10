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

                // 3. For each item: insert workout_item_templates
                for (const item of workout.items) {
                    const { error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: workoutId,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
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

            // Call assign API (same pattern as AssignProgramWizard)
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Sessão expirada");

            const apiUrl = process.env.EXPO_PUBLIC_WEB_URL || "https://app.kinevo.com.br";
            const response = await fetch(`${apiUrl}/api/programs/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    studentId: targetStudentId,
                    templateId: programId,
                    startDate: new Date().toISOString(),
                    isScheduled: false,
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Falha ao atribuir programa");

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

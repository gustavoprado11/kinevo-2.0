import { useCallback } from "react";
import { useProgramBuilderStore } from "../stores/program-builder-store";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";
import {
    buildSnapshotFromDraft,
    SupersetInSnapshotError,
} from "@kinevo/shared/lib/prescription/snapshot-from-draft";
import type { ProgramDraftLike } from "@kinevo/shared/types/prescription";
import { assignProgram, AIPrescriptionFetchError } from "../lib/ai-prescription/fetch-client";

export type SaveAndAssignResult =
    | { ok: true }
    | { ok: false; reason: "SUPERSET_BLOCKED" }
    | { ok: false; reason: "ERROR"; message: string };

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

    const saveAndAssign = useCallback(async (targetStudentId: string): Promise<SaveAndAssignResult> => {
        const draft = store.draft;

        // ── AI path: round-trip the snapshot to /api/programs/assign with isEdited=true ──
        if (draft.originatedFromAi && draft.generationId) {
            // Convert the mobile Workout[] into the structural ProgramDraftLike
            // shape the shared serializer expects.
            const draftLike: ProgramDraftLike = {
                name: draft.name,
                description: draft.description,
                duration_weeks: draft.duration_weeks,
                workouts: draft.workouts.map((w) => ({
                    name: w.name,
                    order_index: w.order_index,
                    frequency: w.frequency,
                    items: w.items.map((it) => ({
                        item_type: it.item_type,
                        order_index: it.order_index,
                        parent_item_id: it.parent_item_id,
                        exercise_id: it.exercise_id,
                        exercise_name: it.exercise_name,
                        exercise_muscle_groups: it.exercise_muscle_groups,
                        exercise_equipment: it.exercise_equipment,
                        exercise_function: it.exercise_function,
                        sets: it.sets,
                        reps: it.reps,
                        rest_seconds: it.rest_seconds,
                        notes: it.notes,
                        substitute_exercise_ids: it.substitute_exercise_ids,
                        item_config: it.item_config,
                    })),
                })),
            };

            let snapshot;
            try {
                snapshot = buildSnapshotFromDraft(draftLike, {
                    preserveReasoning: draft.originalSnapshot?.reasoning,
                });
            } catch (err) {
                if (err instanceof SupersetInSnapshotError) {
                    return { ok: false, reason: "SUPERSET_BLOCKED" };
                }
                throw err;
            }

            store.setSaving(true);
            try {
                const result = await assignProgram({
                    studentId: targetStudentId,
                    generationId: draft.generationId,
                    isEdited: true,
                    outputSnapshot: snapshot,
                    startDate: new Date().toISOString(),
                    isScheduled: false,
                });
                if (!result.success) {
                    const message = result.error || "Falha ao salvar programa.";
                    toast.error("Erro", message);
                    return { ok: false, reason: "ERROR", message };
                }
                toast.success("Programa atribuído!", `"${draft.name}" foi atribuído ao aluno.`);
                store.reset();
                return { ok: true };
            } catch (err) {
                const message =
                    err instanceof AIPrescriptionFetchError
                        ? err.message
                        : err instanceof Error
                            ? err.message
                            : "Falha ao salvar programa.";
                toast.error("Erro", message);
                return { ok: false, reason: "ERROR", message };
            } finally {
                store.setSaving(false);
            }
        }

        // ── Manual / parsed-text path: save as template, then assign via Edge Function (legacy) ──
        try {
            const programId = await saveAsTemplate();

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

            toast.success("Programa criado!", `"${draft.name}" foi atribuído ao aluno.`);
            store.reset();
            return { ok: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao salvar programa.";
            toast.error("Erro", message);
            return { ok: false, reason: "ERROR", message };
        }
    }, [saveAsTemplate, store]);

    /**
     * Escape hatch for the supersets case: drop the AI linkage from the draft
     * and re-run the save through the legacy template path. Used when the
     * trainer added supersets after the AI generation and chose "Salvar como
     * programa novo" in the Alert.
     */
    const saveAsNewProgramDiscardingAi = useCallback(
        async (targetStudentId: string): Promise<SaveAndAssignResult> => {
            // Mutate the draft in-place (single transactional set) to drop AI
            // metadata, then reuse the legacy save path.
            useProgramBuilderStore.setState((state) => ({
                draft: {
                    ...state.draft,
                    generationId: null,
                    originatedFromAi: false,
                    originalSnapshot: null,
                },
            }));
            return saveAndAssign(targetStudentId);
        },
        [saveAndAssign],
    );

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
        saveAsNewProgramDiscardingAi,
    };
}

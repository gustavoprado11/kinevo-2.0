import { useCallback, useRef } from "react";
import { useProgramBuilderStore, type WorkoutItem } from "../stores/program-builder-store";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";
import {
    buildSnapshotFromDraft,
    SupersetInSnapshotError,
} from "@kinevo/shared/lib/prescription/snapshot-from-draft";
import type { ProgramDraftLike, WorkoutSet } from "@kinevo/shared/types/prescription";
import {
    expandSchemeByRounds,
    summarizeSetScheme,
    summarizeWithRounds,
} from "@kinevo/shared/lib/prescription/set-scheme";
import { isCompoundMethod } from "@kinevo/shared/lib/prescription/set-scheme-presets";
import { assignProgram, AIPrescriptionFetchError } from "../lib/ai-prescription/fetch-client";

// ── Per-set helpers (Fase 3 / 4.3) ──

/** Effective rounds for an item. Compound methods (drop-set, cluster) honor
 *  `item.rounds`; linear methods are forced to 1 even if the trainer typed a
 *  larger value somewhere — defesa em profundidade. */
function effectiveRoundsForItem(item: WorkoutItem): number {
    if (!item.set_scheme || item.set_scheme.length === 0) return 1;
    if (!isCompoundMethod(item.method_key)) return 1;
    const r = Number.isFinite(item.rounds) ? Math.floor(item.rounds) : 1;
    return Math.max(1, Math.min(20, r));
}

/** Derive coerced aggregates from a per-set scheme + rounds. Returns the
 *  item's own aggregates when no scheme exists. */
function aggregatesFromItem(item: WorkoutItem): { sets: number; reps: string; rest_seconds: number } {
    if (item.set_scheme && item.set_scheme.length > 0) {
        const rounds = effectiveRoundsForItem(item);
        return rounds > 1
            ? summarizeWithRounds(item.set_scheme, rounds)
            : summarizeSetScheme(item.set_scheme);
    }
    return { sets: item.sets, reps: item.reps, rest_seconds: item.rest_seconds };
}

/** Insert children rows in workout_item_set_templates. No-op when empty.
 *  Skipped silently for items inside superset (defesa em profundidade).
 *  Materializes per-round schemes via `expandSchemeByRounds` and tags each
 *  output row with `round_number` (Fase 4.3). */
async function insertSetSchemeRows(
    workoutItemTemplateId: string,
    item: WorkoutItem,
): Promise<void> {
    if (item.parent_item_id) return; // V1: superset bloqueado
    const scheme = item.set_scheme;
    if (!scheme || scheme.length === 0) return;
    const rounds = effectiveRoundsForItem(item);
    const expanded = expandSchemeByRounds(scheme, rounds);
    const isCompound = rounds > 1;
    const rows = expanded.map((s: WorkoutSet, i: number) => ({
        workout_item_template_id: workoutItemTemplateId,
        set_number: i + 1,
        set_type: s.set_type,
        reps: s.reps,
        rest_seconds: s.rest_seconds,
        weight_target_kg: s.weight_target_kg,
        weight_target_pct1rm: s.weight_target_pct1rm,
        rir: s.rir,
        tempo: s.tempo,
        notes: s.notes,
        round_number: isCompound ? (s.round_number ?? null) : null,
    }));
    // The migration 111/112 columns may not be in the generated Database types
    // yet; cast to any so this compiles until `npm run gen:types` is regenerated.
    const { error } = await (supabase.from as any)('workout_item_set_templates').insert(rows as any);
    if (error) throw error;
}

export type SaveAndAssignResult =
    | { ok: true }
    | { ok: false; reason: "SUPERSET_BLOCKED" }
    | { ok: false; reason: "ADVANCED_SCHEME_BLOCKED" }
    | { ok: false; reason: "ERROR"; message: string };

export function useProgramBuilder() {
    const store = useProgramBuilderStore();

    // A8: o save manual cria a árvore de template e DEPOIS chama a Edge Function
    // `assign-program`. Se o assign falhava, a árvore ficava órfã e cada novo
    // toque em "Salvar" recriava outra árvore (sem idempotência). Guardamos o
    // programId criado + uma assinatura do draft; num retry com o MESMO draft,
    // reaproveitamos a árvore em vez de recriar. Se o treinador editar o draft,
    // a assinatura muda e criamos uma árvore nova (não reatribui conteúdo velho).
    const pendingTemplateRef = useRef<{ programId: string; signature: string } | null>(null);

    const saveAsTemplate = useCallback(async (): Promise<string> => {
        const { draft } = store;

        if (!draft.name.trim()) {
            throw new Error("Nome do programa é obrigatório");
        }

        const hasBlocks = draft.workouts.some(w => w.items.length > 0);
        if (!hasBlocks) {
            throw new Error("Adicione pelo menos um bloco ao programa");
        }

        store.setSaving(true);

        try {
            // 1. Create program_templates.
            // R28: nasce SEMPRE is_template=false (invisível na biblioteca) e o
            // flag só vira true no fim, com a árvore completa — falha de rede
            // no meio deixava um modelo TRUNCADO visível na biblioteca (e cada
            // retry criava outro). O save é N+1 sem transação (pendência
            // conhecida); isto contém o efeito visível da falha parcial.
            const wantsLibraryFlag = !draft.studentId;
            const { data: newProgram, error: createError } = await supabase
                .from('program_templates')
                .insert({
                    name: draft.name.trim(),
                    description: draft.description.trim() || null,
                    duration_weeks: draft.duration_weeks,
                    is_template: false,
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
                        workout_type: workout.workout_type ?? 'strength',
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
                    const aggs = aggregatesFromItem(item);
                    const { data: savedItem, error: itemError } = await supabase
                        .from('workout_item_templates')
                        .insert({
                            workout_template_id: workoutId,
                            item_type: item.item_type,
                            order_index: item.order_index,
                            parent_item_id: null,
                            // Apenas item_type === 'exercise' carrega exercise_id real.
                            // Note/warmup/cardio/superset persistem como NULL (CHECK
                            // constraint do banco aceita NULL pra esses tipos). O
                            // `|| null` é safety pra evitar '' (UUID inválido).
                            exercise_id:
                                item.item_type === 'exercise'
                                    ? (item.exercise_id || null)
                                    : null,
                            substitute_exercise_ids: item.substitute_exercise_ids,
                            sets: aggs.sets,
                            reps: aggs.reps,
                            rest_seconds: aggs.rest_seconds,
                            notes: item.notes,
                            exercise_function: item.exercise_function || null,
                            item_config: item.item_config,
                            method_key: item.method_key ?? null,
                            rounds: effectiveRoundsForItem(item),
                        } as any)
                        .select('id')
                        .single();

                    if (itemError) throw itemError;
                    const dbId = (savedItem as any).id as string;
                    idMap.set(item.id, dbId);

                    // Per-set children (Fase 3 / 4.3 — expanded by rounds).
                    await insertSetSchemeRows(dbId, item);
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
                            // Safety: superset children são sempre 'exercise' mas
                            // coerce '' → null pra evitar UUID inválido caso o
                            // store algum dia tenha child sem exercise_id.
                            exercise_id: item.exercise_id || null,
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

            // R28: árvore completa — só agora o modelo aparece na biblioteca.
            if (wantsLibraryFlag) {
                const { error: flagError } = await supabase
                    .from('program_templates')
                    .update({ is_template: true } as any)
                    .eq('id', programId);
                if (flagError) throw flagError;
            }

            return programId;
        } finally {
            store.setSaving(false);
        }
    }, [store]);

    const saveAndAssign = useCallback(async (targetStudentId: string): Promise<SaveAndAssignResult> => {
        // Lê sempre o estado fresco (evita closure obsoleta após mutações no mesmo tick,
        // ex.: clearSupersets() seguido de retry).
        const draft = useProgramBuilderStore.getState().draft;

        // ── AI path: round-trip the snapshot to /api/programs/assign with isEdited=true ──
        if (draft.originatedFromAi && draft.generationId) {
            // R9: o snapshot de IA (GeneratedWorkoutItem) não transporta
            // set_scheme/method_key/rounds — salvar descartaria a prescrição
            // avançada em silêncio (o aluno receberia só os agregados). Mesmo
            // contrato do bloqueio de superset: falha explícita + auto-fix.
            const hasAdvancedScheme = draft.workouts.some((w) =>
                w.items.some(
                    (it) =>
                        (it.set_scheme && it.set_scheme.length > 0) ||
                        (it.method_key != null && it.method_key !== "standard") ||
                        (it.rounds ?? 1) > 1,
                ),
            );
            if (hasAdvancedScheme) {
                return { ok: false, reason: "ADVANCED_SCHEME_BLOCKED" };
            }

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
                    workout_type: w.workout_type ?? 'strength',
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
            // A8: num retry com o MESMO draft, reaproveita a árvore já criada em
            // vez de recriar (cada recriação deixava um template órfão no banco).
            const signature = JSON.stringify(draft);
            let programId: string;
            if (pendingTemplateRef.current && pendingTemplateRef.current.signature === signature) {
                programId = pendingTemplateRef.current.programId;
            } else {
                programId = await saveAsTemplate();
                pendingTemplateRef.current = { programId, signature };
            }

            // R29: o finally interno do saveAsTemplate zera isSaving ANTES do
            // invoke — o botão Salvar ficava ativo durante todo o roundtrip da
            // Edge Function e um segundo tap disparava um assign concorrente
            // (programa "concluído" fantasma + push duplicado). Cobre o invoke.
            store.setSaving(true);
            try {
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

                pendingTemplateRef.current = null; // sucesso → não reaproveitar
                toast.success("Programa criado!", `"${draft.name}" foi atribuído ao aluno.`);
                store.reset();
                return { ok: true };
            } finally {
                store.setSaving(false);
            }
        } catch (err) {
            // Mantém pendingTemplateRef: o próximo retry (mesmo draft) reaproveita
            // a árvore criada em vez de gerar outra órfã. Editar o draft muda a
            // assinatura e força uma árvore nova.
            const message = err instanceof Error ? err.message : "Falha ao salvar programa.";
            toast.error("Erro", message);
            return { ok: false, reason: "ERROR", message };
        }
    }, [saveAsTemplate, store]);

    /**
     * Persist the full edit of an assigned program: program metadata, all
     * workouts (UPDATE existing / INSERT new / DELETE removed), all items
     * (same upsert semantics) and the materialized per-set rows in
     * `assigned_workout_item_sets`.
     *
     * Mirrors the web `EditAssignedProgramClient.saveProgram` handler. We
     * intentionally duplicate the logic here rather than extracting to
     * shared/lib (Round 2 trade-off: ship; extract when both sides start
     * needing the same audit-trail evolution).
     *
     * NOT covered (Round 2):
     * - Form triggers — mobile UI doesn't expose them yet.
     * - `prescription_generation_edits` audit log — fire-and-forget on web
     *   via Server Action; will be ported in a future round when the
     *   mobile build needs trainer-pattern learning from edited programs.
     * - Children of supersets carrying per-set scheme — same V1 block
     *   that exists on web.
     */
    const saveAssignedProgramFull = useCallback(async (): Promise<SaveAndAssignResult> => {
        const draft = store.draft;
        const programId = draft.editingAssignedProgramId;
        if (!programId) {
            return { ok: false, reason: "ERROR", message: "Programa não está em modo edição." };
        }
        if (!draft.name.trim()) {
            return { ok: false, reason: "ERROR", message: "Nome do programa é obrigatório." };
        }
        const hasBlocks = draft.workouts.some((w) => w.items.length > 0);
        if (!hasBlocks) {
            return { ok: false, reason: "ERROR", message: "Adicione pelo menos um bloco ao programa." };
        }

        const originalWorkoutIds = new Set(draft.originalWorkoutIds);
        const originalItemIds = new Set(draft.originalItemIds);

        const dayKeyToInt: Record<string, number> = {
            sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
        };
        const frequencyToScheduledDays = (freq: string[]): number[] =>
            freq.map((d) => dayKeyToInt[d]).filter((n): n is number => typeof n === "number");

        store.setSaving(true);
        try {
            // 1. Update program-level metadata. Start date / status mirror the
            //    web edit flow: an immediate program writes `started_at` + sets
            //    status active; a scheduled one writes `scheduled_start_date` +
            //    status scheduled.
            // R21 (fix M1 no mobile, convenção 229/230): estender/encurtar a
            // duração move a expiração junto (started + semanas; duração ≤0 ou
            // sem started = nunca expira). Duração 0 normaliza para NULL.
            const normalizedDuration =
                draft.duration_weeks && draft.duration_weeks > 0 ? draft.duration_weeks : null;
            const computeExpires = (startedAtIso: string | null): string | null =>
                startedAtIso && normalizedDuration
                    ? new Date(new Date(startedAtIso).getTime() + normalizedDuration * 7 * 24 * 60 * 60 * 1000).toISOString()
                    : null;
            const programUpdate: Record<string, unknown> = {
                name: draft.name.trim(),
                description: draft.description.trim() || null,
                duration_weeks: normalizedDuration,
            };
            if (draft.start_date && draft.assignment_type) {
                if (draft.assignment_type === "immediate") {
                    // M11: se a data NÃO mudou, preserva o timestamp original (com
                    // hora) em vez de gravar só a data (meia-noite UTC), que
                    // deslocava current_week a cada edição do programa.
                    const sameDay = !!draft.original_started_at
                        && draft.original_started_at.split("T")[0] === draft.start_date;
                    const startedAtValue = sameDay ? draft.original_started_at! : draft.start_date;
                    programUpdate.started_at = startedAtValue;
                    programUpdate.scheduled_start_date = null;
                    programUpdate.status = "active";
                    programUpdate.expires_at = computeExpires(startedAtValue);
                } else {
                    programUpdate.scheduled_start_date = draft.start_date;
                    programUpdate.started_at = null;
                    programUpdate.status = "scheduled";
                    programUpdate.expires_at = null;
                }
            } else if (draft.original_started_at) {
                // Sem bloco de data (edição só de metadados): recalcula a
                // expiração a partir do started_at vigente.
                programUpdate.expires_at = computeExpires(draft.original_started_at);
            }
            const { error: updateProgramError } = await supabase
                .from("assigned_programs")
                .update(programUpdate as any)
                .eq("id", programId);
            if (updateProgramError) throw updateProgramError;

            // 2. Delete workouts the trainer removed since the load. We use
            //    the live workouts list as the survivors set; anything that
            //    was originally on the program but isn't on the survivors
            //    list anymore must be deleted (cascades to items + sets).
            const liveWorkoutIds = new Set(
                draft.workouts.filter((w) => originalWorkoutIds.has(w.id)).map((w) => w.id),
            );
            const removedWorkoutIds = [...originalWorkoutIds].filter((id) => !liveWorkoutIds.has(id));
            if (removedWorkoutIds.length > 0) {
                const { error: deleteWorkoutsError } = await supabase
                    .from("assigned_workouts")
                    .delete()
                    .in("id", removedWorkoutIds);
                if (deleteWorkoutsError) throw deleteWorkoutsError;
            }

            // 3. Upsert each workout, then upsert its items.
            for (const workout of draft.workouts) {
                const isNewWorkout = !originalWorkoutIds.has(workout.id);
                let workoutDbId = workout.id;

                if (isNewWorkout) {
                    const { data: insertedWorkout, error: insertWorkoutError } = await supabase
                        .from("assigned_workouts")
                        .insert({
                            assigned_program_id: programId,
                            name: workout.name,
                            order_index: workout.order_index,
                            scheduled_days: frequencyToScheduledDays(workout.frequency),
                            workout_type: workout.workout_type ?? 'strength',
                        } as any)
                        .select("id")
                        .single();
                    if (insertWorkoutError) throw insertWorkoutError;
                    workoutDbId = (insertedWorkout as any).id as string;
                } else {
                    const { error: updateWorkoutError } = await supabase
                        .from("assigned_workouts")
                        .update({
                            name: workout.name,
                            order_index: workout.order_index,
                            scheduled_days: frequencyToScheduledDays(workout.frequency),
                            workout_type: workout.workout_type ?? 'strength',
                        } as any)
                        .eq("id", workoutDbId);
                    if (updateWorkoutError) throw updateWorkoutError;
                }

                // 3a. Delete items removed since the load (only for
                //     pre-existing workouts; new workouts have no DB items).
                if (!isNewWorkout) {
                    const liveItemIds = workout.items
                        .map((it) => it.id)
                        .filter((id) => originalItemIds.has(id));
                    if (liveItemIds.length > 0) {
                        // Espelho da migration 215: solta os filhos MANTIDOS antes
                        // do delete — senão o CASCADE de parent_item_id arrasta
                        // filhos vivos junto com um pai de superset removido.
                        // O parent correto é re-setado no upsert (3c).
                        const { error: unparentError } = await (supabase as any)
                            .from("assigned_workout_items")
                            .update({ parent_item_id: null })
                            .eq("assigned_workout_id", workoutDbId)
                            .not("parent_item_id", "is", null)
                            .in("id", liveItemIds);
                        if (unparentError) throw unparentError;

                        const { error: delItemsError } = await (supabase as any)
                            .from("assigned_workout_items")
                            .delete()
                            .eq("assigned_workout_id", workoutDbId)
                            .not("id", "in", `(${liveItemIds.join(",")})`);
                        if (delItemsError) throw delItemsError;
                    } else {
                        const { error: delItemsError } = await supabase
                            .from("assigned_workout_items")
                            .delete()
                            .eq("assigned_workout_id", workoutDbId);
                        if (delItemsError) throw delItemsError;
                    }
                }

                // 3b. Upsert root items (parent_item_id = null) first.
                const rootItems = workout.items.filter((it) => !it.parent_item_id);
                const localToDbItemId = new Map<string, string>();

                for (const item of rootItems) {
                    const isPreExistingItem = originalItemIds.has(item.id);
                    const aggs = aggregatesFromItem(item);
                    const itemRounds = effectiveRoundsForItem(item);

                    const payload = {
                        assigned_workout_id: workoutDbId,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        parent_item_id: null,
                        // Apenas item_type === 'exercise' carrega exercise_id real.
                        // Note/warmup/cardio/superset persistem como NULL. O
                        // `|| null` é safety pra evitar '' (UUID inválido).
                        exercise_id:
                            item.item_type === "exercise"
                                ? (item.exercise_id || null)
                                : null,
                        substitute_exercise_ids: item.substitute_exercise_ids ?? [],
                        sets: aggs.sets,
                        reps: aggs.reps,
                        rest_seconds: aggs.rest_seconds,
                        notes: item.notes,
                        item_config: item.item_config ?? {},
                        method_key: item.method_key ?? null,
                        rounds: itemRounds,
                        // Snapshot for offline rendering (mirrors web payload).
                        exercise_name: item.exercise_name,
                        exercise_muscle_group: item.exercise_muscle_groups?.[0] ?? null,
                        exercise_equipment: item.exercise_equipment,
                    };

                    let itemDbId: string;
                    if (!isPreExistingItem) {
                        const { data: inserted, error: insertItemError } = await (supabase as any)
                            .from("assigned_workout_items")
                            .insert(payload)
                            .select("id")
                            .single();
                        if (insertItemError) throw insertItemError;
                        itemDbId = (inserted as any).id as string;
                    } else {
                        const { error: updateItemError } = await (supabase as any)
                            .from("assigned_workout_items")
                            .update(payload)
                            .eq("id", item.id);
                        if (updateItemError) throw updateItemError;
                        itemDbId = item.id;
                    }
                    localToDbItemId.set(item.id, itemDbId);

                    // Per-set rows: DELETE+INSERT for pre-existing items,
                    // INSERT only for new items.
                    if (item.parent_item_id) {
                        // Defesa em profundidade: superset children never carry scheme.
                    } else {
                        if (isPreExistingItem) {
                            const { error: delSetsError } = await (supabase.from as any)("assigned_workout_item_sets")
                                .delete()
                                .eq("assigned_workout_item_id", itemDbId);
                            if (delSetsError) throw delSetsError;
                        }
                        if (item.set_scheme && item.set_scheme.length > 0) {
                            const expanded = itemRounds > 1
                                ? expandSchemeByRounds(item.set_scheme, itemRounds)
                                : item.set_scheme;
                            const isCompound = itemRounds > 1;
                            const rows = expanded.map((s: WorkoutSet, i: number) => ({
                                assigned_workout_item_id: itemDbId,
                                set_number: i + 1,
                                set_type: s.set_type,
                                reps: s.reps,
                                rest_seconds: s.rest_seconds,
                                weight_target_kg: s.weight_target_kg,
                                weight_target_pct1rm: s.weight_target_pct1rm,
                                rir: s.rir,
                                tempo: s.tempo,
                                notes: s.notes,
                                round_number: isCompound ? (s.round_number ?? null) : null,
                            }));
                            const { error: insSetsError } = await (supabase.from as any)("assigned_workout_item_sets").insert(rows);
                            if (insSetsError) throw insSetsError;
                        }
                    }
                }

                // 3c. Upsert child items (superset children). These never
                //     persist method/rounds/scheme — V1 supersets stay in
                //     simple mode, same as web.
                const childItems = workout.items.filter((it) => !!it.parent_item_id);
                for (const child of childItems) {
                    const isPreExistingItem = originalItemIds.has(child.id);
                    const dbParentId = localToDbItemId.get(child.parent_item_id!);
                    if (!dbParentId) continue; // safety: orphan child — skip

                    const payload = {
                        assigned_workout_id: workoutDbId,
                        item_type: child.item_type,
                        order_index: child.order_index,
                        parent_item_id: dbParentId,
                        // Safety: superset children são sempre 'exercise' mas
                        // coerce '' → null pra alinhamento com o CHECK constraint.
                        exercise_id: child.exercise_id || null,
                        substitute_exercise_ids: child.substitute_exercise_ids ?? [],
                        sets: child.sets,
                        reps: child.reps,
                        rest_seconds: child.rest_seconds,
                        notes: child.notes,
                        item_config: child.item_config ?? {},
                        method_key: null,
                        rounds: 1,
                        exercise_name: child.exercise_name,
                        exercise_muscle_group: child.exercise_muscle_groups?.[0] ?? null,
                        exercise_equipment: child.exercise_equipment,
                    };

                    if (!isPreExistingItem) {
                        const { error: insertChildError } = await (supabase as any)
                            .from("assigned_workout_items")
                            .insert(payload);
                        if (insertChildError) throw insertChildError;
                    } else {
                        const { error: updateChildError } = await (supabase as any)
                            .from("assigned_workout_items")
                            .update(payload)
                            .eq("id", child.id);
                        if (updateChildError) throw updateChildError;
                    }
                }
            }

            toast.success("Programa atualizado", "As alterações foram salvas.");
            return { ok: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao salvar programa.";
            toast.error("Erro", message);
            return { ok: false, reason: "ERROR", message };
        } finally {
            store.setSaving(false);
        }
    }, [store]);

    /**
     * Persist the full edit of a reusable program template: program metadata,
     * all workouts (UPDATE/INSERT/DELETE), all items (same upsert semantics)
     * and the materialized per-set rows in `workout_item_set_templates`.
     *
     * Mirrors `saveAssignedProgramFull` but targets the `*_templates` tables.
     * Two key differences from the assigned flow:
     * - `workout_templates.frequency` is a string[] of day keys, persisted
     *   verbatim (no scheduled_days int[] conversion).
     * - `workout_item_templates` has no denormalized exercise snapshot columns
     *   (exercise_name/muscle_group/equipment) — those only exist on
     *   assigned_workout_items and are resolved at assign time.
     */
    const saveTemplateFull = useCallback(async (): Promise<SaveAndAssignResult> => {
        const draft = store.draft;
        const templateId = draft.editingTemplateId;
        if (!templateId) {
            return { ok: false, reason: "ERROR", message: "Modelo não está em modo edição." };
        }
        if (!draft.name.trim()) {
            return { ok: false, reason: "ERROR", message: "Nome do modelo é obrigatório." };
        }
        const hasBlocks = draft.workouts.some((w) => w.items.length > 0);
        if (!hasBlocks) {
            return { ok: false, reason: "ERROR", message: "Adicione pelo menos um bloco ao modelo." };
        }

        const originalWorkoutIds = new Set(draft.originalWorkoutIds);
        const originalItemIds = new Set(draft.originalItemIds);

        store.setSaving(true);
        try {
            // 1. Update program-level metadata.
            const { error: updateProgramError } = await supabase
                .from("program_templates")
                .update({
                    name: draft.name.trim(),
                    description: draft.description.trim() || null,
                    duration_weeks: draft.duration_weeks,
                } as any)
                .eq("id", templateId);
            if (updateProgramError) throw updateProgramError;

            // 2. Delete workouts removed since the load (cascades to items + sets).
            const liveWorkoutIds = new Set(
                draft.workouts.filter((w) => originalWorkoutIds.has(w.id)).map((w) => w.id),
            );
            const removedWorkoutIds = [...originalWorkoutIds].filter((id) => !liveWorkoutIds.has(id));
            if (removedWorkoutIds.length > 0) {
                const { error: deleteWorkoutsError } = await supabase
                    .from("workout_templates")
                    .delete()
                    .in("id", removedWorkoutIds);
                if (deleteWorkoutsError) throw deleteWorkoutsError;
            }

            // 3. Upsert each workout, then upsert its items.
            for (const workout of draft.workouts) {
                const isNewWorkout = !originalWorkoutIds.has(workout.id);
                let workoutDbId = workout.id;

                if (isNewWorkout) {
                    const { data: insertedWorkout, error: insertWorkoutError } = await supabase
                        .from("workout_templates")
                        .insert({
                            program_template_id: templateId,
                            name: workout.name,
                            order_index: workout.order_index,
                            frequency: workout.frequency,
                        } as any)
                        .select("id")
                        .single();
                    if (insertWorkoutError) throw insertWorkoutError;
                    workoutDbId = (insertedWorkout as any).id as string;
                } else {
                    const { error: updateWorkoutError } = await supabase
                        .from("workout_templates")
                        .update({
                            name: workout.name,
                            order_index: workout.order_index,
                            frequency: workout.frequency,
                        } as any)
                        .eq("id", workoutDbId);
                    if (updateWorkoutError) throw updateWorkoutError;
                }

                // 3a. Delete items removed since the load (only for pre-existing workouts).
                if (!isNewWorkout) {
                    const liveItemIds = workout.items
                        .map((it) => it.id)
                        .filter((id) => originalItemIds.has(id));
                    if (liveItemIds.length > 0) {
                        // Espelho da migration 215: solta os filhos MANTIDOS antes
                        // do delete (CASCADE de parent_item_id); re-setado no 3c.
                        const { error: unparentError } = await (supabase as any)
                            .from("workout_item_templates")
                            .update({ parent_item_id: null })
                            .eq("workout_template_id", workoutDbId)
                            .not("parent_item_id", "is", null)
                            .in("id", liveItemIds);
                        if (unparentError) throw unparentError;

                        const { error: delItemsError } = await (supabase as any)
                            .from("workout_item_templates")
                            .delete()
                            .eq("workout_template_id", workoutDbId)
                            .not("id", "in", `(${liveItemIds.join(",")})`);
                        if (delItemsError) throw delItemsError;
                    } else {
                        const { error: delItemsError } = await supabase
                            .from("workout_item_templates")
                            .delete()
                            .eq("workout_template_id", workoutDbId);
                        if (delItemsError) throw delItemsError;
                    }
                }

                // 3b. Upsert root items (parent_item_id = null) first.
                const rootItems = workout.items.filter((it) => !it.parent_item_id);
                const localToDbItemId = new Map<string, string>();

                for (const item of rootItems) {
                    const isPreExistingItem = originalItemIds.has(item.id);
                    const aggs = aggregatesFromItem(item);
                    const itemRounds = effectiveRoundsForItem(item);

                    const payload = {
                        workout_template_id: workoutDbId,
                        item_type: item.item_type,
                        order_index: item.order_index,
                        parent_item_id: null,
                        exercise_id:
                            item.item_type === "exercise"
                                ? (item.exercise_id || null)
                                : null,
                        substitute_exercise_ids: item.substitute_exercise_ids ?? [],
                        sets: aggs.sets,
                        reps: aggs.reps,
                        rest_seconds: aggs.rest_seconds,
                        notes: item.notes,
                        exercise_function: item.exercise_function || null,
                        item_config: item.item_config ?? {},
                        method_key: item.method_key ?? null,
                        rounds: itemRounds,
                    };

                    let itemDbId: string;
                    if (!isPreExistingItem) {
                        const { data: inserted, error: insertItemError } = await (supabase as any)
                            .from("workout_item_templates")
                            .insert(payload)
                            .select("id")
                            .single();
                        if (insertItemError) throw insertItemError;
                        itemDbId = (inserted as any).id as string;
                    } else {
                        const { error: updateItemError } = await (supabase as any)
                            .from("workout_item_templates")
                            .update(payload)
                            .eq("id", item.id);
                        if (updateItemError) throw updateItemError;
                        itemDbId = item.id;
                    }
                    localToDbItemId.set(item.id, itemDbId);

                    // Per-set rows: DELETE+INSERT for pre-existing, INSERT for new.
                    if (isPreExistingItem) {
                        const { error: delSetsError } = await (supabase.from as any)("workout_item_set_templates")
                            .delete()
                            .eq("workout_item_template_id", itemDbId);
                        if (delSetsError) throw delSetsError;
                    }
                    if (item.set_scheme && item.set_scheme.length > 0) {
                        const expanded = itemRounds > 1
                            ? expandSchemeByRounds(item.set_scheme, itemRounds)
                            : item.set_scheme;
                        const isCompound = itemRounds > 1;
                        const rows = expanded.map((s: WorkoutSet, i: number) => ({
                            workout_item_template_id: itemDbId,
                            set_number: i + 1,
                            set_type: s.set_type,
                            reps: s.reps,
                            rest_seconds: s.rest_seconds,
                            weight_target_kg: s.weight_target_kg,
                            weight_target_pct1rm: s.weight_target_pct1rm,
                            rir: s.rir,
                            tempo: s.tempo,
                            notes: s.notes,
                            round_number: isCompound ? (s.round_number ?? null) : null,
                        }));
                        const { error: insSetsError } = await (supabase.from as any)("workout_item_set_templates").insert(rows);
                        if (insSetsError) throw insSetsError;
                    }
                }

                // 3c. Upsert child items (superset children — simple mode only).
                const childItems = workout.items.filter((it) => !!it.parent_item_id);
                for (const child of childItems) {
                    const isPreExistingItem = originalItemIds.has(child.id);
                    const dbParentId = localToDbItemId.get(child.parent_item_id!);
                    if (!dbParentId) continue; // safety: orphan child — skip

                    const payload = {
                        workout_template_id: workoutDbId,
                        item_type: child.item_type,
                        order_index: child.order_index,
                        parent_item_id: dbParentId,
                        exercise_id: child.exercise_id || null,
                        substitute_exercise_ids: child.substitute_exercise_ids ?? [],
                        sets: child.sets,
                        reps: child.reps,
                        rest_seconds: child.rest_seconds,
                        notes: child.notes,
                        exercise_function: child.exercise_function || null,
                        item_config: child.item_config ?? {},
                        method_key: null,
                        rounds: 1,
                    };

                    if (!isPreExistingItem) {
                        const { error: insertChildError } = await (supabase as any)
                            .from("workout_item_templates")
                            .insert(payload);
                        if (insertChildError) throw insertChildError;
                    } else {
                        const { error: updateChildError } = await (supabase as any)
                            .from("workout_item_templates")
                            .update(payload)
                            .eq("id", child.id);
                        if (updateChildError) throw updateChildError;
                    }
                }
            }

            toast.success("Modelo atualizado", "As alterações foram salvas.");
            return { ok: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao salvar modelo.";
            toast.error("Erro", message);
            return { ok: false, reason: "ERROR", message };
        } finally {
            store.setSaving(false);
        }
    }, [store]);

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
        updateStartDate: store.updateStartDate,
        addWorkout: store.addWorkout,
        removeWorkout: store.removeWorkout,
        renameWorkout: store.renameWorkout,
        updateWorkoutFrequency: store.updateWorkoutFrequency,
        setWorkoutType: store.setWorkoutType,
        setCurrentWorkout: store.setCurrentWorkout,
        addExercise: store.addExercise,
        swapExercise: store.swapExercise,
        updateItem: store.updateItem,
        removeItem: store.removeItem,
        duplicateItem: store.duplicateItem,
        reorderItems: store.reorderItems,
        reset: store.reset,
        saveAsTemplate,
        saveAndAssign,
        saveAsNewProgramDiscardingAi,
        saveAssignedProgramFull,
        saveTemplateFull,
        initFromAssignedProgram: store.initFromAssignedProgram,
        initFromTemplate: store.initFromTemplate,
    };
}

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';
import type {
    MethodKey,
    PrescriptionOutputSnapshot,
    WorkoutSet,
} from '@kinevo/shared/types/prescription';
import type { BuilderProgramData } from '@kinevo/shared/lib/prescription/builder-mapper';
import { collapseExpandedScheme } from '@kinevo/shared/lib/prescription/set-scheme';
import { extractFrequencyFromName } from '@kinevo/shared/lib/prescription/extract-frequency';

// ---------------------------------------------------------------------------
// Storage Adapter — MMKV with in-memory fallback for Expo Go
// ---------------------------------------------------------------------------

let storageBackend: StateStorage;

try {
    const { createMMKV } = require('react-native-mmkv');
    const mmkv = createMMKV({ id: 'kinevo-program-builder' });
    storageBackend = {
        getItem: (name: string) => mmkv.getString(name) ?? null,
        setItem: (name: string, value: string) => mmkv.set(name, value),
        removeItem: (name: string) => { mmkv.remove(name); },
    };
} catch {
    const memoryStore = new Map<string, string>();
    storageBackend = {
        getItem: (name: string) => memoryStore.get(name) ?? null,
        setItem: (name: string, value: string) => { memoryStore.set(name, value); },
        removeItem: (name: string) => { memoryStore.delete(name); },
    };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkoutItem {
    id: string;
    /**
     * - `'exercise'`: movement com séries/reps/carga.
     * - `'superset'`: parent virtual que agrupa filhos via `parent_item_id`.
     * - `'note'`: bloco de nota técnica. `notes` é o texto.
     * - `'warmup'`: bloco de aquecimento. Conteúdo em `item_config` (warmup_type, description).
     * - `'cardio'`: bloco de cardio. Conteúdo em `item_config` (mode, objective, target, notes).
     */
    item_type: 'exercise' | 'superset' | 'note' | 'warmup' | 'cardio';
    order_index: number;
    parent_item_id: string | null;
    exercise_id: string;
    exercise_name: string;
    exercise_equipment: string | null;
    exercise_muscle_groups: string[];
    sets: number;
    reps: string;
    rest_seconds: number;
    notes: string | null;
    exercise_function: string | null;
    item_config: Record<string, unknown>;
    substitute_exercise_ids: string[];
    /** Per-set prescription (Fase 3). Null = modo simples (3 agregados acima
     * são a fonte da verdade). Quando preenchido, agregados são derivados via
     * summarizeSetScheme antes de persistir. */
    set_scheme: WorkoutSet[] | null;
    /** Method/preset marker shown como chip no card. */
    method_key: MethodKey | null;
    /** Rodadas (Fase 4.3). 1 para métodos lineares (default). 2..20 para
     *  métodos compostos (drop-set, cluster). Quando > 1, `set_scheme`
     *  descreve UMA rodada e é materializado N vezes no save (`expandSchemeByRounds`). */
    rounds: number;
}

export interface Workout {
    id: string;
    name: string;
    order_index: number;
    frequency: string[];
    items: WorkoutItem[];
}

export interface ProgramDraft {
    name: string;
    description: string;
    duration_weeks: number | null;
    workouts: Workout[];
    studentId: string | null;
    /**
     * Set when the draft was hydrated from an AI generation. The save flow
     * uses this to decide whether to round-trip the snapshot back to
     * /api/programs/assign with isEdited=true (preserves audit linkage to
     * `prescription_generations`).
     */
    generationId: string | null;
    originatedFromAi: boolean;
    /**
     * Original snapshot from the AI, kept as a baseline so the save can
     * inject `reasoning` back when the trainer didn't change it (see
     * `buildSnapshotFromDraft`'s `preserveReasoning` option).
     */
    originalSnapshot: PrescriptionOutputSnapshot | null;
    /**
     * When set, the draft was hydrated from an existing `assigned_programs`
     * row and the save flow must UPDATE that program in place (not create a
     * new template). Workout/item ids in this mode are real DB ids when they
     * came from the load, or new uuids for additions.
     */
    editingAssignedProgramId: string | null;
    /**
     * Like `editingAssignedProgramId` but for editing a reusable
     * `program_templates` row. Mutually exclusive with the assigned id; the
     * save flow routes to `saveTemplateFull` when set. Optional so the many
     * create-flow draft literals don't all need to spell it out — reads treat
     * `undefined` as "not editing a template".
     */
    editingTemplateId?: string | null;
    /**
     * Snapshot of `assigned_workouts.id` values present at load time. Used
     * by the edit save flow to distinguish UPDATE (id ∈ snapshot) from
     * INSERT (id ∉ snapshot, i.e. a workout added after the load). Empty
     * outside of edit mode.
     */
    originalWorkoutIds: string[];
    /**
     * Snapshot of `assigned_workout_items.id` values present at load time.
     * Same UPDATE-vs-INSERT discrimination as `originalWorkoutIds`, but at
     * the item level. Empty outside of edit mode.
     */
    originalItemIds: string[];
}

/** Per-set row as returned by the assigned_workout_item_sets join. */
interface AssignedSetRow {
    set_number: number;
    set_type: string | null;
    reps: string | null;
    rest_seconds: number | null;
    weight_target_kg: number | null;
    weight_target_pct1rm: number | null;
    rir: number | null;
    tempo: string | null;
    notes: string | null;
    round_number: number | null;
}

/** Item row as returned by assigned_workout_items join. */
interface AssignedItemRow {
    id: string;
    item_type: string;
    order_index: number;
    parent_item_id: string | null;
    exercise_id: string | null;
    substitute_exercise_ids?: string[] | null;
    sets: number | null;
    reps: string | null;
    rest_seconds: number | null;
    notes: string | null;
    item_config?: Record<string, unknown> | null;
    method_key?: MethodKey | null;
    rounds?: number | null;
    assigned_workout_item_sets?: AssignedSetRow[] | null;
    /** Resolved exercise name (joined separately). */
    exercise_name?: string;
    exercise_equipment?: string | null;
    exercise_muscle_groups?: string[];
}

/** Workout row as returned by assigned_workouts join. */
interface AssignedWorkoutRow {
    id: string;
    name: string;
    order_index: number;
    scheduled_days?: number[] | null;
    assigned_workout_items?: AssignedItemRow[] | null;
}

/** Top-level assigned_programs row used to hydrate the builder for editing. */
export interface AssignedProgramHydrationData {
    id: string;
    name: string;
    description: string | null;
    duration_weeks: number | null;
    assigned_workouts: AssignedWorkoutRow[];
}

/** Item row as returned by the workout_item_templates join (template edit). */
interface TemplateItemRow {
    id: string;
    item_type: string;
    order_index: number;
    parent_item_id: string | null;
    exercise_id: string | null;
    substitute_exercise_ids?: string[] | null;
    sets: number | null;
    reps: string | null;
    rest_seconds: number | null;
    notes: string | null;
    item_config?: Record<string, unknown> | null;
    method_key?: MethodKey | null;
    rounds?: number | null;
    exercise_function?: string | null;
    /** Per-set rows are materialized in workout_item_set_templates. */
    workout_item_set_templates?: AssignedSetRow[] | null;
    /** Resolved exercise name/equipment (joined separately, like the assigned loader). */
    exercise_name?: string;
    exercise_equipment?: string | null;
    exercise_muscle_groups?: string[];
}

/** Workout row as returned by the workout_templates join. Note: templates store
 *  `frequency` as a string[] of day keys (not the int[] `scheduled_days` that
 *  assigned_workouts uses). */
interface TemplateWorkoutRow {
    id: string;
    name: string;
    order_index: number;
    frequency?: string[] | null;
    workout_item_templates?: TemplateItemRow[] | null;
}

/** Top-level program_templates row used to hydrate the builder for editing. */
export interface TemplateHydrationData {
    id: string;
    name: string;
    description: string | null;
    duration_weeks: number | null;
    workout_templates: TemplateWorkoutRow[];
}

/** Parsed exercise from text prescription AI */
export interface ParsedExerciseForBuilder {
    exercise_id: string;
    catalog_name: string;
    sets: number;
    reps: string;
    rest_seconds: number | null;
    notes: string | null;
    superset_group: string | null;
    /** Optional per-set scheme (Fase 5 will populate this; Fase 3 just propagates). */
    set_scheme?: WorkoutSet[] | null;
    /** Optional method marker (Fase 5 will populate). */
    method_key?: MethodKey | null;
    /** Optional round count for compound methods (Fase 5). Defaults to 1. */
    rounds?: number | null;
}

/** Parsed workout from text prescription AI */
export interface ParsedWorkoutForBuilder {
    name: string;
    exercises: ParsedExerciseForBuilder[];
}

interface ProgramBuilderState {
    draft: ProgramDraft;
    currentWorkoutId: string | null;
    isSaving: boolean;
    isDirty: boolean;

    // Init
    initNewProgram: (studentId?: string) => void;
    /** Initialize program builder pre-filled with AI-parsed workouts */
    initFromParsedText: (studentId: string, workouts: ParsedWorkoutForBuilder[]) => void;
    /**
     * Mescla treinos parseados (de "Texto para Treino") no draft atual.
     * Se o draft está vazio ou pertence a outro studentId, delega para
     * `initFromParsedText` (comportamento legado). Caso contrário, faz
     * append: cada workout parseado vira um novo workout no fim da lista,
     * preservando todos os existentes. Se o nome bater com um existente
     * (case-insensitive), os exercícios entram NO existente em vez de criar
     * duplicata.
     */
    addParsedWorkoutsToDraft: (
        studentId: string,
        parsedWorkouts: ParsedWorkoutForBuilder[],
    ) => void;
    /**
     * Initialize program builder pre-filled from an AI generation's BuilderProgramData
     * (the output of `mapAiOutputToBuilderData(snapshot)`). Sets `originatedFromAi=true`,
     * `generationId`, and stores the `originalSnapshot` for later reasoning preservation.
     */
    initFromAiSnapshot: (
        studentId: string,
        builderData: BuilderProgramData,
        generationId: string,
        originalSnapshot: PrescriptionOutputSnapshot,
    ) => void;
    /**
     * Hydrate the draft for editing an existing assigned_programs row. The
     * store carries DB ids in workout.id / item.id so the save flow can
     * UPDATE them in place. Per-set rows are collapsed via
     * `collapseExpandedScheme` to reconstruct the per-round scheme.
     */
    initFromAssignedProgram: (
        studentId: string,
        program: AssignedProgramHydrationData,
    ) => void;
    /**
     * Hydrate the draft for editing an existing `program_templates` row. Like
     * `initFromAssignedProgram` but no student is involved and the save flow
     * routes to `saveTemplateFull` (which writes the `*_templates` tables).
     */
    initFromTemplate: (program: TemplateHydrationData) => void;

    // Program metadata
    updateName: (name: string) => void;
    updateDescription: (desc: string) => void;
    updateDurationWeeks: (weeks: number | null) => void;

    // Workouts
    addWorkout: () => void;
    removeWorkout: (workoutId: string) => void;
    renameWorkout: (workoutId: string, name: string) => void;
    updateWorkoutFrequency: (workoutId: string, days: string[]) => void;
    setCurrentWorkout: (workoutId: string) => void;

    // Items
    addExercise: (workoutId: string, exercise: {
        id: string;
        name: string;
        equipment: string | null;
        muscle_groups: { id: string; name: string }[];
    }) => void;
    /** Substitui o exercício de um item mantendo prescrição (sets/reps/rest/scheme).
     *  Atualiza só exercise_id, exercise_name, exercise_equipment e
     *  exercise_muscle_groups. Usado pelo "Trocar exercício" no card. */
    swapExercise: (workoutId: string, itemId: string, exercise: {
        id: string;
        name: string;
        equipment: string | null;
        muscle_groups: { id: string; name: string }[];
    }) => void;
    updateItem: (workoutId: string, itemId: string, updates: Partial<Pick<WorkoutItem, 'sets' | 'reps' | 'rest_seconds' | 'notes' | 'set_scheme' | 'method_key' | 'rounds' | 'item_config'>>) => void;
    /** Replace per-set scheme + method + rounds on an item. Used by SetSchemeEditor.
     *  `rounds` defaults to 1 when omitted (linear method). */
    setSetScheme: (workoutId: string, itemId: string, scheme: WorkoutSet[] | null, methodKey: MethodKey | null, rounds?: number) => void;
    /** Cria item de nota técnica no final do workout. Trainer edita via EditNoteSheet. */
    addNote: (workoutId: string, initialText?: string) => void;
    /** Cria item de aquecimento no final do workout. Default: warmup_type 'free'. */
    addWarmup: (workoutId: string, initialDescription?: string) => void;
    /** Cria item de cardio no final do workout. Default: mode 'continuous', objective 'time'. */
    addCardio: (workoutId: string, initialNotes?: string) => void;
    removeItem: (workoutId: string, itemId: string) => void;
    /** Duplica um item dentro do mesmo treino, inserindo logo após o original.
     *  Reaplica order_index sequencial. Mantém set_scheme/method/rounds. */
    duplicateItem: (workoutId: string, itemId: string) => void;
    reorderItems: (workoutId: string, newItems: WorkoutItem[]) => void;
    /** Desfaz todos os supersets do programa (zera superset_group de todos os itens).
     *  Usado quando o snapshot de IA não suporta supersets adicionados manualmente. */
    clearSupersets: () => void;

    // Persistence
    setSaving: (saving: boolean) => void;
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKOUT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function nextWorkoutName(workouts: Workout[]): string {
    const usedNames = new Set(workouts.map(w => w.name));
    for (const letter of WORKOUT_LETTERS) {
        const name = `Treino ${letter}`;
        if (!usedNames.has(name)) return name;
    }
    return `Treino ${workouts.length + 1}`;
}

function createEmptyDraft(studentId?: string): ProgramDraft {
    const workoutId = Crypto.randomUUID();
    return {
        name: '',
        description: '',
        duration_weeks: null,
        studentId: studentId ?? null,
        workouts: [{
            id: workoutId,
            name: 'Treino A',
            order_index: 0,
            frequency: [],
            items: [],
        }],
        generationId: null,
        originatedFromAi: false,
        originalSnapshot: null,
        editingAssignedProgramId: null,
        editingTemplateId: null,
        originalWorkoutIds: [],
        originalItemIds: [],
    };
}

/** Maps a number-coded scheduled day (0=sun..6=sat) to the string key used
 *  by the builder store and DaySelector. */
const DAY_NUM_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function scheduledDaysToFrequency(days: number[] | null | undefined): string[] {
    if (!Array.isArray(days)) return [];
    const out: string[] = [];
    for (const d of days) {
        const key = DAY_NUM_TO_KEY[d];
        if (key) out.push(key);
    }
    return out;
}

function workoutsFromAssignedProgram(rows: AssignedWorkoutRow[]): Workout[] {
    const sortedWorkouts = [...rows].sort((a, b) => a.order_index - b.order_index);
    return sortedWorkouts.map((w) => {
        const itemsRaw = [...(w.assigned_workout_items ?? [])].sort(
            (a, b) => a.order_index - b.order_index,
        );
        const items: WorkoutItem[] = itemsRaw.map((it) => {
            const setRows = it.assigned_workout_item_sets ?? [];
            const collapsed = setRows.length > 0
                ? collapseExpandedScheme(
                    [...setRows].sort((a, b) => a.set_number - b.set_number) as unknown as WorkoutSet[],
                    it.rounds ?? 1,
                )
                : { scheme: [] as WorkoutSet[], rounds: 1 };
            const finalScheme = collapsed.scheme.length > 0 ? collapsed.scheme : null;
            const rawType = it.item_type;
            const normalizedType: WorkoutItem['item_type'] =
                rawType === 'superset' || rawType === 'note' || rawType === 'warmup' || rawType === 'cardio'
                    ? rawType
                    : 'exercise';
            return {
                id: it.id,
                item_type: normalizedType,
                order_index: it.order_index,
                parent_item_id: it.parent_item_id,
                exercise_id: it.exercise_id ?? '',
                exercise_name: it.exercise_name ?? '',
                exercise_equipment: it.exercise_equipment ?? null,
                exercise_muscle_groups: it.exercise_muscle_groups ?? [],
                sets: it.sets ?? 3,
                reps: it.reps ?? '10',
                rest_seconds: it.rest_seconds ?? 60,
                notes: it.notes ?? null,
                exercise_function: null,
                item_config: (it.item_config as Record<string, unknown>) ?? {},
                substitute_exercise_ids: it.substitute_exercise_ids ?? [],
                set_scheme: finalScheme,
                method_key: it.method_key ?? null,
                rounds: typeof it.rounds === 'number' && it.rounds >= 1 ? it.rounds : 1,
            };
        });
        return {
            id: w.id,
            name: w.name,
            order_index: w.order_index,
            frequency: scheduledDaysToFrequency(w.scheduled_days),
            items,
        };
    });
}

/** Mirror of `workoutsFromAssignedProgram` for the template tables. Reads
 *  `frequency` directly (already a string[]) instead of converting from
 *  `scheduled_days`, and pulls per-set rows from `workout_item_set_templates`. */
function workoutsFromTemplate(rows: TemplateWorkoutRow[]): Workout[] {
    const sortedWorkouts = [...rows].sort((a, b) => a.order_index - b.order_index);
    return sortedWorkouts.map((w) => {
        const itemsRaw = [...(w.workout_item_templates ?? [])].sort(
            (a, b) => a.order_index - b.order_index,
        );
        const items: WorkoutItem[] = itemsRaw.map((it) => {
            const setRows = it.workout_item_set_templates ?? [];
            const collapsed = setRows.length > 0
                ? collapseExpandedScheme(
                    [...setRows].sort((a, b) => a.set_number - b.set_number) as unknown as WorkoutSet[],
                    it.rounds ?? 1,
                )
                : { scheme: [] as WorkoutSet[], rounds: 1 };
            const finalScheme = collapsed.scheme.length > 0 ? collapsed.scheme : null;
            const rawType = it.item_type;
            const normalizedType: WorkoutItem['item_type'] =
                rawType === 'superset' || rawType === 'note' || rawType === 'warmup' || rawType === 'cardio'
                    ? rawType
                    : 'exercise';
            return {
                id: it.id,
                item_type: normalizedType,
                order_index: it.order_index,
                parent_item_id: it.parent_item_id,
                exercise_id: it.exercise_id ?? '',
                exercise_name: it.exercise_name ?? '',
                exercise_equipment: it.exercise_equipment ?? null,
                exercise_muscle_groups: it.exercise_muscle_groups ?? [],
                sets: it.sets ?? 3,
                reps: it.reps ?? '10',
                rest_seconds: it.rest_seconds ?? 60,
                notes: it.notes ?? null,
                exercise_function: it.exercise_function ?? null,
                item_config: (it.item_config as Record<string, unknown>) ?? {},
                substitute_exercise_ids: it.substitute_exercise_ids ?? [],
                set_scheme: finalScheme,
                method_key: it.method_key ?? null,
                rounds: typeof it.rounds === 'number' && it.rounds >= 1 ? it.rounds : 1,
            };
        });
        return {
            id: w.id,
            name: w.name,
            order_index: w.order_index,
            frequency: Array.isArray(w.frequency) ? w.frequency : [],
            items,
        };
    });
}

/**
 * Convert a BuilderProgramData (output of mapAiOutputToBuilderData) into the
 * mobile store's flat `Workout[]` shape. Preserves order_index, sets, reps,
 * rest_seconds, notes; the AI snapshot is flat (no supersets), so every item
 * is `item_type: 'exercise'` with `parent_item_id: null`.
 */
function workoutsFromBuilderData(builderData: BuilderProgramData): Workout[] {
    const templates = builderData.workout_templates ?? [];
    return templates.map((wt) => ({
        id: Crypto.randomUUID(),
        name: wt.name,
        order_index: wt.order_index,
        frequency: wt.frequency ?? [],
        items: (wt.workout_item_templates ?? []).map((it) => ({
            id: Crypto.randomUUID(),
            item_type: 'exercise' as const,
            order_index: it.order_index,
            parent_item_id: null,
            exercise_id: it.exercise_id ?? '',
            exercise_name: '',
            exercise_equipment: null,
            exercise_muscle_groups: [],
            sets: it.sets ?? 3,
            reps: it.reps ?? '10',
            rest_seconds: it.rest_seconds ?? 60,
            notes: it.notes,
            exercise_function: it.exercise_function ?? null,
            item_config: it.item_config ?? {},
            substitute_exercise_ids: it.substitute_exercise_ids ?? [],
            set_scheme: null,
            method_key: null,
            rounds: 1,
        })),
    }));
}

/**
 * Convert a parsed workout's exercises into builder WorkoutItems, ordering from
 * `startOrderIndex`. Mirrors the logic used by `initFromParsedText` (supersets
 * supported, advanced methods preserved on regular exercises only).
 */
function itemsFromParsedExercises(
    exercises: ParsedExerciseForBuilder[],
    startOrderIndex: number,
): WorkoutItem[] {
    const items: WorkoutItem[] = [];
    let orderIndex = startOrderIndex;
    const processedGroups = new Set<string>();

    for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei];
        if (!ex.superset_group) {
            items.push({
                id: Crypto.randomUUID(),
                item_type: 'exercise',
                order_index: orderIndex++,
                parent_item_id: null,
                exercise_id: ex.exercise_id,
                exercise_name: ex.catalog_name,
                exercise_equipment: null,
                exercise_muscle_groups: [],
                sets: ex.sets,
                reps: ex.reps,
                rest_seconds: ex.rest_seconds ?? 60,
                notes: ex.notes ?? null,
                exercise_function: null,
                item_config: {},
                substitute_exercise_ids: [],
                set_scheme: ex.set_scheme ?? null,
                method_key: ex.method_key ?? null,
                rounds: ex.rounds ?? 1,
            });
        } else if (!processedGroups.has(ex.superset_group)) {
            processedGroups.add(ex.superset_group);
            const groupId = ex.superset_group;
            const groupExercises = exercises.filter((e) => e.superset_group === groupId);
            const supersetId = Crypto.randomUUID();
            const restBetweenRounds = groupExercises[0]?.rest_seconds ?? 60;

            items.push({
                id: supersetId,
                item_type: 'superset',
                order_index: orderIndex++,
                parent_item_id: null,
                exercise_id: '',
                exercise_name: `Superset (${groupExercises.length})`,
                exercise_equipment: null,
                exercise_muscle_groups: [],
                sets: groupExercises[0]?.sets ?? 3,
                reps: '',
                rest_seconds: restBetweenRounds,
                notes: null,
                exercise_function: null,
                item_config: {},
                substitute_exercise_ids: [],
                set_scheme: null,
                method_key: null,
                rounds: 1,
            });

            groupExercises.forEach((gex, childIdx) => {
                items.push({
                    id: Crypto.randomUUID(),
                    item_type: 'exercise',
                    order_index: childIdx,
                    parent_item_id: supersetId,
                    exercise_id: gex.exercise_id,
                    exercise_name: gex.catalog_name,
                    exercise_equipment: null,
                    exercise_muscle_groups: [],
                    sets: gex.sets,
                    reps: gex.reps,
                    rest_seconds: 0,
                    notes: gex.notes ?? null,
                    exercise_function: null,
                    item_config: {},
                    substitute_exercise_ids: [],
                    set_scheme: null,
                    method_key: null,
                    rounds: 1,
                });
            });
        }
    }
    return items;
}

function normalizeWorkoutName(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProgramBuilderStore = create<ProgramBuilderState>()(
    persist(
        (set) => ({
            draft: createEmptyDraft(),
            currentWorkoutId: null,
            isSaving: false,
            isDirty: false,

            initNewProgram: (studentId?: string) => {
                const draft = createEmptyDraft(studentId);
                set({
                    draft,
                    currentWorkoutId: draft.workouts[0].id,
                    isDirty: false,
                    isSaving: false,
                });
            },

            initFromParsedText: (studentId: string, parsedWorkouts: ParsedWorkoutForBuilder[]) => {
                const workouts: Workout[] = parsedWorkouts.map((pw, wi) => {
                    const workoutId = Crypto.randomUUID();
                    const items: WorkoutItem[] = [];
                    let orderIndex = 0;

                    // Group exercises by superset_group
                    // Process in order, creating superset parents when we encounter grouped exercises
                    const processedGroups = new Set<string>();

                    for (let ei = 0; ei < pw.exercises.length; ei++) {
                        const ex = pw.exercises[ei];

                        if (!ex.superset_group) {
                            // Regular exercise (no superset). Fase 5 propagates set_scheme/method_key from the parser.
                            items.push({
                                id: Crypto.randomUUID(),
                                item_type: 'exercise',
                                order_index: orderIndex++,
                                parent_item_id: null,
                                exercise_id: ex.exercise_id,
                                exercise_name: ex.catalog_name,
                                exercise_equipment: null,
                                exercise_muscle_groups: [],
                                sets: ex.sets,
                                reps: ex.reps,
                                rest_seconds: ex.rest_seconds ?? 60,
                                notes: ex.notes ?? null,
                                exercise_function: null,
                                item_config: {},
                                substitute_exercise_ids: [],
                                set_scheme: ex.set_scheme ?? null,
                                method_key: ex.method_key ?? null,
                                rounds: ex.rounds ?? 1,
                            });
                        } else if (!processedGroups.has(ex.superset_group)) {
                            // First exercise of a superset group — create parent + all children
                            processedGroups.add(ex.superset_group);
                            const groupId = ex.superset_group;

                            // Collect all exercises in this superset group
                            const groupExercises = pw.exercises.filter(
                                (e) => e.superset_group === groupId
                            );

                            // Create superset parent item
                            const supersetId = Crypto.randomUUID();
                            // Use rest_seconds from first exercise as rest between rounds
                            const restBetweenRounds = groupExercises[0]?.rest_seconds ?? 60;

                            items.push({
                                id: supersetId,
                                item_type: 'superset',
                                order_index: orderIndex++,
                                parent_item_id: null,
                                exercise_id: '',
                                exercise_name: `Superset (${groupExercises.length})`,
                                exercise_equipment: null,
                                exercise_muscle_groups: [],
                                sets: groupExercises[0]?.sets ?? 3,
                                reps: '',
                                rest_seconds: restBetweenRounds,
                                notes: null,
                                exercise_function: null,
                                item_config: {},
                                substitute_exercise_ids: [],
                                set_scheme: null,
                                method_key: null,
                                rounds: 1,
                            });

                            // Create child exercise items
                            groupExercises.forEach((gex, childIdx) => {
                                items.push({
                                    id: Crypto.randomUUID(),
                                    item_type: 'exercise',
                                    order_index: childIdx,
                                    parent_item_id: supersetId,
                                    exercise_id: gex.exercise_id,
                                    exercise_name: gex.catalog_name,
                                    exercise_equipment: null,
                                    exercise_muscle_groups: [],
                                    sets: gex.sets,
                                    reps: gex.reps,
                                    rest_seconds: 0, // No rest between exercises within superset
                                    notes: gex.notes ?? null,
                                    exercise_function: null,
                                    item_config: {},
                                    substitute_exercise_ids: [],
                                    // Modo avançado bloqueado em superset (V1).
                                    set_scheme: null,
                                    method_key: null,
                                    rounds: 1,
                                });
                            });
                        }
                        // else: exercise belongs to a group already processed — skip
                    }

                    return {
                        id: workoutId,
                        name: pw.name,
                        order_index: wi,
                        frequency: [],
                        items,
                    };
                });

                // Ensure at least one workout
                if (workouts.length === 0) {
                    workouts.push({
                        id: Crypto.randomUUID(),
                        name: 'Treino A',
                        order_index: 0,
                        frequency: [],
                        items: [],
                    });
                }

                const draft: ProgramDraft = {
                    name: '',
                    description: '',
                    duration_weeks: null,
                    studentId,
                    workouts,
                    generationId: null,
                    originatedFromAi: false,
                    originalSnapshot: null,
                    editingAssignedProgramId: null,
                    originalWorkoutIds: [],
                    originalItemIds: [],
                };

                set({
                    draft,
                    currentWorkoutId: workouts[0].id,
                    isDirty: true,
                    isSaving: false,
                });
            },

            addParsedWorkoutsToDraft: (studentId: string, parsedWorkouts: ParsedWorkoutForBuilder[]) => {
                set((state) => {
                    const draftEmpty = state.draft.workouts.every(w => w.items.length === 0);
                    const studentMismatch = state.draft.studentId !== studentId;

                    if (studentMismatch || draftEmpty) {
                        // Delegate to legacy behavior (build from scratch).
                        const workouts: Workout[] = parsedWorkouts.map((pw, wi) => {
                            const { name: cleanName, frequency: inferredDays } = extractFrequencyFromName(pw.name);
                            return {
                                id: Crypto.randomUUID(),
                                name: cleanName,
                                order_index: wi,
                                frequency: inferredDays,
                                items: itemsFromParsedExercises(pw.exercises, 0),
                            };
                        });
                        if (workouts.length === 0) {
                            workouts.push({
                                id: Crypto.randomUUID(),
                                name: 'Treino A',
                                order_index: 0,
                                frequency: [],
                                items: [],
                            });
                        }
                        const draft: ProgramDraft = {
                            name: '',
                            description: '',
                            duration_weeks: null,
                            studentId,
                            workouts,
                            generationId: null,
                            originatedFromAi: false,
                            originalSnapshot: null,
                            editingAssignedProgramId: null,
                            originalWorkoutIds: [],
                            originalItemIds: [],
                        };
                        return {
                            draft,
                            currentWorkoutId: workouts[0].id,
                            isDirty: true,
                            isSaving: false,
                        };
                    }

                    // Merge: append new exercises into matching named workouts,
                    // create new workouts for unmatched names.
                    const workouts = state.draft.workouts.map(w => ({ ...w, items: [...w.items] }));
                    let firstAffectedId: string | null = null;

                    for (const pw of parsedWorkouts) {
                        const { name: cleanName, frequency: inferredDays } = extractFrequencyFromName(pw.name);
                        const targetName = normalizeWorkoutName(cleanName);
                        const existing = workouts.find(w => normalizeWorkoutName(w.name) === targetName);
                        if (existing) {
                            const newItems = itemsFromParsedExercises(pw.exercises, existing.items.length);
                            existing.items.push(...newItems);
                            // Só popula frequency se o workout existente ainda não tem dias
                            // configurados — preserva escolhas manuais do trainer.
                            if (existing.frequency.length === 0 && inferredDays.length > 0) {
                                existing.frequency = inferredDays;
                            }
                            if (!firstAffectedId) firstAffectedId = existing.id;
                        } else {
                            const newWorkout: Workout = {
                                id: Crypto.randomUUID(),
                                name: cleanName,
                                order_index: workouts.length,
                                frequency: inferredDays,
                                items: itemsFromParsedExercises(pw.exercises, 0),
                            };
                            workouts.push(newWorkout);
                            if (!firstAffectedId) firstAffectedId = newWorkout.id;
                        }
                    }

                    return {
                        draft: { ...state.draft, workouts },
                        currentWorkoutId: firstAffectedId ?? state.currentWorkoutId,
                        isDirty: true,
                    };
                });
            },

            initFromAssignedProgram: (studentId, program) => {
                let workouts = workoutsFromAssignedProgram(program.assigned_workouts ?? []);
                if (workouts.length === 0) {
                    workouts = [{
                        id: Crypto.randomUUID(),
                        name: 'Treino A',
                        order_index: 0,
                        frequency: [],
                        items: [],
                    }];
                }
                const originalWorkoutIds: string[] = [];
                const originalItemIds: string[] = [];
                for (const w of program.assigned_workouts ?? []) {
                    originalWorkoutIds.push(w.id);
                    for (const it of w.assigned_workout_items ?? []) {
                        originalItemIds.push(it.id);
                    }
                }
                const draft: ProgramDraft = {
                    name: program.name ?? '',
                    description: program.description ?? '',
                    duration_weeks: program.duration_weeks ?? null,
                    studentId,
                    workouts,
                    generationId: null,
                    originatedFromAi: false,
                    originalSnapshot: null,
                    editingAssignedProgramId: program.id,
                    editingTemplateId: null,
                    originalWorkoutIds,
                    originalItemIds,
                };
                set({
                    draft,
                    currentWorkoutId: workouts[0].id,
                    isDirty: false,
                    isSaving: false,
                });
            },

            initFromTemplate: (program) => {
                let workouts = workoutsFromTemplate(program.workout_templates ?? []);
                if (workouts.length === 0) {
                    workouts = [{
                        id: Crypto.randomUUID(),
                        name: 'Treino A',
                        order_index: 0,
                        frequency: [],
                        items: [],
                    }];
                }
                const originalWorkoutIds: string[] = [];
                const originalItemIds: string[] = [];
                for (const w of program.workout_templates ?? []) {
                    originalWorkoutIds.push(w.id);
                    for (const it of w.workout_item_templates ?? []) {
                        originalItemIds.push(it.id);
                    }
                }
                const draft: ProgramDraft = {
                    name: program.name ?? '',
                    description: program.description ?? '',
                    duration_weeks: program.duration_weeks ?? null,
                    studentId: null,
                    workouts,
                    generationId: null,
                    originatedFromAi: false,
                    originalSnapshot: null,
                    editingAssignedProgramId: null,
                    editingTemplateId: program.id,
                    originalWorkoutIds,
                    originalItemIds,
                };
                set({
                    draft,
                    currentWorkoutId: workouts[0].id,
                    isDirty: false,
                    isSaving: false,
                });
            },

            initFromAiSnapshot: (studentId, builderData, generationId, originalSnapshot) => {
                let workouts = workoutsFromBuilderData(builderData);
                if (workouts.length === 0) {
                    workouts = [{
                        id: Crypto.randomUUID(),
                        name: 'Treino A',
                        order_index: 0,
                        frequency: [],
                        items: [],
                    }];
                }
                const draft: ProgramDraft = {
                    name: builderData.name || '',
                    description: builderData.description ?? '',
                    duration_weeks: builderData.duration_weeks ?? null,
                    studentId,
                    workouts,
                    generationId,
                    originatedFromAi: true,
                    originalSnapshot,
                    editingAssignedProgramId: null,
                    originalWorkoutIds: [],
                    originalItemIds: [],
                };
                set({
                    draft,
                    currentWorkoutId: workouts[0].id,
                    isDirty: true,
                    isSaving: false,
                });
            },

            updateName: (name) => set((state) => ({
                draft: { ...state.draft, name },
                isDirty: true,
            })),

            updateDescription: (description) => set((state) => ({
                draft: { ...state.draft, description },
                isDirty: true,
            })),

            updateDurationWeeks: (duration_weeks) => set((state) => ({
                draft: { ...state.draft, duration_weeks },
                isDirty: true,
            })),

            addWorkout: () => set((state) => {
                const newWorkout: Workout = {
                    id: Crypto.randomUUID(),
                    name: nextWorkoutName(state.draft.workouts),
                    order_index: state.draft.workouts.length,
                    frequency: [],
                    items: [],
                };
                return {
                    draft: {
                        ...state.draft,
                        workouts: [...state.draft.workouts, newWorkout],
                    },
                    currentWorkoutId: newWorkout.id,
                    isDirty: true,
                };
            }),

            removeWorkout: (workoutId) => set((state) => {
                const workouts = state.draft.workouts
                    .filter(w => w.id !== workoutId)
                    .map((w, i) => ({ ...w, order_index: i }));
                const currentId = state.currentWorkoutId === workoutId
                    ? (workouts[0]?.id ?? null)
                    : state.currentWorkoutId;
                return {
                    draft: { ...state.draft, workouts },
                    currentWorkoutId: currentId,
                    isDirty: true,
                };
            }),

            renameWorkout: (workoutId, name) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId ? { ...w, name } : w
                    ),
                },
                isDirty: true,
            })),

            updateWorkoutFrequency: (workoutId, days) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId ? { ...w, frequency: days } : w
                    ),
                },
                isDirty: true,
            })),

            setCurrentWorkout: (workoutId) => set({ currentWorkoutId: workoutId }),

            addExercise: (workoutId, exercise) => set((state) => {
                const workout = state.draft.workouts.find(w => w.id === workoutId);
                if (!workout) return state;

                const newItem: WorkoutItem = {
                    id: Crypto.randomUUID(),
                    item_type: 'exercise',
                    order_index: workout.items.length,
                    parent_item_id: null,
                    exercise_id: exercise.id,
                    exercise_name: exercise.name,
                    exercise_equipment: exercise.equipment,
                    exercise_muscle_groups: exercise.muscle_groups.map(mg => mg.name),
                    sets: 3,
                    reps: '10',
                    rest_seconds: 60,
                    notes: null,
                    exercise_function: null,
                    item_config: {},
                    substitute_exercise_ids: [],
                    set_scheme: null,
                    method_key: null,
                    rounds: 1,
                };

                return {
                    draft: {
                        ...state.draft,
                        workouts: state.draft.workouts.map(w =>
                            w.id === workoutId
                                ? { ...w, items: [...w.items, newItem] }
                                : w
                        ),
                    },
                    isDirty: true,
                };
            }),

            swapExercise: (workoutId, itemId, exercise) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? {
                                ...w,
                                items: w.items.map(item =>
                                    item.id === itemId
                                        ? {
                                            ...item,
                                            exercise_id: exercise.id,
                                            exercise_name: exercise.name,
                                            exercise_equipment: exercise.equipment,
                                            exercise_muscle_groups: exercise.muscle_groups.map(mg => mg.name),
                                        }
                                        : item
                                ),
                            }
                            : w
                    ),
                },
                isDirty: true,
            })),

            addNote: (workoutId, initialText) => set((state) => {
                const workout = state.draft.workouts.find(w => w.id === workoutId);
                if (!workout) return state;
                const newItem: WorkoutItem = {
                    id: Crypto.randomUUID(),
                    item_type: 'note',
                    order_index: workout.items.length,
                    parent_item_id: null,
                    exercise_id: '',
                    exercise_name: '',
                    exercise_equipment: null,
                    exercise_muscle_groups: [],
                    sets: 0,
                    reps: '',
                    rest_seconds: 0,
                    notes: initialText ?? 'Nova anotação',
                    exercise_function: null,
                    item_config: {},
                    substitute_exercise_ids: [],
                    set_scheme: null,
                    method_key: null,
                    rounds: 1,
                };
                return {
                    draft: {
                        ...state.draft,
                        workouts: state.draft.workouts.map(w =>
                            w.id === workoutId
                                ? { ...w, items: [...w.items, newItem] }
                                : w
                        ),
                    },
                    isDirty: true,
                };
            }),

            addWarmup: (workoutId, initialDescription) => set((state) => {
                const workout = state.draft.workouts.find(w => w.id === workoutId);
                if (!workout) return state;
                const newItem: WorkoutItem = {
                    id: Crypto.randomUUID(),
                    item_type: 'warmup',
                    order_index: workout.items.length,
                    parent_item_id: null,
                    exercise_id: '',
                    exercise_name: '',
                    exercise_equipment: null,
                    exercise_muscle_groups: [],
                    sets: 0,
                    reps: '',
                    rest_seconds: 0,
                    notes: null,
                    exercise_function: null,
                    item_config: {
                        warmup_type: 'free',
                        ...(initialDescription ? { description: initialDescription } : {}),
                    },
                    substitute_exercise_ids: [],
                    set_scheme: null,
                    method_key: null,
                    rounds: 1,
                };
                return {
                    draft: {
                        ...state.draft,
                        workouts: state.draft.workouts.map(w =>
                            w.id === workoutId
                                ? { ...w, items: [...w.items, newItem] }
                                : w
                        ),
                    },
                    isDirty: true,
                };
            }),

            addCardio: (workoutId, initialNotes) => set((state) => {
                const workout = state.draft.workouts.find(w => w.id === workoutId);
                if (!workout) return state;
                const newItem: WorkoutItem = {
                    id: Crypto.randomUUID(),
                    item_type: 'cardio',
                    order_index: workout.items.length,
                    parent_item_id: null,
                    exercise_id: '',
                    exercise_name: '',
                    exercise_equipment: null,
                    exercise_muscle_groups: [],
                    sets: 0,
                    reps: '',
                    rest_seconds: 0,
                    notes: null,
                    exercise_function: null,
                    item_config: {
                        mode: 'continuous',
                        objective: 'time',
                        ...(initialNotes ? { notes: initialNotes } : {}),
                    },
                    substitute_exercise_ids: [],
                    set_scheme: null,
                    method_key: null,
                    rounds: 1,
                };
                return {
                    draft: {
                        ...state.draft,
                        workouts: state.draft.workouts.map(w =>
                            w.id === workoutId
                                ? { ...w, items: [...w.items, newItem] }
                                : w
                        ),
                    },
                    isDirty: true,
                };
            }),

            updateItem: (workoutId, itemId, updates) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? {
                                ...w,
                                items: w.items.map(item =>
                                    item.id === itemId ? { ...item, ...updates } : item
                                ),
                            }
                            : w
                    ),
                },
                isDirty: true,
            })),

            setSetScheme: (workoutId, itemId, scheme, methodKey, rounds) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? {
                                ...w,
                                items: w.items.map(item =>
                                    item.id === itemId
                                        ? { ...item, set_scheme: scheme, method_key: methodKey, rounds: rounds ?? 1 }
                                        : item
                                ),
                            }
                            : w
                    ),
                },
                isDirty: true,
            })),

            removeItem: (workoutId, itemId) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? {
                                ...w,
                                items: w.items
                                    .filter(item => item.id !== itemId)
                                    .map((item, i) => ({ ...item, order_index: i })),
                            }
                            : w
                    ),
                },
                isDirty: true,
            })),

            clearSupersets: () => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w => {
                        // Descanso de cada superset pai, para os filhos herdarem ao virar standalone.
                        const parentRest = new Map<string, number>();
                        w.items.forEach(it => {
                            if (it.item_type === 'superset') parentRest.set(it.id, it.rest_seconds);
                        });
                        const flattened = w.items
                            .filter(it => it.item_type !== 'superset')
                            .map(it => {
                                if (!it.parent_item_id) return it;
                                const inheritedRest = it.rest_seconds > 0
                                    ? it.rest_seconds
                                    : (parentRest.get(it.parent_item_id) ?? 60);
                                return { ...it, parent_item_id: null, rest_seconds: inheritedRest };
                            })
                            .map((it, i) => ({ ...it, order_index: i }));
                        return { ...w, items: flattened };
                    }),
                },
                isDirty: true,
            })),

            duplicateItem: (workoutId, itemId) => set((state) => {
                const workout = state.draft.workouts.find(w => w.id === workoutId);
                if (!workout) return state;
                const sourceIdx = workout.items.findIndex(it => it.id === itemId);
                if (sourceIdx === -1) return state;
                const source = workout.items[sourceIdx];
                const clone: WorkoutItem = {
                    ...source,
                    id: Crypto.randomUUID(),
                    parent_item_id: null,
                    set_scheme: source.set_scheme ? source.set_scheme.map(s => ({ ...s })) : null,
                    substitute_exercise_ids: [...source.substitute_exercise_ids],
                };
                const inserted = [
                    ...workout.items.slice(0, sourceIdx + 1),
                    clone,
                    ...workout.items.slice(sourceIdx + 1),
                ].map((it, i) => ({ ...it, order_index: i }));
                return {
                    draft: {
                        ...state.draft,
                        workouts: state.draft.workouts.map(w =>
                            w.id === workoutId ? { ...w, items: inserted } : w
                        ),
                    },
                    isDirty: true,
                };
            }),

            reorderItems: (workoutId, newItems) => set((state) => ({
                draft: {
                    ...state.draft,
                    workouts: state.draft.workouts.map(w =>
                        w.id === workoutId
                            ? { ...w, items: newItems.map((item, i) => ({ ...item, order_index: i })) }
                            : w
                    ),
                },
                isDirty: true,
            })),

            setSaving: (isSaving) => set({ isSaving }),

            reset: () => set({
                draft: createEmptyDraft(),
                currentWorkoutId: null,
                isDirty: false,
                isSaving: false,
            }),
        }),
        {
            name: 'kinevo-program-builder',
            storage: createJSONStorage(() => storageBackend),
            // Backward compat: drafts persisted before earlier mobile updates
            // lack `generationId` / `originatedFromAi` / `originalSnapshot`,
            // and drafts pre per-set lack `set_scheme` / `method_key` per item.
            // Default everything on rehydrate so the typed reads don't crash.
            merge: (persisted, current) => {
                const next = { ...current, ...(persisted as Partial<ProgramBuilderState>) };
                if (next.draft) {
                    const d = next.draft as Partial<ProgramDraft> & ProgramDraft;
                    if (d.generationId === undefined) d.generationId = null;
                    if (d.originatedFromAi === undefined) d.originatedFromAi = false;
                    if (d.originalSnapshot === undefined) d.originalSnapshot = null;
                    if (d.editingAssignedProgramId === undefined) d.editingAssignedProgramId = null;
                    if (!Array.isArray(d.originalWorkoutIds)) d.originalWorkoutIds = [];
                    if (!Array.isArray(d.originalItemIds)) d.originalItemIds = [];
                    if (Array.isArray(d.workouts)) {
                        d.workouts = d.workouts.map((w) => ({
                            ...w,
                            items: Array.isArray(w.items)
                                ? w.items.map((it) => ({
                                    ...it,
                                    set_scheme: (it as Partial<WorkoutItem>).set_scheme ?? null,
                                    method_key: (it as Partial<WorkoutItem>).method_key ?? null,
                                    rounds: typeof (it as Partial<WorkoutItem>).rounds === 'number' && (it as WorkoutItem).rounds >= 1
                                        ? (it as WorkoutItem).rounds
                                        : 1,
                                }))
                                : [],
                        }));
                    }
                    next.draft = d;
                }
                return next;
            },
        }
    )
);

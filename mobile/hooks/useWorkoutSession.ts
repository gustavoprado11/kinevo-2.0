import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection';
import type { MethodKey, WorkoutSet } from '@kinevo/shared/types/prescription';
import { sortExerciseItems } from '../utils/sortExerciseItems';
import { hydrateSetPrescriptions, type SetPrescription } from '../lib/hydrateWorkoutSets';
import { formatWeightKg } from '@kinevo/shared/lib/prescription/set-scheme';
import { saveWorkoutState, loadWorkoutState, clearWorkoutState } from '../lib/workoutStatePersistence';
import { enqueueSetLogUpsert, enqueueSetLogDelete, clearPendingSetLogsForSession } from '../lib/pendingSetLogQueue';

export interface WorkoutSetData {
    weight: string;
    reps: string;
    completed: boolean;
}

/**
 * Detecta se a prescrição por set é heterogênea (trainer prescreveu targets
 * diferentes entre sets — ex: pirâmide 40×12 / 60×10 / 70×8). Quando true,
 * o waterfall de autopreenchimento em `handleSetChange` é desligado pra que
 * cada set respeite seu próprio target prescrito.
 *
 * Retorna false pra modo simples (todos sets com mesmo target) ou quando
 * `setScheme` está vazio (programas legados sem per-set rollout).
 *
 * @param field Campo sendo editado pelo aluno (weight | reps). Determina
 *              qual atributo do scheme inspecionar:
 *              - weight → weight_target_kg
 *              - reps   → reps_target
 */
function hasHeterogeneousSetScheme(
    setScheme: SetPrescription[] | undefined,
    field: 'weight' | 'reps'
): boolean {
    if (!setScheme || setScheme.length < 2) return false;

    if (field === 'weight') {
        const targets = setScheme.map((s) => s.weight_target_kg);
        // Só considera heterogêneo se há pelo menos 2 valores numéricos
        // distintos. null/undefined uniformes = modo simples (sem target
        // específico de peso — peso vem do histórico do aluno).
        const numericTargets = targets.filter((t): t is number => typeof t === 'number');
        if (numericTargets.length < 2) return false;
        const unique = new Set(numericTargets);
        return unique.size > 1;
    }

    // field === 'reps'
    const targets = setScheme
        .map((s) => (s.reps_target ?? '').trim())
        .filter((t) => t.length > 0);
    if (targets.length < 2) return false;
    const unique = new Set(targets);
    return unique.size > 1;
}

export interface PreviousSetData {
    set_number: number;
    weight: number;
    reps: number;
}

export interface ExerciseData {
    id: string; // assigned_workout_item_id
    item_type?: 'exercise' | 'warmup' | 'cardio';
    planned_exercise_id: string;
    exercise_id: string;
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    video_url?: string;
    substitute_exercise_ids: string[];
    swap_source: 'none' | 'manual' | 'auto';
    setsData: WorkoutSetData[];
    previousLoad?: string;
    previousSets?: PreviousSetData[];
    notes?: string | null;
    supersetId?: string | null;
    supersetRestSeconds?: number;
    supersetOrderIndex?: number | null;
    order_index: number;
    exerciseFunction?: string | null;
    item_config?: Record<string, any>;
    /** Per-set prescription hydrated from `assigned_workout_item_sets`. Empty
     *  array when the item uses legacy aggregate prescription (programs created
     *  before per-set rollout). */
    setScheme: SetPrescription[];
    /** Method/preset marker stored on the parent `assigned_workout_items` row. */
    methodKey: MethodKey | null;
    /** Rodadas (Fase 4.3). 1 para métodos lineares (default). > 1 para
     *  compostos — UI agrupa o setScheme em N rodadas via `round_number`. */
    rounds: number;
}

export interface WorkoutNote {
    id: string;
    notes: string;
    order_index: number;
}

export interface ExerciseSubstituteOption {
    id: string;
    name: string;
    equipment?: string | null;
    video_url?: string | null;
    muscle_groups: string[];
    source: 'manual' | 'auto' | 'search';
}

interface UseWorkoutSessionOptions {
    onSetComplete?: (exerciseIndex: number, setIndex: number) => void;
    /** C1: chamado quando uma série é marcada como concluída mas, mesmo após
     *  herdar alvo/anterior, ficou sem carga e sem reps (0×0). A UI deve
     *  INFORMAR o aluno sem bloquear o registro. */
    onEmptySetLogged?: (exerciseIndex: number, setIndex: number) => void;
    /** When true, the session is NOT created on mount. Call createSession() manually. */
    deferSessionCreation?: boolean;
}

export function useWorkoutSession(workoutId: string, options?: UseWorkoutSessionOptions) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [exercises, setExercises] = useState<ExerciseData[]>([]);
    const [workoutNotes, setWorkoutNotes] = useState<WorkoutNote[]>([]);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    // Promessa de criação de sessão em voo — evita criar 2+ sessões quando várias
    // séries são marcadas em sequência antes do sessionId chegar ao estado.
    const createSessionPromiseRef = useRef<Promise<string | null> | null>(null);
    const preSubmissionIdRef = useRef<string | null>(null);
    const [assignedProgramId, setAssignedProgramId] = useState<string | null>(null);
    const scheduledDaysRef = useRef<number[] | null>(null);
    const programStartedAtRef = useRef<string | null>(null);
    const programDurationWeeksRef = useRef<number | null>(null);
    const [startTime] = useState(() => Date.now());
    // A14: started_at REAL da sessão quando ela é REANEXADA (retomada). Sem isto,
    // retomar uma sessão antiga e finalizar gravava duração = (agora - mount) e
    // sobrescrevia started_at com o mount atual — corrompendo data/duração.
    const sessionStartedAtRef = useRef<string | null>(null);
    // A1: depois que o aluno confirma o descarte, nenhuma série pode mais ser
    // persistida (uma marcação em voo não é cancelável, mas novas são barradas).
    const isDiscardingRef = useRef(false);
    // A1: espelho do sessionId p/ funções chamadas de closures antigas (o
    // beforeRemove da tela captura o discardWorkout do primeiro render, quando
    // sessionId ainda era null — sem o ref, o descarte viraria no-op).
    const sessionIdRef = useRef<string | null>(null);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    // S4: depois do finish bem-sucedido, o snapshot local já foi limpo — o
    // effect de save não pode regravá-lo com o estado final da tela.
    const hasFinishedRef = useRef(false);
    const [elapsed, setElapsed] = useState(0);
    const [workoutName, setWorkoutName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Guard: prevent re-fetching workout data when auth session refreshes.
    // Supabase onAuthStateChange fires on TOKEN_REFRESHED, creating a new `user`
    // reference which would re-trigger the fetchWorkout effect and wipe exercise state.
    const hasLoadedRef = useRef(false);
    const isFetchingRef = useRef(false);
    const loadedWorkoutIdRef = useRef<string | null>(null);

    // Reset load guards when workoutId changes (e.g. Watch starts a new workout
    // while the workout screen is still mounted from a previous session).
    useEffect(() => {
        if (loadedWorkoutIdRef.current && loadedWorkoutIdRef.current !== workoutId) {
            hasLoadedRef.current = false;
            isFetchingRef.current = false;
            setIsLoading(true);
            setExercises([]);
            setSessionId(null);
        }
    }, [workoutId]);

    const mapExerciseToSubstituteOption = (
        exercise: any,
        source: 'manual' | 'auto' | 'search'
    ): ExerciseSubstituteOption => ({
        id: exercise.id,
        name: exercise.name,
        equipment: exercise.equipment,
        video_url: exercise.video_url,
        muscle_groups: (exercise.exercise_muscle_groups || [])
            .map((entry: any) => entry.muscle_groups?.name)
            .filter(Boolean),
        source,
    });

    const createInitialSets = (setsCount: number) => (
        Array(Math.max(setsCount || 0, 0)).fill(null).map(() => ({
            weight: '',
            reps: '',
            completed: false
        }))
    );

    // C1: quando o aluno marca uma série sem digitar nada, herdamos o valor que
    // o placeholder do SetRow já exibia (alvo prescrito → carga/reps anteriores).
    // Espelha a resolução de placeholder do SetRow pra não gravar 0kg×0rep
    // silenciosamente. Retorna '' quando não há nada coerente a herdar.
    const resolveWeightFallback = (exercise: ExerciseData, setIndex: number): string => {
        const kg = formatWeightKg(exercise.setScheme?.[setIndex]?.weight_target_kg ?? null);
        if (kg !== null) return kg;
        const prev = exercise.previousSets?.[setIndex];
        if (prev && Number.isFinite(prev.weight)) return String(prev.weight);
        return '';
    };

    const resolveRepsFallback = (exercise: ExerciseData, setIndex: number): string => {
        const target = (exercise.setScheme?.[setIndex]?.reps_target ?? '').trim();
        // Só herda o alvo se ele contiver número (ex.: "10", "8-12", "8+").
        // Alvos textuais (AMRAP/falha/máximo) não viram reps — cai no anterior.
        if (target.length > 0 && /\d/.test(target)) return target;
        const prev = exercise.previousSets?.[setIndex];
        if (prev && Number.isFinite(prev.reps)) return String(prev.reps);
        return '';
    };

    const formatLoadLabel = (maxWeight?: number | null) => {
        if (maxWeight === null || maxWeight === undefined) return undefined;
        const value = Number(maxWeight);
        if (!Number.isFinite(value) || value <= 0) return undefined;
        const normalized = Number.isInteger(value) ? `${value}` : value.toFixed(1);
        return `${normalized}kg`;
    };

    const fetchPreviousSets = async (
        targetStudentId: string,
        exerciseId: string
    ): Promise<{ previousSets: PreviousSetData[]; previousLoad?: string }> => {
        if (!targetStudentId || !exerciseId) return { previousSets: [] };

        // Try per-set RPC first
        const { data: sets, error: setsError }: { data: any; error: any } = await supabase
            .rpc('get_previous_exercise_sets' as any, {
                p_student_id: targetStudentId,
                p_exercise_id: exerciseId,
            });

        if (!setsError && Array.isArray(sets) && sets.length > 0) {
            const previousSets: PreviousSetData[] = sets.map((s: any) => ({
                set_number: s.set_number,
                weight: Number(s.weight) || 0,
                reps: Number(s.reps) || 0,
            }));
            const maxWeight = Math.max(...previousSets.map(s => s.weight));
            return { previousSets, previousLoad: formatLoadLabel(maxWeight) };
        }

        // Fallback: aggregated RPC
        const { data: metrics, error: rpcError }: { data: any; error: any } = await supabase
            .rpc('get_last_exercise_metrics' as any, {
                p_student_id: targetStudentId,
                p_exercise_id: exerciseId,
            });

        if (!rpcError && Array.isArray(metrics) && metrics.length > 0) {
            return { previousSets: [], previousLoad: formatLoadLabel(metrics[0]?.max_weight) };
        }

        // Final fallback: direct query
        const { data: legacyHistory }: { data: any; error: any } = await supabase
            .from('set_logs' as any)
            .select('weight, weight_unit')
            .eq('exercise_id', exerciseId)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (legacyHistory?.weight !== undefined && legacyHistory?.weight !== null) {
            return { previousSets: [], previousLoad: `${legacyHistory.weight}${legacyHistory.weight_unit || 'kg'}` };
        }

        return { previousSets: [] };
    };

    const fetchExerciseIdsBySharedMuscleGroups = async (exerciseId: string): Promise<string[]> => {
        if (!exerciseId) return [];

        const { data: groups }: { data: any; error: any } = await supabase
            .from('exercise_muscle_groups' as any)
            .select('muscle_group_id')
            .eq('exercise_id', exerciseId);

        const groupIds: string[] = Array.from(
            new Set(
                (groups || [])
                    .map((g: any) => g.muscle_group_id)
                    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            )
        );

        if (groupIds.length === 0) return [];

        const { data: groupMatches }: { data: any; error: any } = await supabase
            .from('exercise_muscle_groups' as any)
            .select('exercise_id')
            .in('muscle_group_id', groupIds)
            .limit(400);

        return Array.from(
            new Set(
                (groupMatches || [])
                    .map((match: any) => match.exercise_id)
                    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
            )
        );
    };

    const fetchExercisesByIds = async (
        ids: string[],
        source: 'manual' | 'auto' | 'search'
    ): Promise<ExerciseSubstituteOption[]> => {
        if (ids.length === 0) return [];

        const { data: exercisesData, error: exerciseError }: { data: any; error: any } = await supabase
            .from('exercises' as any)
            .select(`
                id,
                name,
                equipment,
                video_url,
                exercise_muscle_groups (
                    muscle_groups ( name )
                )
            `)
            .in('id', ids);

        if (exerciseError || !exercisesData) return [];

        const byId = new Map<string, ExerciseSubstituteOption>(
            exercisesData.map((exercise: any) => [
                exercise.id,
                mapExerciseToSubstituteOption(exercise, source),
            ])
        );

        return ids
            .map((id) => byId.get(id))
            .filter((option): option is ExerciseSubstituteOption => Boolean(option));
    };

    // Persist a single set_log to Supabase (fire-and-forget, non-blocking).
    const persistSetLog = async (
        exercise: ExerciseData,
        setIndex: number,
        setData: WorkoutSetData
    ) => {
        if (!setData.completed) return;
        if (isDiscardingRef.current) return; // A1: descarte confirmado — não regrava

        // Garante uma sessão ANTES de gravar. Sem isto, marcar séries antes da
        // sessão existir não persistia nada (perda de treino se o app fechasse).
        let sid = sessionId;
        if (!sid) {
            sid = await createSession();
            if (!sid) {
                // Sem sessão (ex.: offline ou dados faltando). A série fica no estado
                // e será reenviada no upsert de catch-up do finishWorkout.
                if (__DEV__) console.warn('[useWorkoutSession] persistSetLog sem sessão — série será sincronizada ao finalizar');
                return;
            }
        }

        const weight = parseFloat(setData.weight) || 0;
        const repsCompleted = parseInt(setData.reps) || 0;

        const upsertPayload = {
            workout_session_id: sid,
            assigned_workout_item_id: exercise.id,
            planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
            executed_exercise_id: exercise.exercise_id,
            swap_source: exercise.swap_source || 'none',
            exercise_id: exercise.exercise_id,
            set_number: setIndex + 1,
            weight,
            reps_completed: repsCompleted,
            is_completed: true,
            completed_at: new Date().toISOString(),
            weight_unit: 'kg',
        };

        try {
            const { error } = await supabase
                .from('set_logs' as any)
                .upsert(upsertPayload, {
                    onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
                });

            if (error) {
                // A4: rede caiu (ou erro transiente) — entra na fila offline e o
                // listener de NetInfo do _layout drena quando a conexão voltar.
                enqueueSetLogUpsert(upsertPayload);
                if (__DEV__) console.error(`[useWorkoutSession] persistSetLog error (enfileirado): ${error.message} | code: ${error.code} | details: ${error.details} | hint: ${error.hint}`);
            } else {
                if (__DEV__) console.log(`[useWorkoutSession] Set persisted: exercise=${exercise.name}, set=${setIndex + 1}, ${repsCompleted}reps x ${weight}kg`);
            }
        } catch (err: any) {
            enqueueSetLogUpsert(upsertPayload); // A4
            if (__DEV__) console.error(`[useWorkoutSession] persistSetLog exception (enfileirado): ${err?.message}`);
        }

        // Mirror the set completion to the Apple Watch so it advances in step with the
        // phone (otherwise the Watch stays stuck on set 1 while the user logs on the phone).
        if (Platform.OS === 'ios') {
            try {
                const { sendReliableToWatch } = require('../modules/watch-connectivity/src/WatchConnectivityModule');
                sendReliableToWatch({
                    type: 'SET_COMPLETE_FROM_PHONE',
                    payload: { workoutId, exerciseId: exercise.id, setIndex, reps: repsCompleted, weight },
                });
            } catch { /* Watch not available — non-critical */ }
        }
    };

    // A1: "Descartar treino" agora descarta DE VERDADE. Antes, o diálogo só
    // navegava de volta: a sessão ficava in_progress e os set_logs persistidos
    // incrementalmente sobreviviam — reabrir o treino reanexava tudo e o finish
    // incluía séries "descartadas" (volume inflado, PR falso). Mesma técnica do
    // C4 (swap): apaga os set_logs e marca a sessão como abandoned (o guard de
    // status evita sobrescrever uma sessão que o Watch completou em paralelo).
    const discardWorkout = async (): Promise<void> => {
        isDiscardingRef.current = true;
        clearWorkoutState(workoutId); // S4: snapshot local morre junto
        const sid = sessionIdRef.current;
        if (!sid) return; // nada foi persistido ainda
        // A4: séries descartadas não podem ressuscitar numa drenagem futura.
        clearPendingSetLogsForSession(sid);
        try {
            const { error: logsError } = await supabase
                .from('set_logs' as any)
                .delete()
                .eq('workout_session_id', sid);
            if (logsError && __DEV__) console.error(`[useWorkoutSession] discard set_logs error: ${logsError.message}`);

            const { error: sessionError } = await supabase
                .from('workout_sessions' as any)
                .update({ status: 'abandoned' })
                .eq('id', sid)
                .eq('status', 'in_progress');
            if (sessionError && __DEV__) console.error(`[useWorkoutSession] discard session error: ${sessionError.message}`);

            if (__DEV__) console.log(`[useWorkoutSession] Workout discarded: session ${sid} abandoned, set_logs deleted`);
        } catch (err: any) {
            if (__DEV__) console.error(`[useWorkoutSession] discardWorkout exception: ${err?.message}`);
        }
    };

    // C2: ao desmarcar uma série, remove o registro já persistido. Sem isto a
    // série "removida" continuava valendo no banco (inflando volume / PR falso).
    const deletePersistedSetLog = async (exercise: ExerciseData, setIndex: number) => {
        const sid = sessionId;
        if (!sid) return; // nada foi persistido ainda
        const deleteKey = {
            workout_session_id: sid,
            assigned_workout_item_id: exercise.id,
            set_number: setIndex + 1,
        };
        try {
            const { error } = await supabase
                .from('set_logs' as any)
                .delete()
                .eq('workout_session_id', sid)
                .eq('assigned_workout_item_id', exercise.id)
                .eq('set_number', setIndex + 1);
            if (error) {
                // A4: desmarcar offline também entra na fila (a remoção substitui
                // qualquer upsert pendente da mesma série — última operação vence).
                enqueueSetLogDelete(deleteKey);
                if (__DEV__) console.error(`[useWorkoutSession] deletePersistedSetLog error (enfileirado): ${error.message}`);
            }
        } catch (err: any) {
            enqueueSetLogDelete(deleteKey); // A4
            if (__DEV__) console.error(`[useWorkoutSession] deletePersistedSetLog exception (enfileirado): ${err?.message}`);
        }
    };

    // Timer — timestamp-based so it survives background/lock screen.
    // M4: em sessão reanexada, o display parte do started_at REAL (lido do ref a
    // cada tick, pois ele chega async depois do fetch), não do mount da tela.
    useEffect(() => {
        const interval = setInterval(() => {
            const parsedStart = sessionStartedAtRef.current ? Date.parse(sessionStartedAtRef.current) : NaN;
            const base = Number.isFinite(parsedStart) ? parsedStart : startTime;
            setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000)));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    // Fetch Workout Data
    useEffect(() => {
        // Wait for auth before anything — when the Watch starts a workout,
        // this screen mounts before AuthProvider resolves `user`. The effect
        // must re-run once user transitions from null → valid.
        if (!workoutId || !user) return;
        // Only THEN guard against duplicate fetches.
        if (hasLoadedRef.current) return;
        // Prevent parallel invocations: if a fetchWorkout is already in-flight
        // (e.g. TOKEN_REFRESHED fired during the initial async fetch), skip.
        if (isFetchingRef.current) return;

        // Capture for the async closure — TS can't narrow across await boundaries.
        const currentUser = user;
        let mounted = true;

        async function fetchWorkout() {
            isFetchingRef.current = true;

            try {
                // Student context for logs/history RPC
                const { data: student, error: studentError }: { data: any; error: any } = await supabase
                    .from('students' as any)
                    .select('id')
                    .eq('auth_user_id', currentUser.id)
                    .maybeSingle();

                if (studentError) throw studentError;
                const currentStudentId = student?.id || null;
                if (mounted) setStudentId(currentStudentId);

                // 1. Get Workout Details
                const { data: workout, error: workoutError }: { data: any; error: any } = await supabase
                    .from('assigned_workouts' as any)
                    .select('name, assigned_program_id, scheduled_days')
                    .eq('id', workoutId)
                    .single();

                if (workoutError) throw workoutError;
                if (mounted) {
                    setWorkoutName(workout.name);
                    setAssignedProgramId(workout.assigned_program_id || null);
                    scheduledDaysRef.current = workout.scheduled_days || null;
                }

                // 1a. Fetch program dates for program_week calculation
                let programStartedAt: string | null = null;
                let programDurationWeeks: number | null = null;
                if (workout.assigned_program_id) {
                    const { data: prog }: { data: any; error: any } = await supabase
                        .from('assigned_programs' as any)
                        .select('started_at, duration_weeks')
                        .eq('id', workout.assigned_program_id)
                        .single();
                    if (prog) {
                        programStartedAt = prog.started_at;
                        programDurationWeeks = prog.duration_weeks;
                        programStartedAtRef.current = prog.started_at;
                        programDurationWeeksRef.current = prog.duration_weeks;
                    }
                }

                // 1b. Find or create workout_session (in_progress)
                // When deferSessionCreation is true, skip creating a new session.
                // An existing in_progress session is still reattached.
                const { data: existingSession }: { data: any; error: any } = await supabase
                    .from('workout_sessions' as any)
                    .select('id, started_at')
                    .eq('assigned_workout_id', workoutId)
                    .eq('student_id', currentStudentId)
                    .eq('status', 'in_progress')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // A2: séries já persistidas da sessão reanexada, indexadas por
                // item+set_number, para pré-popular o estado (rehidratação).
                const persistedLogByKey = new Map<string, { weight: number; reps_completed: number; notes: string | null }>();

                if (existingSession) {
                    if (__DEV__) console.log(`[useWorkoutSession] Found existing in_progress session: ${existingSession.id}`);
                    sessionStartedAtRef.current = existingSession.started_at ?? null; // A14
                    if (mounted) setSessionId(existingSession.id);

                    // A2: lê de volta os set_logs gravados incrementalmente. Sem isto,
                    // app morto/reaberto no meio do treino mostrava "0/N séries" com
                    // tudo no banco — o aluno re-marcava ou desistia achando que perdeu.
                    const { data: persistedLogs, error: persistedError }: { data: any; error: any } = await supabase
                        .from('set_logs' as any)
                        .select('assigned_workout_item_id, set_number, weight, reps_completed, notes')
                        .eq('workout_session_id', existingSession.id)
                        .eq('is_completed', true);
                    if (persistedError) {
                        if (__DEV__) console.warn(`[useWorkoutSession] rehydrate set_logs failed: ${persistedError.message}`);
                    } else {
                        for (const log of persistedLogs || []) {
                            persistedLogByKey.set(`${log.assigned_workout_item_id}:${log.set_number}`, log);
                        }
                        if (__DEV__ && persistedLogByKey.size > 0) console.log(`[useWorkoutSession] Rehydrated ${persistedLogByKey.size} persisted set(s)`);
                    }
                } else if (!options?.deferSessionCreation) {
                    // Get trainer_id from student
                    const { data: studentFull }: { data: any; error: any } = await supabase
                        .from('students' as any)
                        .select('coach_id')
                        .eq('id', currentStudentId)
                        .single();

                    // Determine scheduled_date: set to today if this workout is scheduled for today's day-of-week
                    const todayDow = new Date().getDay();
                    const isScheduledToday = workout.scheduled_days?.includes(todayDow);
                    const scheduledDate = isScheduledToday ? new Date().toISOString().split('T')[0] : null;

                    const programWeek = programStartedAt
                        ? getProgramWeek(new Date(), programStartedAt, programDurationWeeks) ?? 1
                        : 1;

                    const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                        .from('workout_sessions' as any)
                        .insert({
                            student_id: currentStudentId,
                            trainer_id: studentFull?.coach_id,
                            assigned_workout_id: workoutId,
                            assigned_program_id: workout.assigned_program_id,
                            status: 'in_progress',
                            started_at: new Date().toISOString(),
                            sync_status: 'synced',
                            scheduled_date: scheduledDate,
                            program_week: programWeek,
                        })
                        .select('id')
                        .single();

                    if (sessionError) {
                        console.error('[useWorkoutSession] Failed to create session:', __DEV__ ? sessionError : '');
                    } else {
                        if (__DEV__) console.log(`[useWorkoutSession] Created new in_progress session: ${newSession.id}`);
                        if (mounted) setSessionId(newSession.id);
                    }
                } else {
                    if (__DEV__) console.log('[useWorkoutSession] Session creation deferred — waiting for createSession()');
                }

                // 2. Get ALL Workout Items (exercises, supersets, notes)
                const { data: items, error: itemsError }: { data: any; error: any } = await supabase
                    .from('assigned_workout_items' as any)
                    .select(`
                        id,
                        exercise_id,
                        exercise_name,
                        sets,
                        reps,
                        rest_seconds,
                        substitute_exercise_ids,
                        item_type,
                        order_index,
                        parent_item_id,
                        notes,
                        exercise_function,
                        item_config,
                        method_key,
                        rounds,
                        exercises ( id, video_url )
                    `)
                    .eq('assigned_workout_id', workoutId)
                    .order('order_index');

                if (itemsError) throw itemsError;

                // 2a. Per-set prescription rows (Fase 4). One round-trip per
                //     workout — programs without per-set data return an empty
                //     array and we fall back to aggregates.
                const exerciseItemIdsForSets = (items || [])
                    .filter((it: any) => it.item_type === 'exercise')
                    .map((it: any) => it.id);
                const setSchemeByItem = new Map<string, WorkoutSet[]>();
                if (exerciseItemIdsForSets.length > 0) {
                    const { data: setRows, error: setRowsError }: { data: any; error: any } = await supabase
                        .from('assigned_workout_item_sets' as any)
                        .select('assigned_workout_item_id, set_number, set_type, reps, rest_seconds, weight_target_kg, weight_target_pct1rm, rir, tempo, notes, round_number')
                        .in('assigned_workout_item_id', exerciseItemIdsForSets);
                    if (setRowsError && __DEV__) {
                        console.warn('[useWorkoutSession] set rows query failed:', setRowsError?.message);
                    }
                    for (const row of setRows || []) {
                        const list = setSchemeByItem.get(row.assigned_workout_item_id) ?? [];
                        list.push({
                            set_number: row.set_number,
                            set_type: row.set_type,
                            reps: row.reps,
                            rest_seconds: row.rest_seconds,
                            weight_target_kg: row.weight_target_kg,
                            weight_target_pct1rm: row.weight_target_pct1rm,
                            rir: row.rir,
                            tempo: row.tempo,
                            notes: row.notes,
                            round_number: row.round_number ?? null,
                        });
                        setSchemeByItem.set(row.assigned_workout_item_id, list);
                    }
                }

                // 3. Build superset map and extract notes
                const supersetMap = new Map<string, { rest_seconds: number; order_index: number }>();
                const noteItems: WorkoutNote[] = [];

                for (const item of items) {
                    if (item.item_type === 'superset') {
                        supersetMap.set(item.id, { rest_seconds: item.rest_seconds || 60, order_index: item.order_index });
                    } else if (item.item_type === 'note' && item.notes?.trim()) {
                        noteItems.push({ id: item.id, notes: item.notes, order_index: item.order_index });
                    }
                }

                // 4. Sort exercise items using superset-aware ordering
                const exerciseItems = sortExerciseItems(
                    items.filter((item: any) => item.item_type === 'exercise'),
                    supersetMap,
                );

                const warmupCardioItems = items.filter((item: any) => item.item_type === 'warmup' || item.item_type === 'cardio');
                const exerciseIds = exerciseItems.map((item: any) => item.exercise_id).filter(Boolean);
                const trainerVideoMap = new Map<string, string>();

                if (exerciseIds.length > 0) {
                    // Get coach_id for video resolution (student's trainer)
                    const { data: studentForVideos }: { data: any; error: any } = await supabase
                        .from('students' as any)
                        .select('coach_id')
                        .eq('auth_user_id', currentUser.id)
                        .single();

                    if (studentForVideos?.coach_id) {
                        const { data: trainerVideos }: { data: any; error: any } = await supabase
                            .from('trainer_exercise_videos' as any)
                            .select('exercise_id, video_url')
                            .eq('trainer_id', studentForVideos.coach_id)
                            .in('exercise_id', exerciseIds);

                        for (const tv of trainerVideos || []) {
                            trainerVideoMap.set(tv.exercise_id, tv.video_url);
                        }
                    }
                }

                // 5. Initialize exercise state and fetch history
                const exercisesData: ExerciseData[] = await Promise.all(exerciseItems.map(async (item: any) => {
                    let previousLoad: string | undefined = undefined;
                    let previousSets: PreviousSetData[] | undefined = undefined;
                    if (item.exercise_id && currentStudentId) {
                        const result = await fetchPreviousSets(currentStudentId, item.exercise_id);
                        previousLoad = result.previousLoad;
                        previousSets = result.previousSets.length > 0 ? result.previousSets : undefined;
                    }

                    const parentSuperset = item.parent_item_id ? supersetMap.get(item.parent_item_id) : null;

                    const assignedSets = setSchemeByItem.get(item.id) ?? null;
                    const setPrescriptions = hydrateSetPrescriptions({
                        assignedSets,
                        aggregateSets: item.sets || 3,
                        aggregateReps: item.reps || '10',
                        aggregateRestSeconds: item.rest_seconds || 60,
                    });
                    const effectiveSetCount = setPrescriptions.length;

                    return {
                        id: item.id,
                        item_type: 'exercise' as const,
                        planned_exercise_id: item.exercise_id,
                        exercise_id: item.exercise_id,
                        name: item.exercise_name,
                        sets: effectiveSetCount || (item.sets || 3),
                        reps: item.reps || '10',
                        rest_seconds: item.rest_seconds || 60,
                        video_url: trainerVideoMap.get(item.exercise_id) || item.exercises?.video_url,
                        substitute_exercise_ids: item.substitute_exercise_ids || [],
                        swap_source: 'none',
                        // A2: séries da sessão reanexada voltam marcadas com peso/reps
                        // reais (Map vazio quando a sessão é nova — sem custo).
                        setsData: createInitialSets(effectiveSetCount || (item.sets || 3)).map((emptySet, i) => {
                            const log = persistedLogByKey.get(`${item.id}:${i + 1}`);
                            if (!log) return emptySet;
                            return {
                                weight: log.weight > 0 ? String(log.weight) : '',
                                reps: log.reps_completed > 0 ? String(log.reps_completed) : '',
                                completed: true,
                            };
                        }),
                        previousLoad,
                        previousSets,
                        notes: item.notes || null,
                        supersetId: item.parent_item_id || null,
                        supersetRestSeconds: parentSuperset?.rest_seconds,
                        supersetOrderIndex: parentSuperset?.order_index ?? null,
                        order_index: item.order_index,
                        exerciseFunction: item.exercise_function || null,
                        item_config: item.item_config || {},
                        setScheme: assignedSets && assignedSets.length > 0 ? setPrescriptions : [],
                        methodKey: (item.method_key as MethodKey | null) ?? null,
                        rounds: typeof item.rounds === 'number' && item.rounds >= 1 ? item.rounds : 1,
                    };
                }));

                // Add warmup/cardio items — no set tracking
                for (const item of warmupCardioItems) {
                    exercisesData.push({
                        id: item.id,
                        item_type: item.item_type as 'warmup' | 'cardio',
                        planned_exercise_id: '',
                        exercise_id: '',
                        name: item.notes || (item.item_type === 'warmup' ? 'Aquecimento' : 'Aeróbio'),
                        sets: 0,
                        reps: '0',
                        rest_seconds: 0,
                        substitute_exercise_ids: [],
                        swap_source: 'none',
                        setsData: [],
                        order_index: item.order_index,
                        exerciseFunction: item.exercise_function || null,
                        item_config: item.item_config || {},
                        setScheme: [],
                        methodKey: null,
                        rounds: 1,
                    });
                }

                // S4: snapshot local (MMKV) — restaura o que NÃO chegou ao banco:
                // pesos/reps digitados sem marcar, séries marcadas offline, swaps
                // e cardio concluído. Banco (A2) ganha para séries completed.
                const snapshot = loadWorkoutState(workoutId);
                if (snapshot) {
                    const snapshotIsValid = existingSession
                        ? !snapshot.sessionId || snapshot.sessionId === existingSession.id
                        : !snapshot.sessionId;
                    if (!snapshotIsValid) {
                        // A sessão do snapshot foi finalizada/abandonada por outro
                        // caminho (ex. Watch) — estado morto, descarta.
                        clearWorkoutState(workoutId);
                    } else {
                        const snapById = new Map(snapshot.exercises.map((e) => [e.id, e]));
                        for (let idx = 0; idx < exercisesData.length; idx++) {
                            const built = exercisesData[idx];
                            const snap = snapById.get(built.id);
                            if (!snap) continue;
                            const restored = { ...built };
                            // Swap feito antes do kill — sem isto a UI mostraria o
                            // exercício original com os logs do substituto.
                            if (snap.swap_source !== 'none' && snap.exercise_id && snap.exercise_id !== built.exercise_id) {
                                restored.exercise_id = snap.exercise_id;
                                restored.name = snap.name;
                                restored.video_url = snap.video_url ?? restored.video_url;
                                restored.swap_source = snap.swap_source;
                            }
                            if (built.item_type === 'cardio') {
                                // Cardio só persiste no banco no finish — o snapshot é
                                // a única fonte de um cardio concluído antes do kill.
                                if (snap.setsData[0]?.completed) {
                                    restored.setsData = [{ weight: '0', reps: '1', completed: true }];
                                    restored.item_config = { ...(restored.item_config || {}), ...(snap.item_config || {}) };
                                }
                            } else if (restored.setsData.length > 0) {
                                restored.setsData = restored.setsData.map((dbSet, i) => {
                                    if (dbSet.completed) return dbSet; // A2: banco ganha
                                    const snapSet = snap.setsData[i];
                                    if (snapSet && (snapSet.completed || snapSet.weight || snapSet.reps)) {
                                        return { weight: snapSet.weight, reps: snapSet.reps, completed: snapSet.completed };
                                    }
                                    return dbSet;
                                });
                            }
                            exercisesData[idx] = restored;
                        }
                        if (__DEV__) console.log('[useWorkoutSession] Local snapshot merged into workout state');
                    }
                }

                if (mounted) {
                    setExercises(exercisesData);
                    setWorkoutNotes(noteItems);
                    hasLoadedRef.current = true;
                    loadedWorkoutIdRef.current = workoutId;
                }

            } catch (error: any) {
                if (__DEV__) console.error("Error fetching workout:", error);
                const isPGRST116 = error?.code === 'PGRST116';
                Alert.alert(
                    "Erro",
                    isPGRST116
                        ? "Treino não encontrado. Verifique se o programa ainda está ativo."
                        : "Falha ao carregar o treino."
                );
            } finally {
                // Always reset isFetchingRef — even if unmounted — so a re-mount
                // or TOKEN_REFRESHED re-trigger can attempt the fetch again.
                isFetchingRef.current = false;
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchWorkout();
        return () => { mounted = false; };
    }, [workoutId, user?.id]);

    // S4: snapshot local a cada mudança de estado (MMKV é síncrono e sub-ms —
    // sem debounce). É o que sobrevive a um kill do app no meio do treino.
    useEffect(() => {
        if (!hasLoadedRef.current || loadedWorkoutIdRef.current !== workoutId) return;
        if (isDiscardingRef.current || hasFinishedRef.current) return;
        if (exercises.length === 0) return;
        saveWorkoutState(workoutId, {
            sessionId,
            savedAt: new Date().toISOString(),
            exercises: exercises.map((e) => ({
                id: e.id,
                exercise_id: e.exercise_id,
                name: e.name,
                video_url: e.video_url,
                swap_source: e.swap_source,
                setsData: e.setsData,
                item_config: e.item_config,
            })),
        });
    }, [exercises, sessionId, workoutId]);


    const handleSetChange = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
        setExercises(prev => {
            const exercise = prev[exerciseIndex];
            if (!exercise) return prev;

            // Update imutável raso: clona só o exercício afetado e suas séries
            // (antes: JSON deep-clone de TODOS os exercícios a cada tecla = lag).
            const sets = exercise.setsData.map(s => ({ ...s }));

            // Get the value BEFORE the update
            const oldValue = sets[setIndex][field];

            // Update the current set
            sets[setIndex][field] = value;

            // ── Custom set_scheme detection ──
            // Quando o trainer prescreve séries heterogêneas (pirâmide, drop-set,
            // cluster — sets com targets distintos), NÃO propagamos o valor pra
            // séries seguintes. Cada série deve respeitar o que foi prescrito.
            // Pra séries em modo simples (todos sets com mesmo target ou sem
            // scheme), o waterfall continua ativo.
            const isHeterogeneous = hasHeterogeneousSetScheme(exercise.setScheme, field);

            if (!isHeterogeneous) {
                // Smart Waterfall Logic: Propagate to subsequent sets
                // Rule: Propagate if the next set is empty OR if it matched the *old* value (was previously auto-filled)
                for (let i = setIndex + 1; i < sets.length; i++) {
                    const currentNextValue = sets[i][field];

                    // Conditions to propagate:
                    // 1. The target field is empty
                    // 2. The target field matches the oldValue (meaning it was likely following the waterfall)
                    if (currentNextValue === '' || currentNextValue === oldValue) {
                        sets[i][field] = value;
                    } else {
                        // Stop propagation if we hit a manually changed value (rock in the waterfall)
                        break;
                    }
                }
            }

            const newExercises = [...prev];
            newExercises[exerciseIndex] = { ...exercise, setsData: sets };
            return newExercises;
        });
    };

    const handleToggleSetComplete = (exerciseIndex: number, setIndex: number) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const exercise = { ...newExercises[exerciseIndex] };
            const newSets = [...exercise.setsData];
            const wasCompleted = newSets[setIndex].completed;

            if (!wasCompleted) {
                // C1: herda o placeholder (alvo prescrito → carga/reps anteriores)
                // quando o campo está vazio, em vez de gravar 0kg×0rep.
                let weight = newSets[setIndex].weight;
                let reps = newSets[setIndex].reps;
                if (weight.trim() === '') weight = resolveWeightFallback(exercise, setIndex);
                if (reps.trim() === '') reps = resolveRepsFallback(exercise, setIndex);
                const completedSet: WorkoutSetData = { weight, reps, completed: true };
                newSets[setIndex] = completedSet;
                exercise.setsData = newSets;
                newExercises[exerciseIndex] = exercise;

                // Fire callback when marking as complete (not when unchecking)
                if (options?.onSetComplete) {
                    options.onSetComplete(exerciseIndex, setIndex);
                }

                // Persist to DB immediately (fire-and-forget)
                persistSetLog(exercise, setIndex, completedSet);

                // C1: se mesmo após herdar não há carga nem reps (sem alvo nem
                // histórico), INFORMA o aluno — mas NÃO bloqueia o registro.
                const stillEmpty = (parseFloat(weight) || 0) === 0 && (parseInt(reps) || 0) === 0;
                if (stillEmpty && options?.onEmptySetLogged) {
                    options.onEmptySetLogged(exerciseIndex, setIndex);
                }
            } else {
                newSets[setIndex] = { ...newSets[setIndex], completed: false };
                exercise.setsData = newSets;
                newExercises[exerciseIndex] = exercise;

                // C2: desmarcar remove o registro já persistido
                deletePersistedSetLog(exercise, setIndex);
            }

            return newExercises;
        });
    };

    const applyWatchSetCompletion = (
        exerciseIndex: number,
        setIndex: number,
        reps?: number,
        weight?: number
    ) => {
        setExercises(prev => {
            if (!prev[exerciseIndex] || !prev[exerciseIndex].setsData[setIndex]) return prev;

            const newExercises = [...prev];
            const exercise = { ...newExercises[exerciseIndex] };
            const newSets = [...exercise.setsData];
            const currentSet = { ...newSets[setIndex] };
            const wasCompleted = currentSet.completed;

            if (reps !== undefined && Number.isFinite(reps)) {
                currentSet.reps = String(reps);
            }

            if (weight !== undefined && Number.isFinite(weight)) {
                currentSet.weight = String(weight);
            }

            // C1: mesma herança do toque manual — se o Watch não mandou valor e o
            // campo está vazio, herda alvo/anterior em vez de gravar 0.
            if (currentSet.weight.trim() === '') currentSet.weight = resolveWeightFallback(exercise, setIndex);
            if (currentSet.reps.trim() === '') currentSet.reps = resolveRepsFallback(exercise, setIndex);

            currentSet.completed = true;
            newSets[setIndex] = currentSet;
            exercise.setsData = newSets;
            newExercises[exerciseIndex] = exercise;

            if (!wasCompleted && options?.onSetComplete) {
                options.onSetComplete(exerciseIndex, setIndex);
            }

            // Persist to DB immediately (fire-and-forget)
            persistSetLog(exercise, setIndex, currentSet);

            return newExercises;
        });
    };

    const loadSubstituteOptions = async (exerciseIndex: number): Promise<ExerciseSubstituteOption[]> => {
        const current = exercises[exerciseIndex];
        if (!current?.id) return [];

        const plannedExerciseId = current.planned_exercise_id || current.exercise_id;
        if (!plannedExerciseId) return [];

        // 1) Manual suggestions from assigned item
        const { data: assignedItem }: { data: any; error: any } = await supabase
            .from('assigned_workout_items' as any)
            .select('substitute_exercise_ids')
            .eq('id', current.id)
            .maybeSingle();

        const manualIdsRaw: string[] = (
            Array.isArray(assignedItem?.substitute_exercise_ids)
                ? assignedItem.substitute_exercise_ids
                : (current.substitute_exercise_ids || [])
        ).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);

        const manualIds: string[] = Array.from(new Set(manualIdsRaw))
            .filter((id) => id !== current.exercise_id);

        const manualOptions = await fetchExercisesByIds(manualIds, 'manual');
        const manualSet = new Set(manualOptions.map((option) => option.id));

        // Automatic suggestions: max 2, using smart RPC when available.
        let autoOptions: ExerciseSubstituteOption[] = [];
        const { data: smartRows, error: smartError }: { data: any; error: any } = await supabase
            .rpc('get_smart_substitutes' as any, {
                target_exercise_id: plannedExerciseId,
                match_limit: 2,
            });

        if (!smartError && Array.isArray(smartRows)) {
            const smartIds: string[] = smartRows
                .map((row: any) => row.id)
                .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
                .filter((id) => id !== plannedExerciseId && id !== current.exercise_id && !manualSet.has(id))
                .slice(0, 2);

            autoOptions = await fetchExercisesByIds(smartIds, 'auto');
        } else {
            // Fallback if RPC is not yet available: old same-muscle strategy limited to 2.
            const sharedIds = await fetchExerciseIdsBySharedMuscleGroups(plannedExerciseId);
            const fallbackAutoIds = sharedIds
                .filter((id) => id !== plannedExerciseId && id !== current.exercise_id && !manualSet.has(id))
                .slice(0, 2);

            autoOptions = await fetchExercisesByIds(fallbackAutoIds, 'auto');
        }

        return [...manualOptions, ...autoOptions];
    };

    const searchSubstituteOptions = async (
        exerciseIndex: number,
        query: string
    ): Promise<ExerciseSubstituteOption[]> => {
        const current = exercises[exerciseIndex];
        if (!current?.id) return [];

        const searchTerm = query.trim();
        if (searchTerm.length < 2) return [];

        const plannedExerciseId = current.planned_exercise_id || current.exercise_id;
        if (!plannedExerciseId) return [];

        const sharedIds = await fetchExerciseIdsBySharedMuscleGroups(plannedExerciseId);
        const candidateIds = sharedIds.filter((id) => id !== plannedExerciseId && id !== current.exercise_id);
        if (candidateIds.length === 0) return [];

        const { data: exercisesData, error: searchError }: { data: any; error: any } = await supabase
            .from('exercises' as any)
            .select(`
                id,
                name,
                equipment,
                video_url,
                exercise_muscle_groups (
                    muscle_groups ( name )
                )
            `)
            .in('id', candidateIds)
            .ilike('name', `%${searchTerm}%`)
            .order('name')
            .limit(20);

        if (searchError || !exercisesData) return [];

        return exercisesData.map((exercise: any) => mapExerciseToSubstituteOption(exercise, 'search'));
    };

    const swapExercise = async (
        exerciseIndex: number,
        substitute: ExerciseSubstituteOption,
        forceReset = false
    ): Promise<{ success: boolean; requiresConfirmation?: boolean; message?: string }> => {
        const current = exercises[exerciseIndex];
        if (!current) {
            return { success: false, message: 'Exercicio nao encontrado.' };
        }

        const hasCompletedSets = current.setsData.some((set) => set.completed);
        if (hasCompletedSets && !forceReset) {
            return { success: false, requiresConfirmation: true, message: 'Este exercicio ja possui series concluidas.' };
        }

        // C4: ao trocar resetando, apaga os set_logs já gravados do exercício
        // antigo. Sem isto, as séries concluídas do exercício original ficavam
        // órfãs sob o mesmo assigned_workout_item_id, misturando dois exercícios
        // no histórico/volume.
        if (sessionId && hasCompletedSets) {
            try {
                const { error } = await supabase
                    .from('set_logs' as any)
                    .delete()
                    .eq('workout_session_id', sessionId)
                    .eq('assigned_workout_item_id', current.id);
                if (error && __DEV__) console.error(`[useWorkoutSession] swap cleanup error: ${error.message}`);
            } catch (err: any) {
                if (__DEV__) console.error(`[useWorkoutSession] swap cleanup exception: ${err?.message}`);
            }
        }

        let nextPreviousLoad: string | undefined = undefined;
        let nextPreviousSets: PreviousSetData[] | undefined = undefined;
        if (studentId) {
            const result = await fetchPreviousSets(studentId, substitute.id);
            nextPreviousLoad = result.previousLoad;
            nextPreviousSets = result.previousSets.length > 0 ? result.previousSets : undefined;
        }

        setExercises((prev) => prev.map((exercise, index) => {
            if (index !== exerciseIndex) return exercise;

            return {
                ...exercise,
                exercise_id: substitute.id,
                name: substitute.name,
                video_url: substitute.video_url ?? exercise.video_url ?? undefined,
                previousLoad: nextPreviousLoad,
                previousSets: nextPreviousSets,
                swap_source: substitute.source === 'search' ? 'manual' : substitute.source,
                setsData: createInitialSets(exercise.sets),
            };
        }));

        return { success: true };
    };

    /**
     * Manually create the workout_session. Used when deferSessionCreation is true.
     * Returns the new session ID, or null on failure.
     */
    const createSession = async (preWorkoutSubmissionId?: string): Promise<string | null> => {
        if (sessionId) return sessionId; // Already exists
        if (!user || !studentId) return null;
        // Dedupe: se já há uma criação em voo, reaproveita (evita sessões duplicadas).
        if (createSessionPromiseRef.current) return createSessionPromiseRef.current;

        const promise = createSessionInternal(preWorkoutSubmissionId);
        createSessionPromiseRef.current = promise;
        try {
            return await promise;
        } finally {
            createSessionPromiseRef.current = null;
        }
    };

    const createSessionInternal = async (preWorkoutSubmissionId?: string): Promise<string | null> => {
        try {
            const { data: studentFull }: { data: any; error: any } = await supabase
                .from('students' as any)
                .select('coach_id')
                .eq('id', studentId)
                .single();

            // Resolve assigned_program_id: prefer state, fallback to fresh DB query
            let resolvedProgramId = assignedProgramId;
            if (!resolvedProgramId) {
                const { data: workoutData }: { data: any } = await supabase
                    .from('assigned_workouts' as any)
                    .select('assigned_program_id')
                    .eq('id', workoutId)
                    .maybeSingle();
                resolvedProgramId = workoutData?.assigned_program_id ?? null;
            }

            if (!resolvedProgramId || !studentFull?.coach_id) {
                if (__DEV__) console.error(
                    `[useWorkoutSession] createSession aborted: assigned_program_id=${resolvedProgramId}, coach_id=${studentFull?.coach_id}`
                );
                return null;
            }

            // Determine scheduled_date: set to today if this workout is scheduled for today's day-of-week
            const todayDow = new Date().getDay();
            const isScheduledToday = scheduledDaysRef.current?.includes(todayDow);
            const scheduledDate = isScheduledToday ? new Date().toISOString().split('T')[0] : null;

            const programWeek = programStartedAtRef.current
                ? getProgramWeek(new Date(), programStartedAtRef.current, programDurationWeeksRef.current) ?? 1
                : 1;

            const insertPayload: Record<string, any> = {
                student_id: studentId,
                trainer_id: studentFull.coach_id,
                assigned_workout_id: workoutId,
                assigned_program_id: resolvedProgramId,
                status: 'in_progress',
                started_at: new Date().toISOString(),
                sync_status: 'synced',
                scheduled_date: scheduledDate,
                program_week: programWeek,
            };
            if (preWorkoutSubmissionId) {
                insertPayload.pre_workout_submission_id = preWorkoutSubmissionId;
                preSubmissionIdRef.current = preWorkoutSubmissionId;
            }

            const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                .from('workout_sessions' as any)
                .insert(insertPayload)
                .select('id')
                .single();

            if (sessionError) {
                console.error('[useWorkoutSession] createSession error:', __DEV__ ? sessionError : '');
                return null;
            }

            if (__DEV__) console.log(`[useWorkoutSession] Session created via createSession(): ${newSession.id}`);
            setSessionId(newSession.id);
            return newSession.id;
        } catch (err: any) {
            if (__DEV__) console.error('[useWorkoutSession] createSession exception:', err?.message);
            return null;
        }
    };

    const finishWorkout = async (rpe?: number, feedback?: string, postWorkoutSubmissionId?: string) => {
        if (isSubmitting) return; // já finalizando (toque duplo) — ignora silenciosamente
        if (!user) {
            // Não deixa o aluno preso sem feedback ao finalizar sem sessão de auth.
            Alert.alert("Sessão expirada", "Faça login novamente para finalizar o treino.");
            return;
        }

        setIsSubmitting(true);

        try {
            // A14: base a duração no started_at real da sessão (quando reanexada),
            // não no mount desta tela.
            const parsedStart = sessionStartedAtRef.current ? Date.parse(sessionStartedAtRef.current) : NaN;
            const sessionStartMs = Number.isFinite(parsedStart) ? parsedStart : startTime;
            const durationSeconds = Math.max(0, Math.floor((Date.now() - sessionStartMs) / 1000));
            const now = new Date().toISOString();

            // Use existing session (created on workout start) or create one as fallback
            let currentSessionId = sessionId;

            if (!currentSessionId) {
                if (__DEV__) console.warn('[useWorkoutSession] No sessionId at finish — creating session now');

                const { data: student }: { data: any; error: any } = await supabase
                    .from('students' as any)
                    .select('id, coach_id')
                    .eq('auth_user_id', user.id)
                    .single();

                if (!student) throw new Error("Student not found");

                const { data: workout }: { data: any; error: any } = await supabase
                    .from('assigned_workouts' as any)
                    .select('assigned_program_id')
                    .eq('id', workoutId)
                    .single();

                if (!workout?.assigned_program_id || !student.coach_id) {
                    throw new Error(`Missing required fields: assigned_program_id=${workout?.assigned_program_id}, coach_id=${student.coach_id}`);
                }

                const fallbackPayload: Record<string, any> = {
                    student_id: student.id,
                    trainer_id: student.coach_id,
                    assigned_workout_id: workoutId,
                    assigned_program_id: workout.assigned_program_id,
                    status: 'completed',
                    started_at: new Date(startTime).toISOString(),
                    completed_at: now,
                    duration_seconds: durationSeconds,
                    sync_status: 'synced',
                    rpe: rpe || null,
                    feedback: feedback || null,
                };
                if (preSubmissionIdRef.current) {
                    fallbackPayload.pre_workout_submission_id = preSubmissionIdRef.current;
                }
                if (postWorkoutSubmissionId) {
                    fallbackPayload.post_workout_submission_id = postWorkoutSubmissionId;
                }

                const { data: newSession, error: sessionError }: { data: any; error: any } = await supabase
                    .from('workout_sessions' as any)
                    .insert(fallbackPayload)
                    .select('id')
                    .single();

                if (sessionError) throw sessionError;
                currentSessionId = newSession.id;
            } else {
                // Update existing in_progress session to completed
                const updatePayload: Record<string, any> = {
                    status: 'completed',
                    // A14: preserva o started_at real da sessão reanexada; só usa o
                    // mount como fallback para sessões criadas nesta montagem.
                    started_at: sessionStartedAtRef.current ?? new Date(startTime).toISOString(),
                    completed_at: now,
                    duration_seconds: durationSeconds,
                    rpe: rpe || null,
                    feedback: feedback || null,
                };
                if (postWorkoutSubmissionId) {
                    updatePayload.post_workout_submission_id = postWorkoutSubmissionId;
                }

                const { error: updateError } = await supabase
                    .from('workout_sessions' as any)
                    .update(updatePayload)
                    .eq('id', currentSessionId);

                if (updateError) throw updateError;
            }

            // Upsert any remaining set_logs (catch-up for sets that may not have been persisted)
            const setLogs: any[] = [];
            for (const exercise of exercises) {
                // Cardio items: persist a single set_log with config data in notes
                if (exercise.item_type === 'cardio' && exercise.setsData.length > 0 && exercise.setsData[0].completed) {
                    const config = exercise.item_config || {};
                    const notesJson = JSON.stringify({
                        mode: config.mode || 'continuous',
                        equipment: config.equipment,
                        duration_minutes: config.duration_minutes,
                        distance_km: config.distance_km,
                        intensity: config.intensity,
                        intervals: config.intervals,
                        actual_duration_seconds: config.actual_duration_seconds,
                        completed_rounds: config.completed_rounds,
                    });
                    setLogs.push({
                        workout_session_id: currentSessionId,
                        assigned_workout_item_id: exercise.id,
                        // Cardio items have no library exercise — coalesce empty ids to
                        // NULL so the UUID columns don't reject '' (was breaking finish
                        // whenever a completed cardio was in the workout).
                        planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id || null,
                        executed_exercise_id: exercise.exercise_id || null,
                        swap_source: exercise.swap_source || 'none',
                        exercise_id: exercise.exercise_id || null,
                        set_number: 1,
                        weight: 0,
                        reps_completed: 1,
                        is_completed: true,
                        completed_at: now,
                        weight_unit: 'kg',
                        notes: notesJson,
                    });
                    continue;
                }

                // Warmup items: visual-only, no persistence
                if (exercise.item_type === 'warmup') continue;

                for (let i = 0; i < exercise.setsData.length; i++) {
                    const set = exercise.setsData[i];
                    if (set.completed) {
                        setLogs.push({
                            workout_session_id: currentSessionId,
                            assigned_workout_item_id: exercise.id,
                            planned_exercise_id: exercise.planned_exercise_id || exercise.exercise_id,
                            executed_exercise_id: exercise.exercise_id,
                            swap_source: exercise.swap_source || 'none',
                            exercise_id: exercise.exercise_id,
                            set_number: i + 1,
                            weight: parseFloat(set.weight) || 0,
                            reps_completed: parseInt(set.reps) || 0,
                            is_completed: true,
                            completed_at: now,
                            weight_unit: 'kg',
                        });
                    }
                }
            }

            if (setLogs.length > 0) {
                const { error: logsError } = await supabase
                    .from('set_logs' as any)
                    .upsert(setLogs, {
                        onConflict: 'workout_session_id,assigned_workout_item_id,set_number',
                    });

                if (logsError) {
                    console.error('[useWorkoutSession] Error upserting set_logs at finish:', __DEV__ ? logsError : '');
                    // C3: NÃO concluir um treino com séries faltando. Reverte a
                    // sessão para in_progress (best-effort) e lança — o executeFinish
                    // mantém a tela e o aluno re-finaliza. O upsert é idempotente
                    // (onConflict), então a re-tentativa re-sincroniza tudo.
                    try {
                        await supabase
                            .from('workout_sessions' as any)
                            .update({ status: 'in_progress', completed_at: null })
                            .eq('id', currentSessionId);
                    } catch { /* best-effort */ }
                    throw logsError;
                }
            }

            // S4: treino durável no banco — o snapshot local cumpriu seu papel.
            // (No caminho de erro do C3 acima, o snapshot fica vivo de propósito.)
            hasFinishedRef.current = true;
            clearWorkoutState(workoutId);
            // A4: o catch-up idempotente acima re-enviou todas as séries — a fila
            // desta sessão ficou obsoleta (drenar depois duplicaria trabalho à toa).
            if (currentSessionId) clearPendingSetLogsForSession(currentSessionId);

            if (__DEV__) console.log(`[useWorkoutSession] Workout finished. Session: ${currentSessionId}, sets: ${setLogs.length}`);

            // Notify Watch that workout was finished from iPhone so it clears its
            // mirrored state AND ends the HealthKit session it may have started.
            // Reliable: queued via transferUserInfo if the Watch isn't reachable
            // right now (it still has background runtime while its HK session runs).
            if (Platform.OS === 'ios') {
              try {
                const { sendReliableToWatch } = require('../modules/watch-connectivity/src/WatchConnectivityModule');
                sendReliableToWatch({
                  type: 'WORKOUT_FINISHED_FROM_PHONE',
                  payload: { workoutId },
                });
                if (__DEV__) console.log('[useWorkoutSession] Notified Watch of finish');
              } catch (e: any) {
                if (__DEV__) console.log('[useWorkoutSession] Could not notify Watch:', e?.message);
              }
            }

            return currentSessionId;

        } catch (error: any) {
            if (__DEV__) console.error("Error finishing workout:", error);
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleCardioComplete = (exerciseId: string, completed: boolean, extraData?: Record<string, any>) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const idx = newExercises.findIndex(e => e.id === exerciseId);
            if (idx === -1) return prev;

            const exercise = { ...newExercises[idx] };
            if (completed) {
                exercise.setsData = [{ weight: '0', reps: '1', completed: true }];
                // Store actual execution data for serialization at finishWorkout
                if (extraData) {
                    exercise.item_config = { ...(exercise.item_config || {}), ...extraData };
                }
            } else {
                exercise.setsData = [];
            }
            newExercises[idx] = exercise;
            return newExercises;
        });
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        isLoading,
        workoutName,
        exercises,
        workoutNotes,
        duration: formatTime(elapsed),
        handleSetChange,
        handleToggleSetComplete,
        applyWatchSetCompletion,
        loadSubstituteOptions,
        searchSubstituteOptions,
        swapExercise,
        finishWorkout,
        discardWorkout,
        createSession,
        assignedProgramId,
        toggleCardioComplete,
        isSubmitting
    };
}

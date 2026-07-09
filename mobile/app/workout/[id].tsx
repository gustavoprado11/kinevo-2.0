// TODO Fase C: migrar Workout Player para componentes V2 student.
// Fase 6 preservou a estrutura legacy porque WorkoutCelebration, RestTimerOverlay
// e SetRow (via ExerciseCard) têm integração profunda com useWorkoutSession,
// Live Activity, WatchConnectivity e useWorkoutFormTriggers. Swap superficial
// degradaria UX (perderia adjust-time, share modal, watch sync). A migração
// requer refatoração coordenada do hook e dos sub-componentes, fora do escopo
// "preservar funcionalidade 100%" desta fase.
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet, AppState } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ExerciseCard } from '../../components/workout/ExerciseCard';
import { SupersetGroup } from '../../components/workout/SupersetGroup';
import { WorkoutNoteCard } from '../../components/workout/WorkoutNoteCard';
import { WarmupCard } from '../../components/workout/WarmupCard';
import { CardioCard } from '../../components/workout/CardioCard';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { useStudentProfile } from '../../hooks/useStudentProfile';
import { useWatchConnectivity } from '../../hooks/useWatchConnectivity';
import { markWatchWorkoutScreenMounted, markWatchWorkoutScreenUnmounted } from '../../lib/persistWatchSetLog';
import { ChevronLeft, Info } from 'lucide-react-native';
import { WorkoutModeToggle } from '../../components/workout/WorkoutModeToggle';
import { useWorkoutViewModeStore } from '../../stores/workoutViewModeStore';
import { ExecutionExerciseCard } from '../../components/workout/ExecutionExerciseCard';
import { ExerciseSummaryRow, type ExerciseStatus } from '../../components/workout/ExerciseSummaryRow';
import { WorkoutFocusExercise } from '../../components/workout/WorkoutFocusExercise';
import { WorkoutFocusPager } from '../../components/workout/WorkoutFocusPager';
import { WorkoutFocusNav } from '../../components/workout/WorkoutFocusNav';
import { GrowingVideoPlayer, type VideoChoice } from '../../components/workout/GrowingVideoPlayer';
import { useSharedValue } from 'react-native-reanimated';
import { WorkoutFeedbackModal } from '../../components/workout/WorkoutFeedbackModal';
import { WorkoutCelebration, CelebrationData } from '../../components/workout/WorkoutCelebration';
import { ShareWorkoutModal } from '../../components/workout/ShareWorkoutModal';
import { fetchCelebrationExtras } from '../../lib/celebrationStats';
import { ExerciseVideoModal } from '../../components/workout/ExerciseVideoModal';
import { RestTimerOverlay } from '../../components/workout/RestTimerOverlay';
import { ExerciseSwapModal } from '../../components/workout/ExerciseSwapModal';
import { PreWorkoutFormSheet } from '../../components/workout/PreWorkoutFormSheet';
import { PostWorkoutFormSheet } from '../../components/workout/PostWorkoutFormSheet';
import { useWorkoutFormTriggers } from '../../hooks/useWorkoutFormTriggers';
import { supabase } from '../../lib/supabase';
import { getProgramWeek } from '@kinevo/shared/utils/schedule-projection';
import type { ExerciseSubstituteOption, ExerciseData, WorkoutNote } from '../../hooks/useWorkoutSession';
import { ShareableCardProps } from '../../components/workout/sharing/types';
import { watchFinishState } from '../../lib/finishWorkoutFromWatch';
import { appEvents, WATCH_WORKOUT_FINISHED } from '../../lib/events';
import { useV2Colors } from '../../hooks/useV2Colors';
import { usePreWorkoutDecision } from '../../hooks/usePreWorkoutDecision';
import { useHealthDashboard } from '../../hooks/useHealthDashboard';
import { PreWorkoutReadinessSheet } from '../../components/health/PreWorkoutReadinessSheet';

// Unified render list item — built once per [exercises, workoutNotes] change.
type RenderItem =
    | { type: 'exercise'; exercise: ExerciseData; globalIndex: number; orderIndex: number }
    | { type: 'superset'; exercises: ExerciseData[]; supersetId: string; supersetRestSeconds: number; globalIndices: number[]; orderIndex: number }
    | { type: 'note'; note: WorkoutNote; orderIndex: number }
    | { type: 'section_header'; label: string; orderIndex: number }
    | { type: 'warmup_cardio'; exercise: ExerciseData; orderIndex: number };

const FUNCTION_LABELS: Record<string, string> = {
    warmup: 'AQUECIMENTO',
    activation: 'ATIVAÇÃO',
    main: 'PRINCIPAL',
    accessory: 'ACESSÓRIO',
    conditioning: 'CONDICIONAMENTO',
};

export default function WorkoutPlayerScreen() {
    const colors = useV2Colors();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { profile } = useStudentProfile();

    // Live Activity rest timer trigger
    const liveActivityRef = useRef<{
        startRestTimer: (exerciseIndex: number, seconds: number) => void;
        updateTimerState: (data: import('../../hooks/useLiveActivity').TimerUpdateData) => void;
        clearTimerState: () => void;
    } | null>(null);

    // C1: aviso transitório (não-bloqueante) quando uma série é marcada sem
    // carga/reps e sem alvo/histórico pra herdar.
    const [emptySetNotice, setEmptySetNotice] = React.useState(false);
    const emptyNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onEmptySetLogged = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setEmptySetNotice(true);
        if (emptyNoticeTimerRef.current) clearTimeout(emptyNoticeTimerRef.current);
        emptyNoticeTimerRef.current = setTimeout(() => setEmptySetNotice(false), 3500);
    }, []);

    useEffect(() => () => {
        if (emptyNoticeTimerRef.current) clearTimeout(emptyNoticeTimerRef.current);
    }, []);

    const onSetComplete = useCallback((exerciseIndex: number, _setIndex: number) => {
        const exercise = exercisesRef.current[exerciseIndex];
        if (!exercise) return;

        // Superset: descanso POR EXERCÍCIO. Cada exercício usa o próprio
        // rest_seconds (0 = sem descanso → vai direto pro próximo). No ÚLTIMO
        // exercício do grupo o descanso é "após a rodada": só dispara se ainda
        // houver rodada por fazer (evita timer sobrando no fim do superset).
        if (exercise.supersetId) {
            const restSeconds = exercise.rest_seconds;
            if (restSeconds > 0) {
                const supersetExercises = exercisesRef.current.filter(
                    (e) => e.supersetId === exercise.supersetId
                );
                const isLastInGroup = supersetExercises[supersetExercises.length - 1]?.id === exercise.id;
                const hasRemainingRounds = supersetExercises.some(
                    (e) => e.setsData.some((s, i) => i > _setIndex && !s.completed)
                );
                // Entre exercícios há sempre um próximo na rodada; no último,
                // só descansa se houver rodada seguinte.
                if (!isLastInGroup || hasRemainingRounds) {
                    liveActivityRef.current?.startRestTimer(exerciseIndex, restSeconds);
                    setRestTimer({
                        endTime: Date.now() + restSeconds * 1000,
                        totalSeconds: restSeconds,
                        exerciseName: exercise.name,
                    });
                }
            }
            return;
        }

        // Normal exercise: usa rest_seconds per-set quando há setScheme
        // (drop-set/cluster têm descansos diferentes por fase — usar o
        // agregado dispara timer mesmo quando o trainer prescreveu 0s entre
        // drops). Fallback pro agregado em programas legados sem scheme.
        const perSetRest = exercise.setScheme?.[_setIndex]?.rest_seconds;
        const restSeconds =
            typeof perSetRest === 'number' ? perSetRest : exercise.rest_seconds;

        if (restSeconds > 0) {
            const hasRemainingSets = exercise.setsData.some((s, i) => i > _setIndex && !s.completed);
            if (hasRemainingSets) {
                liveActivityRef.current?.startRestTimer(exerciseIndex, restSeconds);
                setRestTimer({
                    endTime: Date.now() + restSeconds * 1000,
                    totalSeconds: restSeconds,
                    exerciseName: exercise.name,
                });
            }
        }
    }, []);

    const {
        isLoading,
        workoutName,
        exercises,
        workoutNotes,
        duration,
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
    } = useWorkoutSession(id as string, { onSetComplete, onEmptySetLogged, deferSessionCreation: true });

    // Form triggers for pre/post workout check-in
    const {
        preWorkoutTrigger,
        postWorkoutTrigger,
        isLoading: triggersLoading,
    } = useWorkoutFormTriggers(assignedProgramId);

    // Pre/post checkin state
    const [preCheckinState, setPreCheckinState] = React.useState<'pending' | 'showing' | 'completed' | 'skipped'>('pending');
    const [postCheckinState, setPostCheckinState] = React.useState<'idle' | 'showing' | 'completed' | 'skipped'>('idle');
    const [preSubmissionId, setPreSubmissionId] = React.useState<string | null>(null);
    const [postSubmissionId, setPostSubmissionId] = React.useState<string | null>(null);
    // Stash feedback data while post-checkin is showing
    const pendingFeedbackRef = React.useRef<{ rpe: number; feedback: string } | null>(null);

    // Fase 14c — Pré-treino Readiness Sheet. Mostra ANTES da criação de
    // workout_session se há readinessData. "Reagendar" volta sem criar
    // nenhum row. "Treinar mesmo assim" libera o fluxo normal.
    const { shouldShowSheet: shouldShowReadinessSheet, readinessData, isLoading: readinessLoading } =
        usePreWorkoutDecision(id as string);
    const { data: healthDashboard } = useHealthDashboard();
    const [readinessDecided, setReadinessDecided] = React.useState(false);
    const [readinessSheetVisible, setReadinessSheetVisible] = React.useState(false);

    React.useEffect(() => {
        if (readinessLoading || readinessDecided) return;
        if (shouldShowReadinessSheet) {
            setReadinessSheetVisible(true);
        } else {
            // Sem readiness data → segue direto sem sheet
            setReadinessDecided(true);
        }
    }, [readinessLoading, readinessDecided, shouldShowReadinessSheet]);

    const handleReadinessProceed = React.useCallback(() => {
        if (__DEV__) console.log('[PreWorkoutReadiness] proceed tapped');
        setReadinessSheetVisible(false);
        setReadinessDecided(true);
    }, []);

    const handleReadinessReschedule = React.useCallback(() => {
        if (__DEV__) console.log('[PreWorkoutReadiness] reschedule tapped');
        setReadinessSheetVisible(false);
        // NÃO criar workout_session — apenas volta pra Home
        router.back();
    }, [router]);

    // Auto-show pre-checkin or create session when triggers are resolved.
    // Gate adicional: NÃO criar session enquanto Pré-treino Sheet pendente.
    const sessionCreatedRef = React.useRef(false);

    // Cria a sessão e, se falhar (offline/dados faltando), avisa o aluno em vez
    // de deixá-lo treinar uma "sessão fantasma" que não grava nada.
    const ensureSession = React.useCallback(async (submissionId?: string) => {
        const sid = await createSession(submissionId);
        if (!sid) {
            sessionCreatedRef.current = false; // libera nova tentativa
            // A4: mensagem específica quando a causa é falta de rede — o aluno
            // sabe exatamente o que fazer em vez de um erro genérico.
            let offline = false;
            try {
                const NetInfo = require("@react-native-community/netinfo").default;
                const state = await NetInfo.fetch();
                offline = state.isConnected === false;
            } catch { /* NetInfo indisponível — mantém mensagem genérica */ }
            Alert.alert(
                offline ? "Sem conexão" : "Não foi possível iniciar o treino",
                offline
                    ? "Você está offline. Conecte-se à internet para iniciar o treino — séries de um treino já iniciado ficam guardadas e sincronizam sozinhas."
                    : "Verifique sua conexão e tente novamente.",
                [{ text: "Voltar", onPress: () => router.back() }],
            );
        }
        return sid;
    }, [createSession, router]);

    React.useEffect(() => {
        if (isLoading || triggersLoading || sessionCreatedRef.current) return;
        if (!readinessDecided) return; // Espera decisão da readiness sheet

        if (preWorkoutTrigger && preCheckinState === 'pending') {
            setPreCheckinState('showing');
        } else if (!preWorkoutTrigger && preCheckinState === 'pending') {
            // No pre-workout trigger — create session immediately
            sessionCreatedRef.current = true;
            ensureSession();
        }
    }, [isLoading, triggersLoading, preWorkoutTrigger, preCheckinState, readinessDecided]);

    // Keep a ref to exercises for the onSetComplete callback
    const exercisesRef = useRef(exercises);
    exercisesRef.current = exercises;

    // Live Activity hook
    const { startRestTimer, updateTimerState, clearTimerState, stopActivity } = useLiveActivity({
        workoutName,
        workoutId: id as string,
        exercises,
        studentName: profile?.name ?? 'Aluno',
        isLoading,
    });

    // Expose startRestTimer to onSetComplete callback via ref
    useEffect(() => {
        liveActivityRef.current = { startRestTimer, updateTimerState, clearTimerState };
    }, [startRestTimer, updateTimerState, clearTimerState]);

    // A2: while this screen is mounted it persists Watch set completions itself, so
    // the root-level safety net in _layout.tsx must stand down for this workout.
    useEffect(() => {
        markWatchWorkoutScreenMounted(id as string);
        return () => markWatchWorkoutScreenUnmounted(id as string);
    }, [id]);

    // Apple Watch connectivity
    // Note: FINISH_WORKOUT is handled at root level (_layout.tsx → finishWorkoutFromWatch)
    // so it works even when this screen is not mounted (app killed during workout).
    useWatchConnectivity({
        onWatchSetComplete: ({ workoutId, exerciseId, exerciseIndex, setIndex, reps, weight }) => {
            if (workoutId && workoutId !== (id as string)) {
                return;
            }

            if (__DEV__) console.log(
                `[WorkoutScreen] Watch reported set complete: exercise ${exerciseId ?? exerciseIndex}, set ${setIndex}, reps ${reps ?? '-'}, weight ${weight ?? '-'}`
            );
            // A1: pass the exerciseId so the set lands on the right exercise even if
            // the program was reordered mid-workout (index alone can be stale).
            applyWatchSetCompletion(exerciseIndex, setIndex, reps, weight, exerciseId);
        },
        onWatchCardioComplete: ({ workoutId, itemId, elapsedSeconds }) => {
            if (workoutId && workoutId !== (id as string)) {
                return;
            }

            if (__DEV__) console.log(
                `[WorkoutScreen] Watch reported cardio complete: itemId ${itemId}, elapsed ${elapsedSeconds}s`
            );
            toggleCardioComplete(itemId, true, { elapsedSeconds });
        },
    });

    // Notify Watch to auto-start this workout when data is loaded (once per screen mount).
    // v2 program snapshot (with all workouts) is synced by WatchBridge in _layout.tsx —
    // we no longer send v1 workout snapshots here to avoid overwriting the v2 context.
    const watchStartSentRef = useRef(false);

    useEffect(() => {
        if (!isLoading && exercises.length > 0 && !watchStartSentRef.current && Platform.OS === 'ios') {
            watchStartSentRef.current = true;
            const { sendReliableToWatch } = require('../../modules/watch-connectivity/src/WatchConnectivityModule');
            // Reliable: delivered immediately when the Watch app is reachable (so it
            // starts the live workout session right away), and queued via
            // transferUserInfo otherwise (so it auto-starts when the user next opens it).
            sendReliableToWatch({
                type: 'START_WORKOUT_FROM_PHONE',
                payload: { workoutId: id as string },
            });
        }
    }, [isLoading, exercises, id]);

    const navigation = useNavigation();
    const isFinishingRef = useRef(false);
    const [isFeedbackVisible, setIsFeedbackVisible] = React.useState(false);
    const [showCelebration, setShowCelebration] = React.useState(false);
    const [celebrationData, setCelebrationData] = React.useState<CelebrationData | undefined>(undefined);
    const [showShareModal, setShowShareModal] = React.useState(false);
    const [videoModalUrl, setVideoModalUrl] = React.useState<string | null>(null);
    const [swapModalVisible, setSwapModalVisible] = React.useState(false);
    const [swapModalLoading, setSwapModalLoading] = React.useState(false);
    const [swapOptions, setSwapOptions] = React.useState<ExerciseSubstituteOption[]>([]);
    const [swapSearchQuery, setSwapSearchQuery] = React.useState('');
    const [swapSearchResults, setSwapSearchResults] = React.useState<ExerciseSubstituteOption[]>([]);
    const [swapSearchLoading, setSwapSearchLoading] = React.useState(false);
    const [activeSwapIndex, setActiveSwapIndex] = React.useState<number | null>(null);
    const [restTimer, setRestTimer] = React.useState<{
        endTime: number;
        totalSeconds: number;
        exerciseName: string;
    } | null>(null);

    const insets = useSafeAreaInsets();

    const { completedSets, totalSets } = useMemo(() => {
        let completed = 0;
        let total = 0;
        exercises.forEach(ex => {
            total += ex.setsData.length;
            completed += ex.setsData.filter(s => s.completed).length;
        });
        return { completedSets: completed, totalSets: total };
    }, [exercises]);

    const allSetsCompleted = totalSets > 0 && completedSets === totalSets;

    // Preferência de modo de execução (lista/foco), persistida por device (MMKV).
    // Fase 1: só o cabeçalho/toggle entram; os dois segmentos ainda renderizam a
    // mesma lista. O branching lista×foco vem nas Fases 2-4.
    const viewMode = useWorkoutViewModeStore((s) => s.mode);
    const setViewMode = useWorkoutViewModeStore((s) => s.setMode);

    // Barra de conclusão por EXERCÍCIO (D4): um exercício = todas as séries
    // completas. Aquecimento (setsData vazio) e cardio ainda não engajado não
    // contam. O gate de "Finalizar" segue por SÉRIES (allSetsCompleted, invariante).
    const { doneExercises, totalExercises } = useMemo(() => {
        let done = 0;
        let total = 0;
        exercises.forEach(ex => {
            if (ex.setsData.length === 0) return;
            total += 1;
            if (ex.setsData.every(s => s.completed)) done += 1;
        });
        return { doneExercises: done, totalExercises: total };
    }, [exercises]);

    // Perf: the workout list re-renders on every keystroke because setExercises
    // (useWorkoutSession) replaces the array. The memoized cards only skip
    // re-render when their callback props keep a stable identity. handleSetChange/
    // handleToggleSetComplete come from the hook and are recreated each render,
    // so we route them through refs and expose stable wrappers that always call
    // the latest hook function. Result: only the edited card re-renders.
    const handleSetChangeRef = useRef(handleSetChange);
    handleSetChangeRef.current = handleSetChange;
    const handleToggleSetCompleteRef = useRef(handleToggleSetComplete);
    handleToggleSetCompleteRef.current = handleToggleSetComplete;

    const onSetChangeStable = useCallback(
        (globalIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
            handleSetChangeRef.current(globalIndex, setIndex, field, value);
        },
        [],
    );
    const onToggleSetCompleteStable = useCallback(
        (globalIndex: number, setIndex: number) => {
            handleToggleSetCompleteRef.current(globalIndex, setIndex);
        },
        [],
    );
    const onVideoPressStable = useCallback((url: string) => {
        setVideoModalUrl(url);
    }, []);

    const openSwapModal = useCallback(async (exerciseIndex: number) => {
        setActiveSwapIndex(exerciseIndex);
        setSwapModalVisible(true);
        setSwapModalLoading(true);
        setSwapOptions([]);
        setSwapSearchQuery('');
        setSwapSearchResults([]);
        setSwapSearchLoading(false);

        try {
            const options = await loadSubstituteOptions(exerciseIndex);
            setSwapOptions(options);
        } catch (error) {
            if (__DEV__) console.error('Error loading substitute options:', error);
            Alert.alert('Erro', 'Nao foi possivel carregar as opcoes de troca.');
        } finally {
            setSwapModalLoading(false);
        }
    }, [loadSubstituteOptions]);

    const applySwap = async (option: ExerciseSubstituteOption, forceReset = false) => {
        if (activeSwapIndex === null) return;

        const result = await swapExercise(activeSwapIndex, option, forceReset);
        if (result.success) {
            setSwapModalVisible(false);
            setSwapOptions([]);
            setSwapSearchQuery('');
            setSwapSearchResults([]);
            return;
        }

        if (result.requiresConfirmation) {
            Alert.alert(
                'Resetar series deste exercicio?',
                'Algumas series ja foram concluidas. A troca vai limpar peso/repeticoes para esse exercicio.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Trocar e resetar', style: 'destructive', onPress: () => applySwap(option, true) },
                ]
            );
            return;
        }

        Alert.alert('Erro', result.message || 'Nao foi possivel trocar o exercicio.');
    };

    useEffect(() => {
        if (!swapModalVisible || activeSwapIndex === null) return;

        const query = swapSearchQuery.trim();
        if (query.length < 2) {
            setSwapSearchResults([]);
            setSwapSearchLoading(false);
            return;
        }

        let cancelled = false;
        setSwapSearchLoading(true);

        const timeout = setTimeout(async () => {
            try {
                const results = await searchSubstituteOptions(activeSwapIndex, query);
                if (cancelled) return;

                const suggestionIds = new Set(swapOptions.map((option) => option.id));
                setSwapSearchResults(results.filter((option) => !suggestionIds.has(option.id)));
            } catch (error) {
                if (!cancelled) {
                    if (__DEV__) console.error('Error searching substitute options:', error);
                    setSwapSearchResults([]);
                }
            } finally {
                if (!cancelled) {
                    setSwapSearchLoading(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [swapSearchQuery, swapModalVisible, activeSwapIndex, swapOptions]);

    // Protect against accidental exit
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (isSubmitting || isFinishingRef.current || watchFinishState.isFinished(id as string)) {
                // Allow navigation if submitting, finishing successfully,
                // or workout was saved from Apple Watch at root level.
                return;
            }

            // Prevent default behavior of leaving the screen
            e.preventDefault();

            // Prompt the user before leaving the screen
            Alert.alert(
                'Descartar Treino?',
                'Se você sair agora, todo o progresso atual será perdido.',
                [
                    { text: 'Continuar Treinando', style: 'cancel', onPress: () => { } },
                    {
                        text: 'Descartar e Sair',
                        style: 'destructive',
                        onPress: () => {
                            // A1: descarta DE VERDADE — apaga os set_logs persistidos e
                            // abandona a sessão. Fire-and-forget: a navegação não espera
                            // a rede; se a limpeza falhar (ex. offline), a rehidratação
                            // do reattach (A2) ao menos torna as séries visíveis em vez
                            // de contaminarem o próximo finish silenciosamente.
                            discardWorkout();
                            // Tell the Watch to end its mirrored HealthKit session
                            // WITHOUT saving (workout was abandoned, not completed).
                            if (Platform.OS === 'ios') {
                                try {
                                    const { sendReliableToWatch } = require('../../modules/watch-connectivity/src/WatchConnectivityModule');
                                    sendReliableToWatch({
                                        type: 'WORKOUT_DISCARDED_FROM_PHONE',
                                        payload: { workoutId: id as string },
                                    });
                                } catch { /* Watch not available — non-critical */ }
                            }
                            navigation.dispatch(e.data.action);
                        },
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation, isSubmitting]);

    // Listen for Watch-initiated finish — stop timer & allow the navigation
    // that _layout.tsx triggers via router.replace('/(tabs)/home').
    useEffect(() => {
        const handler = ({ workoutId }: { workoutId: string }) => {
            if (workoutId !== (id as string)) return;

            if (__DEV__) console.log(`[WorkoutScreen] WATCH_WORKOUT_FINISHED received for ${workoutId} — marking as finished`);

            // Mark as finishing so the beforeRemove guard allows navigation
            isFinishingRef.current = true;

            // Stop the Live Activity
            stopActivity();
        };

        appEvents.on(WATCH_WORKOUT_FINISHED, handler);
        return () => { appEvents.off(WATCH_WORKOUT_FINISHED, handler); };
    }, [id, stopActivity]);

    // ── Pre-workout check-in handlers ──
    const handlePreCheckinSubmit = useCallback(async (answers: Record<string, any>) => {
        if (!preWorkoutTrigger || !assignedProgramId || !profile?.id || !profile?.coach_id) return;

        try {
            const { data, error }: { data: any; error: any } = await supabase.rpc(
                'submit_inline_form' as any,
                {
                    p_form_template_id: preWorkoutTrigger.formTemplateId,
                    p_student_id: profile.id,
                    p_trainer_id: profile.coach_id,
                    p_answers_json: { answers },
                    p_trigger_context: 'pre_workout',
                }
            );

            if (error) throw error;
            const result = data as { ok: boolean; submission_id: string };
            if (!result?.ok) throw new Error('Submission failed');

            setPreSubmissionId(result.submission_id);
            setPreCheckinState('completed');
            sessionCreatedRef.current = true;
            await ensureSession(result.submission_id);
        } catch (err: any) {
            if (__DEV__) console.error('[PreCheckin] Submit error:', err?.message);
            // Don't block the workout — skip and continue
            Alert.alert('Erro ao enviar', 'O check-in falhou. Continuando o treino.', [
                {
                    text: 'OK',
                    onPress: () => {
                        setPreCheckinState('skipped');
                        sessionCreatedRef.current = true;
                        ensureSession();
                    },
                },
            ]);
        }
    }, [preWorkoutTrigger, assignedProgramId, ensureSession, profile]);

    const handlePreCheckinSkip = useCallback(() => {
        setPreCheckinState('skipped');
        sessionCreatedRef.current = true;
        ensureSession();
    }, [ensureSession]);

    // ── Post-workout check-in handlers ──
    // Use a ref-based approach to avoid circular dependency with handleConfirmFinish
    const executeFinishRef = useRef<(rpe: number, feedback: string, pSubmissionId?: string) => void>(undefined);

    const handlePostCheckinSubmit = useCallback(async (answers: Record<string, any>) => {
        if (!postWorkoutTrigger || !profile?.id || !profile?.coach_id) return;

        try {
            const { data, error }: { data: any; error: any } = await supabase.rpc(
                'submit_inline_form' as any,
                {
                    p_form_template_id: postWorkoutTrigger.formTemplateId,
                    p_student_id: profile.id,
                    p_trainer_id: profile.coach_id,
                    p_answers_json: { answers },
                    p_trigger_context: 'post_workout',
                }
            );

            if (error) throw error;
            const result = data as { ok: boolean; submission_id: string };
            if (!result?.ok) throw new Error('Submission failed');

            setPostSubmissionId(result.submission_id);
            setPostCheckinState('completed');

            if (pendingFeedbackRef.current) {
                const { rpe, feedback } = pendingFeedbackRef.current;
                pendingFeedbackRef.current = null;
                executeFinishRef.current?.(rpe, feedback, result.submission_id);
            }
        } catch (err: any) {
            if (__DEV__) console.error('[PostCheckin] Submit error:', err?.message);
            setPostCheckinState('skipped');
            if (pendingFeedbackRef.current) {
                const { rpe, feedback } = pendingFeedbackRef.current;
                pendingFeedbackRef.current = null;
                executeFinishRef.current?.(rpe, feedback);
            }
        }
    }, [postWorkoutTrigger, profile]);

    const handlePostCheckinSkip = useCallback(() => {
        setPostCheckinState('skipped');
        if (pendingFeedbackRef.current) {
            const { rpe, feedback } = pendingFeedbackRef.current;
            pendingFeedbackRef.current = null;
            executeFinishRef.current?.(rpe, feedback);
        }
    }, []);

    const handleFinish = () => {
        // Open feedback modal instead of alert
        setIsFeedbackVisible(true);
    };

    const [successData, setSuccessData] = React.useState<ShareableCardProps & { sessionId?: string } | undefined>(undefined);

    // Core finish logic — called directly or via post-checkin flow
    const executeFinish = async (rpe: number, feedback: string, pSubmissionId?: string) => {
        try {
            const success = await finishWorkout(rpe, feedback, pSubmissionId || postSubmissionId || undefined);
            if (success) {
                // Stop Live Activity immediately
                stopActivity();

                // Calculate Stats for Shareable Card
                // Volume só filtra pra 'main' quando algum exercício foi marcado
                // como 'main'. Treinos sem categorização (ou só com accessory)
                // contam tudo — senão o volume aparece como 0 no card de share.
                let totalVolume = 0;
                let completedExercisesCount = 0;
                const hasMain = exercises.some(ex => ex.exerciseFunction === 'main');

                exercises.forEach(ex => {
                    // Check if at least one set is completed
                    const hasCompletedSet = ex.setsData.some(s => s.completed);
                    if (hasCompletedSet) completedExercisesCount++;

                    const countsForVolume = !hasMain || ex.exerciseFunction === 'main';
                    if (countsForVolume) {
                        ex.setsData.forEach(s => {
                            if (s.completed) {
                                const weight = parseFloat(s.weight) || 0;
                                const reps = parseInt(s.reps) || 0;
                                totalVolume += weight * reps;
                            }
                        });
                    }
                });

                // Calculate Max Loads for Sharing
                const exerciseMaxes: Record<string, { weight: number, reps: number, name: string }> = {};
                exercises.forEach(ex => {
                    const maxWeightSet = ex.setsData
                        .filter(s => s.completed)
                        .reduce((max, current) => {
                            const wCurrent = parseFloat(current.weight) || 0;
                            const wMax = parseFloat(max.weight) || 0;
                            return wCurrent > wMax ? current : max;
                        }, { weight: '0', reps: '0', completed: false });

                    if (parseFloat(maxWeightSet.weight) > 0) {
                        // Only consider if valid weight
                        const w = parseFloat(maxWeightSet.weight);
                        if (!exerciseMaxes[ex.name] || w > exerciseMaxes[ex.name].weight) {
                            exerciseMaxes[ex.name] = {
                                weight: w,
                                reps: parseInt(maxWeightSet.reps) || 0,
                                name: ex.name
                            };
                        }
                    }
                });

                const maxLoads = Object.values(exerciseMaxes)
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 3)
                    .map(item => ({
                        exerciseName: item.name,
                        weight: item.weight,
                        reps: item.reps,
                        isPr: false
                    }));

                // Build exercise details for full workout template
                const exerciseDetails = exercises
                    .filter(ex => ex.setsData.some(s => s.completed))
                    .map(ex => {
                        const completedSets = ex.setsData.filter(s => s.completed);
                        const maxWeight = Math.max(...completedSets.map(s => parseFloat(s.weight) || 0));
                        const maxReps = Math.max(...completedSets.map(s => parseInt(s.reps) || 0));
                        return {
                            name: ex.name,
                            sets: completedSets.length,
                            reps: maxReps,
                            weight: maxWeight,
                        };
                    });

                // Semana do programa p/ o chip "SEMANA X/Y" do card Lista (T4).
                // Best-effort: 2 queries leves; qualquer falha → sem chip, não bloqueia.
                let programWeek: { current: number; total: number } | undefined;
                try {
                    const { data: sessRow } = await supabase
                        .from('workout_sessions' as any)
                        .select('assigned_program_id')
                        .eq('id', success)
                        .maybeSingle();
                    const pid = (sessRow as any)?.assigned_program_id;
                    if (pid) {
                        const { data: prog } = await supabase
                            .from('assigned_programs' as any)
                            .select('started_at, duration_weeks')
                            .eq('id', pid)
                            .maybeSingle();
                        const startedAt = (prog as any)?.started_at;
                        const total = (prog as any)?.duration_weeks;
                        if (startedAt && total) {
                            const wk = getProgramWeek(new Date(), startedAt, total);
                            if (wk) programWeek = { current: wk, total };
                        }
                    }
                } catch (err) {
                    if (__DEV__) console.error('[workout] programWeek fetch failed:', err);
                }

                setSuccessData({
                    workoutName: workoutName,
                    duration: duration,
                    exerciseCount: completedExercisesCount,
                    volume: totalVolume,
                    date: new Date().toLocaleDateString('pt-BR'),
                    studentName: profile?.name || 'Aluno Kinevo',
                    coach: profile?.coach || null,
                    completedSets,
                    totalSets,
                    rpe,
                    maxLoads: maxLoads,
                    exerciseDetails: exerciseDetails,
                    sessionId: success,
                    programWeek,
                });

                // Extras que ativam os badges da celebração (PR / streak / delta de
                // volume). Best-effort e awaited ANTES de exibir, pra entrarem na
                // animação inicial. Qualquer falha → 0 (badges não renderizam).
                const extras = await fetchCelebrationExtras({
                    sessionId: success,
                    studentId: profile?.id,
                    workoutName,
                    currentVolume: totalVolume,
                });

                // Set celebration data (summary for the celebration screen)
                setCelebrationData({
                    duration,
                    completedSets,
                    totalSets,
                    totalVolume,
                    rpe,
                    workoutName,
                    endDate: new Date(),
                    coach: profile?.coach
                        ? { name: profile.coach.name, initial: (profile.coach.name || 'K').charAt(0).toUpperCase() }
                        : undefined,
                    prCount: extras.prCount,
                    streakDays: extras.streakDays,
                    deltaVolumePct: extras.deltaVolumePct,
                });

                // Show full-screen celebration animation first
                setShowCelebration(true);
                // Mark as finishing so we can navigate away later
                isFinishingRef.current = true;
            }
        } catch (error: any) {
            // Mantém o aluno na tela com o treino preservado para tentar de novo
            // (ex.: queda de conexão). Nada é perdido — basta refinalizar.
            if (__DEV__) console.error("[workout] executeFinish error:", error?.message);
            Alert.alert(
                "Não foi possível finalizar",
                "Verifique sua conexão e toque em finalizar novamente. Seu treino não foi perdido.",
            );
        }
    };

    // Register the finish function so post-checkin handlers can call it
    executeFinishRef.current = executeFinish;

    // Wrapper called from FeedbackModal — may intercept to show post-checkin
    const handleConfirmFinish = async (rpe: number, feedback: string) => {
        setIsFeedbackVisible(false);

        // If there's a post-workout trigger we haven't shown yet, intercept
        if (postWorkoutTrigger && postCheckinState === 'idle') {
            pendingFeedbackRef.current = { rpe, feedback };
            setPostCheckinState('showing');
            return;
        }

        // No post-checkin needed — proceed directly
        executeFinish(rpe, feedback);
    };

    // "Fechar" na celebração → volta direto pra home. Antes abria o
    // WorkoutSuccessModal (segunda tela "Treino concluído"), removido por
    // ser redundante com a própria celebração (mesmas stats + share).
    const handleCelebrationComplete = useCallback(() => {
        setShowCelebration(false);
        router.replace('/(tabs)/home');
    }, [router]);

    // CTA "Compartilhar conquista" da celebração → abre o share direto.
    // Os dados já estão em successData.
    const handleCelebrationShare = useCallback(() => {
        setShowCelebration(false);
        setShowShareModal(true);
    }, []);

    const handleShareClose = useCallback(() => {
        setShowShareModal(false);
        router.replace('/(tabs)/home');
    }, [router]);

    // Perf: build the unified render list (forEach + map + filter + sort +
    // section headers — O(n) and O(n²) per superset) only when exercises or
    // workoutNotes change, not on every keystroke. Logic identical to the old
    // inline IIFE; only the memoization wrapper is new.
    const renderList = useMemo<RenderItem[]>(() => {
        const renderItems: RenderItem[] = [];
        const processedSupersets = new Set<string>();

        exercises.forEach((exercise, globalIndex) => {
            // Warmup/Cardio items — render as special cards
            if (exercise.item_type === 'warmup' || exercise.item_type === 'cardio') {
                renderItems.push({
                    type: 'warmup_cardio',
                    exercise,
                    orderIndex: exercise.order_index,
                });
                return;
            }

            if (exercise.supersetId) {
                if (processedSupersets.has(exercise.supersetId)) return;
                processedSupersets.add(exercise.supersetId);

                const group = exercises
                    .map((e, i) => ({ ...e, _globalIndex: i }))
                    .filter((e) => e.supersetId === exercise.supersetId);

                // Use the first child's order_index - 1 to approximate parent superset position
                // (superset parent always comes before its children in order_index)
                const groupOrderIndex = (group[0].supersetOrderIndex ?? Math.min(...group.map((e) => e.order_index))) - 0.5;

                renderItems.push({
                    type: 'superset',
                    exercises: group,
                    supersetId: exercise.supersetId,
                    supersetRestSeconds: exercise.supersetRestSeconds || 60,
                    globalIndices: group.map((e) => e._globalIndex),
                    orderIndex: groupOrderIndex,
                });
            } else {
                renderItems.push({
                    type: 'exercise',
                    exercise,
                    globalIndex,
                    orderIndex: exercise.order_index,
                });
            }
        });

        // Add workout notes into the unified list
        workoutNotes.forEach((note) => {
            renderItems.push({ type: 'note', note, orderIndex: note.order_index });
        });

        // Sort by order_index so items appear in the trainer-defined order
        renderItems.sort((a, b) => a.orderIndex - b.orderIndex);

        // Insert section headers when exercise_function changes between consecutive items
        const hasAnyFunction = exercises.some(e => e.exerciseFunction);
        const finalItems: RenderItem[] = [];

        if (hasAnyFunction) {
            let lastFunction: string | null | undefined = undefined;
            for (const item of renderItems) {
                // Determine this item's exercise function
                let itemFunction: string | null | undefined = null;
                if (item.type === 'exercise') {
                    itemFunction = item.exercise.exerciseFunction;
                } else if (item.type === 'superset') {
                    // Use first child's function for the superset
                    itemFunction = item.exercises[0]?.exerciseFunction;
                }

                // Insert header if function changed (skip notes — they don't change the function)
                if (item.type !== 'note' && itemFunction && itemFunction !== lastFunction) {
                    finalItems.push({
                        type: 'section_header',
                        label: FUNCTION_LABELS[itemFunction] || itemFunction.toUpperCase(),
                        orderIndex: item.orderIndex - 0.1,
                    });
                    lastFunction = itemFunction;
                }

                finalItems.push(item);
            }
        } else {
            finalItems.push(...renderItems);
        }

        return finalItems;
    }, [exercises, workoutNotes]);

    // Fase 2 (modo Lista): número/status por item de trabalho (exercise|superset)
    // e o "atual" = primeiro item com trabalho incompleto. Deriva do renderList
    // (que já rebuilda quando exercises muda). Aquecimento/cardio/nota não contam.
    // Modo Lista = acordeão: UM card aberto por vez. `focusKey` é o exercício que
    // o aluno escolheu abrir (ex.: pular pra outro porque o equipamento está
    // ocupado). Quando null, segue o "atual" automático (primeiro não concluído),
    // então concluir um exercício abre o próximo sozinho.
    const [focusKey, setFocusKey] = React.useState<string | null>(null);
    const prevFocusDoneRef = React.useRef(false);
    const { listMeta, currentKey } = useMemo(() => {
        const meta = new Map<string, { number: number; done: boolean; started: boolean }>();
        let current: string | null = null;
        let n = 0;
        for (const it of renderList) {
            let key: string | null = null;
            let done = false;
            let started = false;
            if (it.type === 'exercise') {
                key = it.exercise.id;
                const sd = it.exercise.setsData;
                done = sd.length > 0 && sd.every((s) => s.completed);
                started = sd.some((s) => s.completed);
            } else if (it.type === 'superset') {
                key = it.supersetId;
                done = it.exercises.every((e) => e.setsData.length > 0 && e.setsData.every((s) => s.completed));
                started = it.exercises.some((e) => e.setsData.some((s) => s.completed));
            }
            if (key) {
                n += 1;
                meta.set(key, { number: n, done, started });
                if (!done && current === null) current = key;
            }
        }
        return { listMeta: meta, currentKey: current };
    }, [renderList]);

    // O card aberto: foco manual vence; sem foco, segue o atual automático.
    const expandedKey = focusKey && listMeta.has(focusKey) ? focusKey : currentKey;
    const focusExercise = (key: string) => {
        // Semeia o "done anterior" com o estado atual: abrir um já-concluído para
        // revisar não deve recolher na hora (o efeito abaixo só avança quando o
        // exercício focado ACABA de ser concluído).
        prevFocusDoneRef.current = listMeta.get(key)?.done ?? false;
        setFocusKey(key);
    };
    React.useEffect(() => {
        if (!focusKey) { prevFocusDoneRef.current = false; return; }
        const isDone = listMeta.get(focusKey)?.done ?? false;
        if (isDone && !prevFocusDoneRef.current) setFocusKey(null); // concluiu o focado → avança
        prevFocusDoneRef.current = isDone;
    }, [focusKey, listMeta]);

    // Fase 3 (modo Foco): páginas = itens de trabalho (exercise|superset|cardio/
    // aquecimento), na ordem. section_header/note não viram página.
    const focusItems = useMemo(
        () => renderList.filter((it) => it.type === 'exercise' || it.type === 'superset' || it.type === 'warmup_cardio'),
        [renderList],
    );
    const [focusIndex, setFocusIndex] = React.useState(0);
    // Fase 4: scroll da página ativa → altura do player crescente (Reanimated).
    const focusScrollY = useSharedValue(0);
    // Superset (D1): qual vídeo do filho o player mostra; reseta ao trocar de item.
    const [focusChildVideo, setFocusChildVideo] = React.useState(0);
    useEffect(() => { setFocusChildVideo(0); }, [focusIndex]);
    const enteredFocusRef = useRef(false);
    // Ao ENTRAR no modo foco, aterrissa no item atual (1º incompleto).
    useEffect(() => {
        if (viewMode === 'foco' && !enteredFocusRef.current) {
            enteredFocusRef.current = true;
            const idx = focusItems.findIndex(
                (it) => (it.type === 'exercise' && it.exercise.id === currentKey)
                    || (it.type === 'superset' && it.supersetId === currentKey),
            );
            setFocusIndex(idx >= 0 ? idx : 0);
        } else if (viewMode !== 'foco') {
            enteredFocusRef.current = false;
        }
    }, [viewMode, focusItems, currentKey]);

    if (isLoading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.canvas }}>
                    <ActivityIndicator size="large" color={colors.purple[500]} />
                    <Text style={{ color: colors.text.tertiary, marginTop: 16 }}>Carregando treino...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <Stack.Screen
                options={{
                    headerShown: false
                }}
            />

            {/* Header (redesign lista/foco) */}
            <View style={{ backgroundColor: colors.surface.card, borderBottomWidth: 1, borderBottomColor: colors.border.subtle, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 }}>
                {/* Top row: back | eyebrow+title | timer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                        style={{
                            width: 38, height: 38, borderRadius: 13,
                            backgroundColor: colors.surface.card2,
                            alignItems: 'center', justifyContent: 'center',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
                        }}
                    >
                        <ChevronLeft size={19} color={colors.text.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.purple[700], fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' }}>
                            Treino
                        </Text>
                        <Text numberOfLines={1} style={{ color: colors.text.primary, fontWeight: '800', fontSize: 18, marginTop: 1 }}>
                            {workoutName}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 18, fontVariant: ['tabular-nums'] }}>{duration}</Text>
                        <Text style={{ color: colors.text.tertiary, fontSize: 10 }}>tempo</Text>
                    </View>
                </View>

                {/* Preference toggle (persisted per student) */}
                <View style={{ marginTop: 10 }}>
                    <WorkoutModeToggle mode={viewMode} onChange={setViewMode} />
                </View>

                {/* Completion bar (por exercício — D4) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1, height: 6, backgroundColor: colors.surface.card2, borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${totalExercises > 0 ? (doneExercises / totalExercises) * 100 : 0}%`, backgroundColor: colors.purple[600], borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: colors.text.tertiary, fontSize: 11, fontWeight: '700' }}>
                        {doneExercises} de {totalExercises} feito{doneExercises === 1 ? '' : 's'}
                    </Text>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1, backgroundColor: colors.surface.canvas }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
            >
                {viewMode === 'foco' && focusItems.length > 0 ? (
                    <View style={{ flex: 1 }}>
                        <WorkoutFocusPager
                            index={focusIndex}
                            onIndexChange={setFocusIndex}
                            scrollY={focusScrollY}
                            pageBottomPadding={restTimer ? 300 : 220}
                            pages={focusItems.map((item, i) => {
                                const eyebrow = (
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.purple[700], letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                                        Exercício {i + 1} de {focusItems.length}
                                    </Text>
                                );
                                if (item.type === 'exercise') {
                                    return (
                                        <WorkoutFocusExercise
                                            key={item.exercise.id}
                                            exercise={item.exercise}
                                            position={i + 1}
                                            total={focusItems.length}
                                            globalIndex={item.globalIndex}
                                            onSetChangeGlobal={onSetChangeStable}
                                            onToggleSetCompleteGlobal={onToggleSetCompleteStable}
                                            onSwapPressGlobal={openSwapModal}
                                            onVideoPress={onVideoPressStable}
                                        />
                                    );
                                }
                                if (item.type === 'superset') {
                                    return (
                                        <View key={item.supersetId}>
                                            {eyebrow}
                                            <SupersetGroup
                                                exercises={item.exercises}
                                                supersetRestSeconds={item.supersetRestSeconds}
                                                onSetChange={onSetChangeStable}
                                                onToggleSetComplete={onToggleSetCompleteStable}
                                                onVideoPress={onVideoPressStable}
                                                onSwapPress={openSwapModal}
                                                globalIndices={item.globalIndices}
                                            />
                                        </View>
                                    );
                                }
                                // warmup_cardio
                                if (item.exercise.item_type === 'warmup') {
                                    return (
                                        <View key={item.exercise.id}>
                                            {eyebrow}
                                            <WarmupCard
                                                exercise={item.exercise}
                                                onTimerStart={(endTs, totalSecs, warmupType) => {
                                                    liveActivityRef.current?.updateTimerState({ itemType: 'warmup', timerEndTimestamp: endTs, timerTotalSeconds: totalSecs, warmupType });
                                                }}
                                                onTimerStop={() => liveActivityRef.current?.clearTimerState()}
                                            />
                                        </View>
                                    );
                                }
                                return (
                                    <View key={item.exercise.id}>
                                        {eyebrow}
                                        <CardioCard
                                            exercise={item.exercise}
                                            onCardioToggle={toggleCardioComplete}
                                            onTimerUpdate={(data) => liveActivityRef.current?.updateTimerState(data)}
                                            onTimerStop={() => liveActivityRef.current?.clearTimerState()}
                                        />
                                    </View>
                                );
                            })}
                        />
                        <WorkoutFocusNav
                            index={focusIndex}
                            total={focusItems.length}
                            onPrev={() => setFocusIndex((i) => Math.max(0, i - 1))}
                            onNext={() => setFocusIndex((i) => Math.min(focusItems.length - 1, i + 1))}
                            onFinish={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                if (allSetsCompleted) {
                                    handleFinish();
                                } else {
                                    Alert.alert(
                                        'Finalizar treino incompleto?',
                                        `Você completou ${completedSets} de ${totalSets} séries. Deseja finalizar mesmo assim?`,
                                        [
                                            { text: 'Continuar Treinando', style: 'cancel' },
                                            { text: 'Finalizar', style: 'destructive', onPress: handleFinish },
                                        ],
                                    );
                                }
                            }}
                        />
                        {/* Fase 4: player de vídeo ancorado que cresce ao rolar. D2:
                            cardio/aquecimento não têm player. D1: superset → seletor. */}
                        {(() => {
                            const cur = focusItems[focusIndex];
                            if (!cur || cur.type === 'warmup_cardio') return null;
                            let videoUrl: string | null = null;
                            let childOptions: VideoChoice[] | undefined;
                            if (cur.type === 'exercise') {
                                videoUrl = cur.exercise.video_url ?? null;
                            } else if (cur.type === 'superset') {
                                childOptions = cur.exercises.map((e) => ({ name: e.name, videoUrl: e.video_url ?? null }));
                                videoUrl = childOptions[Math.min(focusChildVideo, childOptions.length - 1)]?.videoUrl ?? null;
                            }
                            return (
                                <GrowingVideoPlayer
                                    videoUrl={videoUrl}
                                    scrollY={focusScrollY}
                                    onOpenFullscreen={onVideoPressStable}
                                    childOptions={childOptions}
                                    selectedChild={focusChildVideo}
                                    onSelectChild={setFocusChildVideo}
                                />
                            );
                        })()}
                    </View>
                ) : (
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, backgroundColor: colors.surface.canvas }}
                    contentContainerStyle={{ paddingBottom: restTimer ? 260 : 24 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderList.map((item) => {
                        if (item.type === 'section_header') {
                            return (
                                <View key={`header-${item.label}`} style={{ marginTop: 20, marginBottom: 8, paddingHorizontal: 4 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: colors.text.tertiary }}>
                                        {item.label}
                                    </Text>
                                </View>
                            );
                        }
                        if (item.type === 'warmup_cardio') {
                            if (item.exercise.item_type === 'warmup') {
                                return (
                                    <WarmupCard
                                        key={item.exercise.id}
                                        exercise={item.exercise}
                                        onTimerStart={(endTs, totalSecs, warmupType) => {
                                            liveActivityRef.current?.updateTimerState({
                                                itemType: 'warmup',
                                                timerEndTimestamp: endTs,
                                                timerTotalSeconds: totalSecs,
                                                warmupType,
                                            });
                                        }}
                                        onTimerStop={() => liveActivityRef.current?.clearTimerState()}
                                    />
                                );
                            }
                            return (
                                <CardioCard
                                    key={item.exercise.id}
                                    exercise={item.exercise}
                                    onCardioToggle={toggleCardioComplete}
                                    onTimerUpdate={(data) => liveActivityRef.current?.updateTimerState(data)}
                                    onTimerStop={() => liveActivityRef.current?.clearTimerState()}
                                />
                            );
                        }
                        if (item.type === 'note') {
                            return <WorkoutNoteCard key={item.note.id} note={item.note.notes} />;
                        }
                        if (item.type === 'superset') {
                            const supersetGroup = (
                                <SupersetGroup
                                    exercises={item.exercises}
                                    supersetRestSeconds={item.supersetRestSeconds}
                                    onSetChange={onSetChangeStable}
                                    onToggleSetComplete={onToggleSetCompleteStable}
                                    onVideoPress={onVideoPressStable}
                                    onSwapPress={openSwapModal}
                                    globalIndices={item.globalIndices}
                                />
                            );
                            // Foco (placeholder até a Fase 3) → grupo completo como hoje.
                            if (viewMode !== 'lista') {
                                return <React.Fragment key={item.supersetId}>{supersetGroup}</React.Fragment>;
                            }
                            const m = listMeta.get(item.supersetId);
                            const isFocused = item.supersetId === expandedKey;
                            const status: ExerciseStatus = m?.done ? 'done' : (isFocused || m?.started ? 'current' : 'todo');
                            if (!isFocused) {
                                return (
                                    <View key={item.supersetId} style={{ backgroundColor: colors.surface.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border.subtle, padding: 14, marginBottom: 14 }}>
                                        <ExerciseSummaryRow
                                            number={m?.number ?? 0}
                                            name="Superset"
                                            meta={`${item.exercises.length} exercícios · ${item.exercises.map((e) => e.name).join(' + ')}`}
                                            status={status}
                                            onPress={() => focusExercise(item.supersetId)}
                                            expanded={false}
                                        />
                                    </View>
                                );
                            }
                            return (
                                <View key={item.supersetId} style={{ marginBottom: 4 }}>
                                    <View style={{ paddingHorizontal: 2, marginBottom: 6 }}>
                                        <ExerciseSummaryRow
                                            number={m?.number ?? 0}
                                            name="Superset"
                                            meta={`${item.exercises.length} exercícios`}
                                            status={status}
                                            onPress={undefined}
                                            expanded
                                        />
                                    </View>
                                    {supersetGroup}
                                </View>
                            );
                        }
                        if (item.type === 'exercise') {
                            // Foco (placeholder até a Fase 3) → card completo como hoje.
                            if (viewMode !== 'lista') {
                                return (
                                    <ExerciseCard
                                        key={item.exercise.id}
                                        exerciseName={item.exercise.name}
                                        sets={item.exercise.sets}
                                        reps={item.exercise.reps}
                                        restSeconds={item.exercise.rest_seconds}
                                        videoUrl={item.exercise.video_url}
                                        previousLoad={item.exercise.previousLoad}
                                        previousSets={item.exercise.previousSets}
                                        setsData={item.exercise.setsData}
                                        globalIndex={item.globalIndex}
                                        onSetChangeGlobal={onSetChangeStable}
                                        onToggleSetCompleteGlobal={onToggleSetCompleteStable}
                                        onSwapPressGlobal={openSwapModal}
                                        onVideoPress={onVideoPressStable}
                                        isSwapped={item.exercise.swap_source !== 'none'}
                                        notes={item.exercise.notes}
                                        setScheme={item.exercise.setScheme}
                                        methodKey={item.exercise.methodKey}
                                        rounds={item.exercise.rounds}
                                    />
                                );
                            }
                            const m = listMeta.get(item.exercise.id);
                            const isFocused = item.exercise.id === expandedKey;
                            const status: ExerciseStatus = m?.done ? 'done' : (isFocused || m?.started ? 'current' : 'todo');
                            return (
                                <ExecutionExerciseCard
                                    key={item.exercise.id}
                                    exercise={item.exercise}
                                    number={m?.number ?? 0}
                                    status={status}
                                    isFocused={isFocused}
                                    expanded={isFocused}
                                    onToggleExpand={() => focusExercise(item.exercise.id)}
                                    globalIndex={item.globalIndex}
                                    onSetChangeGlobal={onSetChangeStable}
                                    onToggleSetCompleteGlobal={onToggleSetCompleteStable}
                                    onSwapPressGlobal={openSwapModal}
                                    onVideoPress={onVideoPressStable}
                                />
                            );
                        }
                        return null;
                    })}

                    {exercises.length === 0 && (
                        <View className="items-center justify-center py-20">
                            <Text className="text-slate-500">Nenhum exercício encontrado neste treino.</Text>
                        </View>
                    )}

                </ScrollView>
                )}
            </KeyboardAvoidingView>

            {/* C1: aviso transitório não-bloqueante de série sem carga/reps */}
            {emptySetNotice && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: 16,
                        right: 16,
                        bottom: Math.max(insets.bottom, 16) + 72,
                        backgroundColor: colors.surface.card2,
                        borderRadius: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border.default,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                        elevation: 6,
                    }}
                >
                    <Info size={16} color={colors.text.secondary} />
                    <Text style={{ flex: 1, color: colors.text.secondary, fontSize: 13, fontWeight: '500' }}>
                        Série marcada sem carga e reps. Toque nos campos para registrar.
                    </Text>
                </View>
            )}

            {/* Fixed Finalizar button — só no modo lista. No foco, a barra
                WorkoutFocusNav ("Concluir treino" no último item) faz o papel. */}
            {viewMode === 'lista' && (
            <View style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: colors.surface.canvas,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border.default,
            }}>
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        if (allSetsCompleted) {
                            handleFinish();
                        } else {
                            Alert.alert(
                                'Finalizar treino incompleto?',
                                `Você completou ${completedSets} de ${totalSets} séries. Deseja finalizar mesmo assim?`,
                                [
                                    { text: 'Continuar Treinando', style: 'cancel' },
                                    { text: 'Finalizar', style: 'destructive', onPress: handleFinish },
                                ]
                            );
                        }
                    }}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                    style={{
                        backgroundColor: allSetsCompleted ? colors.purple[600] : colors.surface.card2,
                        borderRadius: 16,
                        height: 52,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={allSetsCompleted ? '#fff' : colors.text.tertiary} />
                    ) : (
                        <Text style={{
                            color: allSetsCompleted ? '#fff' : colors.text.tertiary,
                            fontWeight: '700',
                            fontSize: 16,
                        }}>
                            {allSetsCompleted ? 'Finalizar Treino' : `Finalizar (${completedSets}/${totalSets})`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
            )}
            {/* Feedback Modal */}
            <WorkoutFeedbackModal
                visible={isFeedbackVisible}
                onClose={() => setIsFeedbackVisible(false)}
                onConfirm={handleConfirmFinish}
                summary={{
                    duration,
                    exerciseCount: exercises.filter(ex => ex.setsData.some(s => s.completed)).length || exercises.length,
                    completedSets,
                    totalSets,
                    totalVolume: (() => {
                        const anyFunc = exercises.some(ex => ex.exerciseFunction);
                        return exercises.reduce((acc, ex) => {
                            if (anyFunc && ex.exerciseFunction !== 'main') return acc;
                            ex.setsData.forEach(s => {
                                if (s.completed) {
                                    acc += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
                                }
                            });
                            return acc;
                        }, 0);
                    })(),
                }}
            />
            {/* Fase 14c — Pré-treino Readiness Sheet (antes da workout_session) */}
            {readinessData && (
                <PreWorkoutReadinessSheet
                    visible={readinessSheetVisible}
                    readiness={readinessData}
                    hrToday={healthDashboard?.hrRestingLatest?.bpm}
                    hrv={healthDashboard?.hrvLatest?.value_ms}
                    onProceed={handleReadinessProceed}
                    onReschedule={handleReadinessReschedule}
                    onDismiss={handleReadinessProceed}
                />
            )}
            {/* Video Modal */}
            <ExerciseVideoModal
                visible={videoModalUrl !== null}
                onClose={() => setVideoModalUrl(null)}
                videoUrl={videoModalUrl}
            />
            <ExerciseSwapModal
                visible={swapModalVisible}
                onClose={() => setSwapModalVisible(false)}
                onSelect={(option) => applySwap(option)}
                exerciseName={activeSwapIndex !== null ? exercises[activeSwapIndex]?.name || null : null}
                options={swapOptions}
                isLoading={swapModalLoading}
                searchQuery={swapSearchQuery}
                onSearchQueryChange={setSwapSearchQuery}
                searchResults={swapSearchResults}
                isSearching={swapSearchLoading}
            />
            {/* Celebration Full-Screen Takeover */}
            <WorkoutCelebration
                visible={showCelebration}
                onComplete={handleCelebrationComplete}
                onShare={handleCelebrationShare}
                data={celebrationData}
            />
            {/* Share modal direto (atalho do CTA da celebração) */}
            <ShareWorkoutModal
                visible={showShareModal}
                onClose={handleShareClose}
                data={successData}
                sessionId={successData?.sessionId}
            />
            {/* Rest Timer Overlay */}
            {restTimer && (
                <RestTimerOverlay
                    endTime={restTimer.endTime}
                    totalSeconds={restTimer.totalSeconds}
                    exerciseName={restTimer.exerciseName}
                    onSkip={() => setRestTimer(null)}
                    onComplete={() => setRestTimer(null)}
                    onAdjustTime={(delta) => {
                        setRestTimer(prev => {
                            if (!prev) return null;
                            const newEnd = prev.endTime + delta * 1000;
                            // Don't allow adjusting below current time
                            if (newEnd <= Date.now()) return null;
                            return {
                                ...prev,
                                endTime: newEnd,
                                totalSeconds: prev.totalSeconds + delta,
                            };
                        });
                    }}
                />
            )}
            {/* Pre-workout check-in sheet */}
            {preWorkoutTrigger && (
                <PreWorkoutFormSheet
                    visible={preCheckinState === 'showing'}
                    trigger={preWorkoutTrigger}
                    onSubmit={handlePreCheckinSubmit}
                    onSkip={handlePreCheckinSkip}
                />
            )}
            {/* Post-workout check-in sheet */}
            {postWorkoutTrigger && (
                <PostWorkoutFormSheet
                    visible={postCheckinState === 'showing'}
                    trigger={postWorkoutTrigger}
                    onSubmit={handlePostCheckinSubmit}
                    onSkip={handlePostCheckinSkip}
                />
            )}
        </ScreenWrapper>
    );
}

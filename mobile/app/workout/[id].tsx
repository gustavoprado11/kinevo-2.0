import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet, AppState } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ExerciseCard } from '../../components/workout/ExerciseCard';
import { SupersetGroup } from '../../components/workout/SupersetGroup';
import { WorkoutNoteCard } from '../../components/workout/WorkoutNoteCard';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { useStudentProfile } from '../../hooks/useStudentProfile';
import { useWatchConnectivity } from '../../hooks/useWatchConnectivity';
import { ChevronLeft } from 'lucide-react-native';
import { WorkoutFeedbackModal } from '../../components/workout/WorkoutFeedbackModal';
import { WorkoutSuccessModal } from '../../components/workout/WorkoutSuccessModal';
import { WorkoutCelebration, CelebrationData } from '../../components/workout/WorkoutCelebration';
import { ExerciseVideoModal } from '../../components/workout/ExerciseVideoModal';
import { RestTimerOverlay } from '../../components/workout/RestTimerOverlay';
import { ExerciseSwapModal } from '../../components/workout/ExerciseSwapModal';
import type { ExerciseSubstituteOption, ExerciseData, WorkoutNote } from '../../hooks/useWorkoutSession';
import { ShareableCardProps } from '../../components/workout/sharing/types';
import { watchFinishState } from '../../lib/finishWorkoutFromWatch';

export default function WorkoutPlayerScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { profile } = useStudentProfile();

    // Live Activity rest timer trigger
    const liveActivityRef = useRef<{ startRestTimer: (exerciseIndex: number, seconds: number) => void } | null>(null);

    const onSetComplete = useCallback((exerciseIndex: number, _setIndex: number) => {
        const exercise = exercisesRef.current[exerciseIndex];
        if (!exercise) return;

        // Superset logic: only trigger rest after the last exercise in the round
        if (exercise.supersetId) {
            const supersetExercises = exercisesRef.current.filter(
                (e) => e.supersetId === exercise.supersetId
            );
            const isLastInGroup = supersetExercises[supersetExercises.length - 1]?.id === exercise.id;

            if (!isLastInGroup) {
                // Not the last exercise in superset round — no rest timer
                return;
            }

            // Last exercise in superset — use supersetRestSeconds
            const restSeconds = exercise.supersetRestSeconds || exercise.rest_seconds || 60;
            const hasRemainingRounds = supersetExercises.some(
                (e) => e.setsData.some((s, i) => i > _setIndex && !s.completed)
            );
            if (hasRemainingRounds && restSeconds > 0) {
                liveActivityRef.current?.startRestTimer(exerciseIndex, restSeconds);
                setRestTimer({
                    endTime: Date.now() + restSeconds * 1000,
                    totalSeconds: restSeconds,
                    exerciseName: 'Superset',
                });
            }
            return;
        }

        // Normal exercise: original behavior
        if (exercise.rest_seconds > 0) {
            const hasRemainingSets = exercise.setsData.some((s, i) => i > _setIndex && !s.completed);
            if (hasRemainingSets) {
                liveActivityRef.current?.startRestTimer(exerciseIndex, exercise.rest_seconds);
                setRestTimer({
                    endTime: Date.now() + exercise.rest_seconds * 1000,
                    totalSeconds: exercise.rest_seconds,
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
        isSubmitting
    } = useWorkoutSession(id as string, { onSetComplete });

    // Keep a ref to exercises for the onSetComplete callback
    const exercisesRef = useRef(exercises);
    exercisesRef.current = exercises;

    // Live Activity hook
    const { startRestTimer, stopActivity } = useLiveActivity({
        workoutName,
        workoutId: id as string,
        exercises,
        studentName: profile?.name ?? 'Aluno',
        isLoading,
    });

    // Expose startRestTimer to onSetComplete callback via ref
    useEffect(() => {
        liveActivityRef.current = { startRestTimer };
    }, [startRestTimer]);

    // Apple Watch connectivity
    // Note: FINISH_WORKOUT is handled at root level (_layout.tsx → finishWorkoutFromWatch)
    // so it works even when this screen is not mounted (app killed during workout).
    const { sendWorkoutToWatch } = useWatchConnectivity({
        onWatchSetComplete: ({ workoutId, exerciseIndex, setIndex, reps, weight }) => {
            if (workoutId && workoutId !== (id as string)) {
                return;
            }

            console.log(
                `[WorkoutScreen] Watch reported set complete: exercise ${exerciseIndex}, set ${setIndex}, reps ${reps ?? '-'}, weight ${weight ?? '-'}`
            );
            applyWatchSetCompletion(exerciseIndex, setIndex, reps, weight);
        },
    });

    // Send workout data to Apple Watch when loaded
    const lastWatchPayloadRef = useRef<any>(null);
    const workoutStartedAtRef = useRef<string>(new Date().toISOString());

    useEffect(() => {
        if (!isLoading && exercises.length > 0 && workoutName && profile?.name) {
            const watchPayload = {
                workoutId: id as string,
                workoutName,
                studentName: profile.name,
                exercises: exercises.map((ex, idx) => ({
                    id: ex.id || `ex-${idx}`,
                    name: ex.name,
                    sets: ex.setsData.length,
                    reps: parseInt(ex.setsData[0]?.reps || '0') || 0,
                    weight: ex.setsData[0]?.weight ? parseFloat(ex.setsData[0].weight) : undefined,
                    restTime: ex.rest_seconds || 0,
                    completedSets: ex.setsData.filter((s) => s.completed).length,
                    targetReps: ex.reps || undefined,
                })),
                currentExerciseIndex: 0,
                currentSetIndex: 0,
                isActive: true,
                startedAt: workoutStartedAtRef.current,
                updatedAt: new Date().toISOString(),
            };

            console.log('[WorkoutScreen] Sending workout to watch:', watchPayload);
            lastWatchPayloadRef.current = watchPayload;
            sendWorkoutToWatch(watchPayload);
        }
    }, [isLoading, exercises, workoutName, profile, id, sendWorkoutToWatch]);

    // Re-sync watch when app returns to foreground.
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && lastWatchPayloadRef.current) {
                console.log('[WorkoutScreen] App became active, re-syncing workout to watch');
                sendWorkoutToWatch(lastWatchPayloadRef.current);
            }
        });

        return () => subscription.remove();
    }, [sendWorkoutToWatch]);

    const navigation = useNavigation();
    const isFinishingRef = useRef(false);
    const [isFeedbackVisible, setIsFeedbackVisible] = React.useState(false);
    const [showCelebration, setShowCelebration] = React.useState(false);
    const [celebrationData, setCelebrationData] = React.useState<CelebrationData | undefined>(undefined);
    const [showSuccessModal, setShowSuccessModal] = React.useState(false);
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

    const openSwapModal = async (exerciseIndex: number) => {
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
            console.error('Error loading substitute options:', error);
            Alert.alert('Erro', 'Nao foi possivel carregar as opcoes de troca.');
        } finally {
            setSwapModalLoading(false);
        }
    };

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
                    console.error('Error searching substitute options:', error);
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
                        onPress: () => navigation.dispatch(e.data.action),
                    },
                ]
            );
        });

        return unsubscribe;
    }, [navigation, isSubmitting]);

    const handleFinish = () => {
        // Open feedback modal instead of alert
        setIsFeedbackVisible(true);
    };

    const [successData, setSuccessData] = React.useState<ShareableCardProps & { sessionId?: string } | undefined>(undefined);

    const handleConfirmFinish = async (rpe: number, feedback: string) => {
        try {
            setIsFeedbackVisible(false);
            const success = await finishWorkout(rpe, feedback);
            if (success) {
                // Stop Live Activity immediately
                stopActivity();

                // Calculate Stats for Shareable Card
                // Only 'main' exercises count towards volume (or all if no functions set)
                let totalVolume = 0;
                let completedExercisesCount = 0;
                const hasAnyFunction = exercises.some(ex => ex.exerciseFunction);

                exercises.forEach(ex => {
                    // Check if at least one set is completed
                    const hasCompletedSet = ex.setsData.some(s => s.completed);
                    if (hasCompletedSet) completedExercisesCount++;

                    // Calculate volume only for 'main' exercises (or all if no functions defined)
                    const countsForVolume = !hasAnyFunction || ex.exerciseFunction === 'main';
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
                    sessionId: success
                });

                // Set celebration data (summary for the celebration screen)
                setCelebrationData({
                    duration,
                    completedSets,
                    totalSets,
                    totalVolume,
                    rpe,
                });

                // Show full-screen celebration animation first
                setShowCelebration(true);
                // Mark as finishing so we can navigate away later
                isFinishingRef.current = true;
            }
        } catch (error: any) {
            Alert.alert("Erro", error.message || "Falha ao finalizar.");
        }
    };

    const handleCelebrationComplete = useCallback(() => {
        setShowCelebration(false);
        // After celebration fades out, show the success/share modal
        setShowSuccessModal(true);
    }, []);

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        // Navigate to home, replacing current screen so user can't go back to workout
        router.replace('/(tabs)/home');
    };

    if (isLoading) {
        return (
            <ScreenWrapper>
                <View className="flex-1 items-center justify-center bg-slate-50">
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text className="text-slate-500 mt-4">Carregando treino...</Text>
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

            {/* Header */}
            <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
                {/* Top row: back | name+timer | spacer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }} hitSlop={12}>
                        <ChevronLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 17 }}>{workoutName}</Text>
                        <Text style={{ color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }}>{duration}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>
                {/* Progress bar */}
                <View style={{ marginTop: 12 }}>
                    <View style={{ height: 3, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`, backgroundColor: '#7c3aed', borderRadius: 2 }} />
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                        {completedSets}/{totalSets} séries
                    </Text>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 bg-slate-50"
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
            >
                <ScrollView
                    className="flex-1 px-4 pt-4 bg-slate-50"
                    contentContainerStyle={{ paddingBottom: restTimer ? 260 : 24 }}
                    showsVerticalScrollIndicator={false}
                >
                    {(() => {
                        // Build unified render list ordered by order_index
                        type RenderItem =
                            | { type: 'exercise'; exercise: ExerciseData; globalIndex: number; orderIndex: number }
                            | { type: 'superset'; exercises: ExerciseData[]; supersetId: string; supersetRestSeconds: number; globalIndexOffset: number; orderIndex: number }
                            | { type: 'note'; note: WorkoutNote; orderIndex: number }
                            | { type: 'section_header'; label: string; orderIndex: number };

                        const FUNCTION_LABELS: Record<string, string> = {
                            warmup: 'AQUECIMENTO',
                            activation: 'ATIVAÇÃO',
                            main: 'PRINCIPAL',
                            accessory: 'ACESSÓRIO',
                            conditioning: 'CONDICIONAMENTO',
                        };

                        const renderItems: RenderItem[] = [];
                        const processedSupersets = new Set<string>();

                        exercises.forEach((exercise, globalIndex) => {
                            if (exercise.supersetId) {
                                if (processedSupersets.has(exercise.supersetId)) return;
                                processedSupersets.add(exercise.supersetId);

                                const group = exercises
                                    .map((e, i) => ({ ...e, _globalIndex: i }))
                                    .filter((e) => e.supersetId === exercise.supersetId);

                                // Use the first child's order_index - 1 to approximate parent superset position
                                // (superset parent always comes before its children in order_index)
                                const groupOrderIndex = Math.min(...group.map((e) => e.order_index)) - 0.5;

                                renderItems.push({
                                    type: 'superset',
                                    exercises: group,
                                    supersetId: exercise.supersetId,
                                    supersetRestSeconds: exercise.supersetRestSeconds || 60,
                                    globalIndexOffset: group[0]._globalIndex,
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

                        return (
                            <>
                                {finalItems.map((item) => {
                                    if (item.type === 'section_header') {
                                        return (
                                            <View key={`header-${item.label}`} style={{ marginTop: 20, marginBottom: 8, paddingHorizontal: 4 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: 'rgba(0,0,0,0.40)' }}>
                                                    {item.label}
                                                </Text>
                                            </View>
                                        );
                                    }
                                    if (item.type === 'note') {
                                        return <WorkoutNoteCard key={item.note.id} note={item.note.notes} />;
                                    }
                                    if (item.type === 'superset') {
                                        return (
                                            <SupersetGroup
                                                key={item.supersetId}
                                                exercises={item.exercises}
                                                supersetRestSeconds={item.supersetRestSeconds}
                                                onSetChange={(gi, si, field, value) => handleSetChange(gi, si, field, value)}
                                                onToggleSetComplete={(gi, si) => handleToggleSetComplete(gi, si)}
                                                onVideoPress={(url) => setVideoModalUrl(url)}
                                                onSwapPress={(gi) => openSwapModal(gi)}
                                                globalIndexOffset={item.globalIndexOffset}
                                            />
                                        );
                                    }
                                    if (item.type === 'exercise') {
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
                                                onSetChange={(setIndex, field, value) => handleSetChange(item.globalIndex, setIndex, field, value)}
                                                onToggleSetComplete={(setIndex) => handleToggleSetComplete(item.globalIndex, setIndex)}
                                                onVideoPress={(url) => setVideoModalUrl(url)}
                                                onSwapPress={() => openSwapModal(item.globalIndex)}
                                                isSwapped={item.exercise.swap_source !== 'none'}
                                                notes={item.exercise.notes}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </>
                        );
                    })()}

                    {exercises.length === 0 && (
                        <View className="items-center justify-center py-20">
                            <Text className="text-slate-500">Nenhum exercício encontrado neste treino.</Text>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Fixed Finalizar button */}
            <View style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: '#f8fafc',
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: '#e2e8f0',
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
                        backgroundColor: allSetsCompleted ? '#7c3aed' : '#e2e8f0',
                        borderRadius: 16,
                        height: 52,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={allSetsCompleted ? '#fff' : '#64748b'} />
                    ) : (
                        <Text style={{
                            color: allSetsCompleted ? '#fff' : '#64748b',
                            fontWeight: '700',
                            fontSize: 16,
                        }}>
                            {allSetsCompleted ? 'Finalizar Treino' : `Finalizar (${completedSets}/${totalSets})`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
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
            {/* Success Modal */}
            <WorkoutSuccessModal
                visible={showSuccessModal}
                onClose={handleSuccessClose}
                data={successData}
            />
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
                data={celebrationData}
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
        </ScreenWrapper>
    );
}

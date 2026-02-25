import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet, AppState } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ExerciseCard } from '../../components/workout/ExerciseCard';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { useStudentProfile } from '../../hooks/useStudentProfile';
import { useWatchConnectivity } from '../../hooks/useWatchConnectivity';
import { ChevronLeft } from 'lucide-react-native';
import { WorkoutFeedbackModal } from '../../components/workout/WorkoutFeedbackModal';
import { WorkoutSuccessModal } from '../../components/workout/WorkoutSuccessModal';
import { WorkoutCelebration } from '../../components/workout/WorkoutCelebration';
import { ExerciseVideoModal } from '../../components/workout/ExerciseVideoModal';
import { RestTimerOverlay } from '../../components/workout/RestTimerOverlay';
import { ExerciseSwapModal } from '../../components/workout/ExerciseSwapModal';
import type { ExerciseSubstituteOption } from '../../hooks/useWorkoutSession';
import { ShareableCardProps } from '../../components/workout/sharing/types';

export default function WorkoutPlayerScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { profile } = useStudentProfile();

    // Live Activity rest timer trigger
    const liveActivityRef = useRef<{ startRestTimer: (exerciseIndex: number, seconds: number) => void } | null>(null);

    const onSetComplete = useCallback((exerciseIndex: number, _setIndex: number) => {
        const exercise = exercisesRef.current[exerciseIndex];
        if (exercise && exercise.rest_seconds > 0) {
            // Check if there are remaining incomplete sets
            const hasRemainingSets = exercise.setsData.some((s, i) => i > _setIndex && !s.completed);
            if (hasRemainingSets) {
                // Trigger Live Activity rest timer (if available)
                liveActivityRef.current?.startRestTimer(exerciseIndex, exercise.rest_seconds);
                // Show on-screen rest timer
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
        onWatchFinishWorkout: ({ workoutId, rpe }) => {
            if (workoutId && workoutId !== (id as string)) {
                return;
            }

            console.log(`[WorkoutScreen] Watch reported workout finished. Syncing success state with RPE: ${rpe}.`);
            handleConfirmFinish(rpe, "");
        }
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
            if (isSubmitting || isFinishingRef.current) {
                // Allow navigation if submitting or finishing successfully
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
                let totalVolume = 0;
                let completedExercisesCount = 0;

                exercises.forEach(ex => {
                    // Check if at least one set is completed
                    const hasCompletedSet = ex.setsData.some(s => s.completed);
                    if (hasCompletedSet) completedExercisesCount++;

                    // Calculate volume for completed sets
                    ex.setsData.forEach(s => {
                        if (s.completed) {
                            const weight = parseFloat(s.weight) || 0;
                            const reps = parseInt(s.reps) || 0;
                            totalVolume += weight * reps;
                        }
                    });
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
                    maxLoads: maxLoads,
                    exerciseDetails: exerciseDetails,
                    sessionId: success
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
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ChevronLeft size={24} color="#0f172a" />
                </TouchableOpacity>

                <View className="items-center">
                    <Text className="text-slate-900 font-bold text-lg">{workoutName}</Text>
                    <Text className="text-slate-500 font-mono text-sm">{duration}</Text>
                </View>

                <TouchableOpacity
                    onPress={handleFinish}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                        <Text className="text-violet-500 font-bold text-base">Finalizar</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 bg-slate-50"
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
            >
                <ScrollView
                    className="flex-1 px-4 pt-4 bg-slate-50"
                    contentContainerStyle={{ paddingBottom: restTimer ? 260 : 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {exercises.map((exercise, index) => (
                        <ExerciseCard
                            key={exercise.id}
                            exerciseName={exercise.name}
                            sets={exercise.sets}
                            reps={exercise.reps}
                            restSeconds={exercise.rest_seconds}
                            videoUrl={exercise.video_url}
                            previousLoad={exercise.previousLoad}
                            setsData={exercise.setsData}
                            onSetChange={(setIndex, field, value) => handleSetChange(index, setIndex, field, value)}
                            onToggleSetComplete={(setIndex) => handleToggleSetComplete(index, setIndex)}
                            onVideoPress={(url) => setVideoModalUrl(url)}
                            onSwapPress={() => openSwapModal(index)}
                            isSwapped={exercise.swap_source !== 'none'}
                        />
                    ))}

                    {exercises.length === 0 && (
                        <View className="items-center justify-center py-20">
                            <Text className="text-slate-500">Nenhum exercício encontrado neste treino.</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        className="mx-5 mb-8 mt-6 rounded-2xl overflow-hidden shadow-lg shadow-violet-500/40"
                        onPress={handleFinish}
                        disabled={isSubmitting}
                        activeOpacity={0.8}
                    >
                        <BlurView intensity={80} tint="light" className="bg-violet-600/85">
                            <View className="border border-white/20 rounded-2xl overflow-hidden">
                                <LinearGradient
                                    colors={['rgba(139, 92, 246, 0.5)', 'rgba(109, 40, 217, 0.5)']}
                                    className="h-14 flex-row items-center justify-center space-x-2"
                                >
                                    <Text className="text-white font-bold text-lg text-center">
                                        Finalizar Treino
                                    </Text>
                                </LinearGradient>
                            </View>
                        </BlurView>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
            {/* Feedback Modal */}
            <WorkoutFeedbackModal
                visible={isFeedbackVisible}
                onClose={() => setIsFeedbackVisible(false)}
                onConfirm={handleConfirmFinish}
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

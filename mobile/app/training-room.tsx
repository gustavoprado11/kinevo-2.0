import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
    Plus,
    ArrowLeft,
    Play,
    Square,
    Trash2,
    X,
    Timer,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTrainingRoomStore } from '../stores/training-room-store';
import type { ExerciseData, WorkoutNote, ActiveSession } from '../stores/training-room-store';
import { useFinishTrainerWorkout } from '../hooks/useTrainerWorkoutSession';
import { StudentPickerModal } from '../components/trainer/StudentPickerModal';
import { WorkoutFeedbackModal } from '../components/trainer/WorkoutFeedbackModal';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { SupersetGroup } from '../components/workout/SupersetGroup';
import { WorkoutNoteCard } from '../components/workout/WorkoutNoteCard';
import { RestTimerOverlay } from '../components/workout/RestTimerOverlay';

// ---------------------------------------------------------------------------
// Elapsed Timer Component
// ---------------------------------------------------------------------------

function ElapsedTimer({ startedAt }: { startedAt: number }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startedAt]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Timer size={12} color="#10b981" />
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: '#10b981',
                    fontVariant: ['tabular-nums'],
                }}
            >
                {mins}:{secs.toString().padStart(2, '0')}
            </Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Student Tab Pill
// ---------------------------------------------------------------------------

function StudentTabPill({
    session,
    isActive,
    onPress,
    onRemove,
}: {
    session: ActiveSession;
    isActive: boolean;
    onPress: () => void;
    onRemove: () => void;
}) {
    const { completed, total } = useTrainingRoomStore.getState().getCompletedSets(session.studentId);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingLeft: 6,
                paddingRight: 10,
                borderRadius: 20,
                backgroundColor: isActive ? 'rgba(124, 58, 237, 0.1)' : '#fff',
                borderWidth: 1,
                borderColor: isActive ? 'rgba(124, 58, 237, 0.25)' : '#e2e8f0',
            }}
        >
            {session.studentAvatarUrl ? (
                <Image
                    source={{ uri: session.studentAvatarUrl }}
                    style={{ width: 28, height: 28, borderRadius: 14 }}
                />
            ) : (
                <View
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isActive ? 'rgba(124, 58, 237, 0.15)' : '#f1f5f9',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#7c3aed' : '#64748b' }}>
                        {session.studentName.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isActive ? '#7c3aed' : '#0f172a',
                    maxWidth: 80,
                }}
                numberOfLines={1}
            >
                {session.studentName.split(' ')[0]}
            </Text>
            {session.status === 'in_progress' && (
                <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '500' }}>
                    {completed}/{total}
                </Text>
            )}
            {session.status === 'in_progress' && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
            )}
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// Main Training Room Screen
// ---------------------------------------------------------------------------

export default function TrainingRoomScreen() {
    const router = useRouter();
    const sessions = useTrainingRoomStore((s) => s.sessions);
    const activeStudentId = useTrainingRoomStore((s) => s.activeStudentId);
    const setActiveStudent = useTrainingRoomStore((s) => s.setActiveStudent);
    const startWorkout = useTrainingRoomStore((s) => s.startWorkout);
    const setFinishing = useTrainingRoomStore((s) => s.setFinishing);
    const updateSet = useTrainingRoomStore((s) => s.updateSet);
    const toggleSetComplete = useTrainingRoomStore((s) => s.toggleSetComplete);
    const removeStudent = useTrainingRoomStore((s) => s.removeStudent);
    const clearExpiredSessions = useTrainingRoomStore((s) => s.clearExpiredSessions);
    const startRestTimer = useTrainingRoomStore((s) => s.startRestTimer);
    const clearRestTimer = useTrainingRoomStore((s) => s.clearRestTimer);

    const { finish, isSubmitting } = useFinishTrainerWorkout();

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    const sessionCount = Object.keys(sessions).length;
    const activeSession = activeStudentId ? sessions[activeStudentId] : null;

    // Clear expired sessions on mount
    useEffect(() => {
        clearExpiredSessions();
    }, [clearExpiredSessions]);

    // Computed set counts
    const completedSetsTotal = useMemo(() => {
        if (!activeSession) return 0;
        return activeSession.exercises.reduce(
            (acc, ex) => acc + ex.setsData.filter((s) => s.completed).length,
            0,
        );
    }, [activeSession]);

    const totalSets = useMemo(() => {
        if (!activeSession) return 0;
        return activeSession.exercises.reduce((acc, ex) => acc + ex.setsData.length, 0);
    }, [activeSession]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handleStartWorkout = () => {
        if (!activeStudentId) return;
        startWorkout(activeStudentId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleFinishClick = () => {
        if (!activeStudentId) return;
        setFinishing(activeStudentId);
        setIsFeedbackOpen(true);
    };

    const handleConfirmFinish = async (rpe: number | null, feedback: string | null) => {
        if (!activeSession || !activeStudentId) return;

        const result = await finish(
            activeStudentId,
            {
                assignedWorkoutId: activeSession.assignedWorkoutId,
                assignedProgramId: activeSession.assignedProgramId,
                startedAt: activeSession.startedAt!,
                exercises: activeSession.exercises,
            },
            rpe,
            feedback,
        );

        if (result.error) {
            Alert.alert('Erro', result.error);
            return;
        }

        setIsFeedbackOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleCancelFeedback = () => {
        if (activeStudentId) {
            startWorkout(activeStudentId); // revert to in_progress
        }
        setIsFeedbackOpen(false);
    };

    const handleDiscardWorkout = () => {
        if (!activeStudentId || !activeSession) return;
        Alert.alert(
            'Descartar treino?',
            `Os dados de ${activeSession.studentName} não serão salvos.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Descartar',
                    style: 'destructive',
                    onPress: () => removeStudent(activeStudentId),
                },
            ],
        );
    };

    const handleRemoveStudent = (studentId: string) => {
        const session = sessions[studentId];
        if (!session) return;
        if (session.status === 'in_progress') {
            Alert.alert(
                'Remover aluno?',
                `O treino em andamento de ${session.studentName} será perdido.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Remover', style: 'destructive', onPress: () => removeStudent(studentId) },
                ],
            );
        } else {
            removeStudent(studentId);
        }
    };

    // Set change handlers that proxy to the store
    const handleSetChange = useCallback(
        (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
            if (!activeStudentId) return;
            updateSet(activeStudentId, exerciseIndex, setIndex, field, value);
        },
        [activeStudentId, updateSet],
    );

    const handleToggleSetComplete = useCallback(
        (exerciseIndex: number, setIndex: number) => {
            if (!activeStudentId || !activeSession) return;
            toggleSetComplete(activeStudentId, exerciseIndex, setIndex);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Auto-start rest timer on set completion
            const exercise = activeSession.exercises[exerciseIndex];
            if (exercise) {
                const setData = exercise.setsData[setIndex];
                if (!setData?.completed) {
                    // Set was just completed (toggle makes it true)
                    const restSeconds = exercise.supersetRestSeconds || exercise.rest_seconds || 60;
                    startRestTimer(activeStudentId, restSeconds);
                }
            }
        },
        [activeStudentId, activeSession, toggleSetComplete, startRestTimer],
    );

    const handleRestTimerSkip = useCallback(() => {
        if (activeStudentId) clearRestTimer(activeStudentId);
    }, [activeStudentId, clearRestTimer]);

    const handleRestTimerComplete = useCallback(() => {
        if (activeStudentId) clearRestTimer(activeStudentId);
    }, [activeStudentId, clearRestTimer]);

    const handleAdjustRestTimer = useCallback(
        (delta: number) => {
            if (!activeStudentId || !activeSession?.restTimerEnd || !activeSession?.restTimerDuration) return;
            const newEnd = activeSession.restTimerEnd + delta * 1000;
            const newDuration = activeSession.restTimerDuration + delta;
            if (newDuration <= 0) {
                clearRestTimer(activeStudentId);
                return;
            }
            // Directly update the timer end in the store
            useTrainingRoomStore.setState((state) => {
                const session = state.sessions[activeStudentId];
                if (!session) return state;
                return {
                    sessions: {
                        ...state.sessions,
                        [activeStudentId]: {
                            ...session,
                            restTimerEnd: newEnd,
                            restTimerDuration: newDuration,
                        },
                    },
                };
            });
        },
        [activeStudentId, activeSession, clearRestTimer],
    );

    // ---------------------------------------------------------------------------
    // Render workout items (exercises, supersets, notes) by order_index
    // ---------------------------------------------------------------------------

    const renderWorkoutItems = () => {
        if (!activeSession) return null;

        const exercises = activeSession.exercises;
        const notes = activeSession.workoutNotes || [];
        const disabled = activeSession.status === 'ready';
        const processedSupersets = new Set<string>();

        type RenderItem = { orderIndex: number; node: React.ReactNode };
        const items: RenderItem[] = [];

        exercises.forEach((exercise, ei) => {
            if (exercise.supersetId) {
                if (processedSupersets.has(exercise.supersetId)) return;
                processedSupersets.add(exercise.supersetId);

                const group = exercises
                    .map((e, i) => ({ ...e, _gi: i }))
                    .filter((e) => e.supersetId === exercise.supersetId);

                const groupOrderIndex = Math.min(...group.map((e) => e.order_index)) - 0.5;

                items.push({
                    orderIndex: groupOrderIndex,
                    node: (
                        <SupersetGroup
                            key={exercise.supersetId}
                            exercises={group}
                            supersetRestSeconds={exercise.supersetRestSeconds || 60}
                            onSetChange={(globalIdx, setIdx, field, value) => {
                                if (activeStudentId) updateSet(activeStudentId, globalIdx, setIdx, field, value);
                            }}
                            onToggleSetComplete={(globalIdx, setIdx) => {
                                handleToggleSetComplete(globalIdx, setIdx);
                            }}
                            globalIndexOffset={group[0]._gi}
                        />
                    ),
                });
            } else {
                items.push({
                    orderIndex: exercise.order_index,
                    node: (
                        <ExerciseCard
                            key={exercise.id}
                            exerciseName={exercise.name}
                            sets={exercise.sets}
                            reps={exercise.reps}
                            restSeconds={exercise.rest_seconds}
                            setsData={exercise.setsData}
                            onSetChange={(setIdx, field, value) => handleSetChange(ei, setIdx, field, value)}
                            onToggleSetComplete={(setIdx) => handleToggleSetComplete(ei, setIdx)}
                            videoUrl={exercise.video_url}
                            previousLoad={exercise.previousLoad}
                            previousSets={exercise.previousSets}
                            isSwapped={exercise.swap_source !== 'none'}
                            notes={exercise.notes}
                        />
                    ),
                });
            }
        });

        // Add notes into unified list
        notes.forEach((note) => {
            items.push({
                orderIndex: note.order_index,
                node: <WorkoutNoteCard key={note.id} note={note.notes} />,
            });
        });

        items.sort((a, b) => a.orderIndex - b.orderIndex);
        return items.map((item) => item.node);
    };

    // ---------------------------------------------------------------------------
    // UI
    // ---------------------------------------------------------------------------

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        <ArrowLeft size={20} color="#0f172a" />
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>
                            Sala de Treino
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setIsPickerOpen(true)}
                        activeOpacity={0.6}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#fff',
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                        }}
                    >
                        <Plus size={16} color="#7c3aed" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#7c3aed' }}>
                            Aluno
                        </Text>
                    </TouchableOpacity>
                </View>

                {sessionCount === 0 ? (
                    /* Empty state */
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
                        <View
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 22,
                                backgroundColor: '#f5f3ff',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 20,
                            }}
                        >
                            <Plus size={32} color="#7c3aed" strokeWidth={1.5} />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>
                            Sala de Treino
                        </Text>
                        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                            Adicione alunos para iniciar sessões de treino presenciais. Os dados serão salvos no histórico do aluno.
                        </Text>
                        <TouchableOpacity
                            onPress={() => setIsPickerOpen(true)}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: '#7c3aed',
                                borderRadius: 14,
                                paddingVertical: 14,
                                paddingHorizontal: 24,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <Plus size={18} color="#fff" />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                                Adicionar Aluno
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* Active sessions */
                    <>
                        {/* Student tabs */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{
                                paddingHorizontal: 20,
                                paddingBottom: 12,
                                gap: 8,
                            }}
                        >
                            {Object.values(sessions).map((session) => (
                                <StudentTabPill
                                    key={session.studentId}
                                    session={session}
                                    isActive={session.studentId === activeStudentId}
                                    onPress={() => {
                                        setActiveStudent(session.studentId);
                                        Haptics.selectionAsync();
                                    }}
                                    onRemove={() => handleRemoveStudent(session.studentId)}
                                />
                            ))}
                        </ScrollView>

                        {/* Active session content */}
                        {activeSession && (
                            <ScrollView
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* Workout info bar */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#fff',
                                        borderRadius: 16,
                                        padding: 14,
                                        marginBottom: 16,
                                        borderWidth: 1,
                                        borderColor: '#f1f5f9',
                                    }}
                                >
                                    {activeSession.studentAvatarUrl ? (
                                        <Image
                                            source={{ uri: activeSession.studentAvatarUrl }}
                                            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: '#f5f3ff',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 12,
                                            }}
                                        >
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed' }}>
                                                {activeSession.studentName.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                                            {activeSession.workoutName}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                                            {activeSession.exercises.length} exercício(s) — {completedSetsTotal}/{totalSets} séries
                                        </Text>
                                    </View>

                                    {activeSession.status === 'in_progress' && activeSession.startedAt && (
                                        <ElapsedTimer startedAt={activeSession.startedAt} />
                                    )}

                                    {activeSession.status === 'ready' && (
                                        <TouchableOpacity
                                            onPress={handleStartWorkout}
                                            activeOpacity={0.7}
                                            style={{
                                                backgroundColor: '#10b981',
                                                borderRadius: 10,
                                                paddingVertical: 8,
                                                paddingHorizontal: 14,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}
                                        >
                                            <Play size={12} color="#fff" fill="#fff" />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                                                Iniciar
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Action buttons when in_progress */}
                                {activeSession.status === 'in_progress' && (
                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                        <TouchableOpacity
                                            onPress={handleFinishClick}
                                            activeOpacity={0.7}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#7c3aed',
                                                borderRadius: 12,
                                                paddingVertical: 10,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            <Square size={14} color="#fff" fill="#fff" />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                                                Concluir
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={handleDiscardWorkout}
                                            activeOpacity={0.6}
                                            style={{
                                                backgroundColor: '#fff',
                                                borderRadius: 12,
                                                paddingVertical: 10,
                                                paddingHorizontal: 14,
                                                borderWidth: 1,
                                                borderColor: '#fecaca',
                                            }}
                                        >
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Workout items */}
                                {renderWorkoutItems()}
                            </ScrollView>
                        )}
                    </>
                )}

                {/* Rest Timer Overlay */}
                {activeSession?.restTimerEnd && activeSession.restTimerDuration && (
                    <RestTimerOverlay
                        endTime={activeSession.restTimerEnd}
                        totalSeconds={activeSession.restTimerDuration}
                        exerciseName={activeSession.workoutName}
                        onSkip={handleRestTimerSkip}
                        onComplete={handleRestTimerComplete}
                        onAdjustTime={handleAdjustRestTimer}
                    />
                )}
            </SafeAreaView>

            {/* Modals */}
            <StudentPickerModal
                visible={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
            />

            {activeSession && (
                <WorkoutFeedbackModal
                    visible={isFeedbackOpen}
                    studentName={activeSession.studentName}
                    workoutName={activeSession.workoutName}
                    isSubmitting={isSubmitting}
                    onConfirm={handleConfirmFinish}
                    onCancel={handleCancelFeedback}
                />
            )}
        </>
    );
}

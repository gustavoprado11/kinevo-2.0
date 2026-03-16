import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    StatusBar,
    LayoutAnimation,
    Animated,
    Easing,
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import RNReanimated, {
    type SharedValue,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
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
// Draggable Chip Wrapper (gesture + animated view for drag-to-reorder)
// ---------------------------------------------------------------------------

const CHIP_GAP = 6;

function DraggableChipSlot({
    chipId,
    dragTranslateX,
    draggingChipIdSV,
    dragOffsetX,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onMeasure,
    children,
}: {
    chipId: string;
    dragTranslateX: SharedValue<number>;
    draggingChipIdSV: SharedValue<string | null>;
    dragOffsetX: SharedValue<number>;
    onDragStart: () => void;
    onDragUpdate: (totalTranslation: number) => void;
    onDragEnd: () => void;
    onMeasure: (width: number) => void;
    children: React.ReactNode;
}) {
    const chipScale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        const isDragging = draggingChipIdSV.value === chipId;
        return {
            transform: [
                { translateX: isDragging ? dragTranslateX.value : 0 },
                { scale: chipScale.value },
            ],
            zIndex: isDragging ? 100 : 0,
        };
    });

    const gesture = Gesture.Pan()
        .activateAfterLongPress(400)
        .onStart(() => {
            draggingChipIdSV.value = chipId;
            dragTranslateX.value = 0;
            dragOffsetX.value = 0;
            chipScale.value = withSpring(1.08, { damping: 15 });
            runOnJS(onDragStart)();
        })
        .onUpdate((e) => {
            dragTranslateX.value = e.translationX + dragOffsetX.value;
            runOnJS(onDragUpdate)(dragTranslateX.value);
        })
        .onEnd(() => {
            chipScale.value = withSpring(1, { damping: 15 });
            dragTranslateX.value = withSpring(0, { damping: 20, stiffness: 200 }, (finished) => {
                if (finished) {
                    draggingChipIdSV.value = null;
                }
            });
            runOnJS(onDragEnd)();
        });

    return (
        <GestureDetector gesture={gesture}>
            <RNReanimated.View
                style={animatedStyle}
                onLayout={(e) => onMeasure(e.nativeEvent.layout.width)}
            >
                {children}
            </RNReanimated.View>
        </GestureDetector>
    );
}

// ---------------------------------------------------------------------------
// Student Tab Pill
// ---------------------------------------------------------------------------

function StudentChip({
    session,
    isActive,
    isDragging,
    onPress,
    onRemove,
}: {
    session: ActiveSession;
    isActive: boolean;
    isDragging?: boolean;
    onPress: () => void;
    onRemove: () => void;
}) {
    const { completed, total } = useTrainingRoomStore.getState().getCompletedSets(session.studentId);
    const hasProgress = session.status === 'in_progress' && total > 0;

    // --- Animated border overlay (fades in during long press) ---
    const pressOpacity = useRef(new Animated.Value(0)).current;
    const isDraggingRef = useRef(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const CHIP_HEIGHT = 36;
    const R = 18;

    useEffect(() => {
        isDraggingRef.current = !!isDragging;
        if (isDragging) {
            pressOpacity.setValue(1);
        } else {
            Animated.timing(pressOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isDragging]);

    const handlePressIn = () => {
        Animated.timing(pressOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.linear,
            useNativeDriver: true,
        }).start();
        // Pre-set flag before RNGH gesture activates at 400ms
        longPressTimerRef.current = setTimeout(() => {
            isDraggingRef.current = true;
        }, 380);
    };

    const handlePressOut = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (isDraggingRef.current) return;
        pressOpacity.stopAnimation();
        Animated.timing(pressOpacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
        }).start();
    };

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ overflow: 'visible' }}>
                <TouchableOpacity
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={0.7}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        height: CHIP_HEIGHT,
                        paddingLeft: 4,
                        paddingRight: hasProgress ? 8 : 10,
                        borderRadius: R,
                        backgroundColor: isDragging
                            ? 'rgba(124, 58, 237, 0.15)'
                            : isActive ? 'rgba(124, 58, 237, 0.1)' : '#fff',
                        borderWidth: 1,
                        borderColor: isActive ? 'rgba(124, 58, 237, 0.3)' : '#e2e8f0',
                        shadowColor: isDragging ? '#000' : 'transparent',
                        shadowOffset: { width: 0, height: isDragging ? 4 : 0 },
                        shadowOpacity: isDragging ? 0.15 : 0,
                        shadowRadius: isDragging ? 8 : 0,
                        elevation: isDragging ? 8 : 0,
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
                            color: isActive ? '#7c3aed' : '#334155',
                            maxWidth: 72,
                        }}
                        numberOfLines={1}
                    >
                        {session.studentName.split(' ')[0]}
                    </Text>
                    {hasProgress && (
                        <View
                            style={{
                                backgroundColor: isActive ? 'rgba(124, 58, 237, 0.15)' : '#f1f5f9',
                                borderRadius: 8,
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: isActive ? '#7c3aed' : '#64748b',
                                    fontVariant: ['tabular-nums'],
                                }}
                            >
                                {completed}/{total}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                {/* Animated border — fades in during long press, stays for drag */}
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: -1.5,
                        left: -1.5,
                        right: -1.5,
                        bottom: -1.5,
                        borderRadius: R + 1,
                        borderWidth: 2.5,
                        borderColor: '#7c3aed',
                        opacity: pressOpacity,
                    }}
                />
            </View>
            {/* X remove button — overlaps top-right corner of chip */}
            <TouchableOpacity
                onPress={onRemove}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#e2e8f0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: -10,
                    marginTop: -18,
                }}
            >
                <X size={10} color="#64748b" strokeWidth={3} />
            </TouchableOpacity>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Main Training Room Screen
// ---------------------------------------------------------------------------

export default function TrainingRoomScreen() {
    const router = useRouter();
    const sessions = useTrainingRoomStore((s) => s.sessions);
    const activeStudentId = useTrainingRoomStore((s) => s.activeStudentId);
    const sessionOrder = useTrainingRoomStore((s) => s.sessionOrder);
    const setActiveStudent = useTrainingRoomStore((s) => s.setActiveStudent);
    const startWorkout = useTrainingRoomStore((s) => s.startWorkout);
    const setFinishing = useTrainingRoomStore((s) => s.setFinishing);
    const updateSet = useTrainingRoomStore((s) => s.updateSet);
    const toggleSetComplete = useTrainingRoomStore((s) => s.toggleSetComplete);
    const removeStudent = useTrainingRoomStore((s) => s.removeStudent);
    const reorderStudents = useTrainingRoomStore((s) => s.reorderStudents);
    const clearExpiredSessions = useTrainingRoomStore((s) => s.clearExpiredSessions);
    const startRestTimer = useTrainingRoomStore((s) => s.startRestTimer);
    const clearRestTimer = useTrainingRoomStore((s) => s.clearRestTimer);

    const { finish, isSubmitting } = useFinishTrainerWorkout();

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [draggingChipState, setDraggingChipState] = useState<string | null>(null);
    const [chipScrollEnabled, setChipScrollEnabled] = useState(true);

    const sessionCount = Object.keys(sessions).length;

    // Derive display order (fallback for stores without sessionOrder)
    const displayOrder = useMemo(() => {
        if (sessionOrder.length > 0) return sessionOrder;
        return Object.keys(sessions);
    }, [sessionOrder, sessions]);

    // --- Drag-to-reorder shared values and refs ---
    const dragTranslateX = useSharedValue(0);
    const draggingChipIdSV = useSharedValue<string | null>(null);
    const dragOffsetX = useSharedValue(0);
    const chipWidthsRef = useRef<Map<string, number>>(new Map());
    const displayOrderRef = useRef<string[]>([]);
    displayOrderRef.current = displayOrder;
    const lastSwapTimeRef = useRef(0);

    const handleChipPress = useCallback((id: string) => {
        setActiveStudent(id);
        Haptics.selectionAsync();
    }, [setActiveStudent]);

    const handleDragStart = useCallback((chipId: string) => {
        setDraggingChipState(chipId);
        setChipScrollEnabled(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    const handleDragUpdate = useCallback((chipId: string, totalTranslation: number) => {
        const now = Date.now();
        if (now - lastSwapTimeRef.current < 200) return;

        const order = displayOrderRef.current;
        const idx = order.indexOf(chipId);
        if (idx === -1) return;

        const widths = chipWidthsRef.current;
        let x = 0;
        const centers: { id: string; center: number; width: number }[] = [];
        for (const id of order) {
            const w = widths.get(id) || 80;
            centers.push({ id, center: x + w / 2, width: w });
            x += w + CHIP_GAP;
        }

        const myEntry = centers[idx];
        if (!myEntry) return;
        const myCurrentCenter = myEntry.center + totalTranslation;

        // Check right neighbor
        if (idx < order.length - 1) {
            const right = centers[idx + 1];
            if (myCurrentCenter > right.center) {
                const positionDelta = right.width + CHIP_GAP;
                dragOffsetX.value -= positionDelta;
                lastSwapTimeRef.current = now;
                const newOrder = [...order];
                [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                LayoutAnimation.configureNext({
                    duration: 200,
                    update: { type: LayoutAnimation.Types.easeInEaseOut },
                });
                reorderStudents(newOrder);
                Haptics.selectionAsync();
                return;
            }
        }

        // Check left neighbor
        if (idx > 0) {
            const left = centers[idx - 1];
            if (myCurrentCenter < left.center) {
                const positionDelta = left.width + CHIP_GAP;
                dragOffsetX.value += positionDelta;
                lastSwapTimeRef.current = now;
                const newOrder = [...order];
                [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
                LayoutAnimation.configureNext({
                    duration: 200,
                    update: { type: LayoutAnimation.Types.easeInEaseOut },
                });
                reorderStudents(newOrder);
                Haptics.selectionAsync();
                return;
            }
        }
    }, [reorderStudents, dragOffsetX]);

    const handleDragEnd = useCallback(() => {
        setDraggingChipState(null);
        setChipScrollEnabled(true);
    }, []);

    const activeSession = activeStudentId ? sessions[activeStudentId] : null;

    // Clear expired sessions on mount and offer restoration
    const hasShownRestorationRef = useRef(false);
    useEffect(() => {
        clearExpiredSessions();

        // Check for sessions restored from MMKV
        const restored = Object.values(useTrainingRoomStore.getState().sessions);
        if (restored.length > 0 && !hasShownRestorationRef.current) {
            hasShownRestorationRef.current = true;
            const inProgress = restored.filter((s) => s.status === 'in_progress');
            if (inProgress.length > 0) {
                const names = inProgress.map((s) => s.studentName).join(', ');
                Alert.alert(
                    'Sessões restauradas',
                    `${inProgress.length} sessão(ões) em andamento foram restauradas: ${names}`,
                    [
                        {
                            text: 'Descartar todas',
                            style: 'destructive',
                            onPress: () => {
                                for (const s of inProgress) removeStudent(s.studentId);
                            },
                        },
                        { text: 'Continuar', style: 'default' },
                    ],
                );
            }
        }
    }, [clearExpiredSessions, removeStudent]);

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

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { completed } = useTrainingRoomStore.getState().getCompletedSets(studentId);
        const firstName = session.studentName.split(' ')[0];

        if (session.status === 'in_progress' && completed > 0) {
            Alert.alert(
                'Remover da sessão?',
                `${firstName} tem ${completed} série(s) registrada(s) que não foram salvas. Deseja remover mesmo assim?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Remover', style: 'destructive', onPress: () => removeStudent(studentId) },
                ],
            );
        } else if (session.status === 'in_progress') {
            Alert.alert(
                'Remover da sessão?',
                `Remover ${firstName} da Sala de Treino?`,
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
                        paddingHorizontal: 20,
                        paddingTop: 8,
                        paddingBottom: sessionCount > 0 ? 6 : 12,
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
                        {/* Compact student chip strip — long press + drag to reorder */}
                        <ScrollView
                            horizontal
                            scrollEnabled={chipScrollEnabled}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{
                                paddingHorizontal: 20,
                                paddingTop: 4,
                                paddingBottom: 8,
                                gap: CHIP_GAP,
                                alignItems: 'center',
                            }}
                            style={{ flexGrow: 0, overflow: 'visible' }}
                        >
                            {displayOrder.map((id) => {
                                const session = sessions[id];
                                if (!session) return null;
                                return (
                                    <DraggableChipSlot
                                        key={id}
                                        chipId={id}
                                        dragTranslateX={dragTranslateX}
                                        draggingChipIdSV={draggingChipIdSV}
                                        dragOffsetX={dragOffsetX}
                                        onDragStart={() => handleDragStart(id)}
                                        onDragUpdate={(tx) => handleDragUpdate(id, tx)}
                                        onDragEnd={handleDragEnd}
                                        onMeasure={(w) => chipWidthsRef.current.set(id, w)}
                                    >
                                        <StudentChip
                                            session={session}
                                            isActive={id === activeStudentId}
                                            isDragging={id === draggingChipState}
                                            onPress={() => handleChipPress(id)}
                                            onRemove={() => handleRemoveStudent(id)}
                                        />
                                    </DraggableChipSlot>
                                );
                            })}
                            {/* "+ Aluno" chip */}
                            <TouchableOpacity
                                onPress={() => setIsPickerOpen(true)}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    height: 36,
                                    paddingHorizontal: 12,
                                    borderRadius: 18,
                                    backgroundColor: '#fff',
                                    borderWidth: 1,
                                    borderColor: '#e2e8f0',
                                    borderStyle: 'dashed',
                                }}
                            >
                                <Plus size={14} color="#7c3aed" />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#7c3aed' }}>
                                    Aluno
                                </Text>
                            </TouchableOpacity>
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

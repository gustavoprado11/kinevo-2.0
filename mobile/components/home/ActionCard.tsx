import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Dumbbell, ChevronRight, Coffee, Check, Play, AlertCircle, PartyPopper, RotateCcw } from "lucide-react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    Easing,
    cancelAnimation,
} from "react-native-reanimated";
import { PressableScale } from "../shared/PressableScale";
import * as Haptics from "expo-haptics";
import type { PendingWorkout, WeeklyProgress } from "@kinevo/shared/utils/schedule-projection";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Breathing Share Button ──
function BreatheShareButton({ onPress }: { onPress: () => void }) {
    const scale = useSharedValue(1);
    const isPressed = useSharedValue(false);

    useEffect(() => {
        scale.value = withRepeat(
            withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        isPressed.value = true;
        cancelAnimation(scale);
        scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePressOut = () => {
        isPressed.value = false;
        scale.value = withSpring(1, { damping: 12, stiffness: 200 }, (finished) => {
            if (finished) {
                scale.value = withRepeat(
                    withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    -1,
                    true
                );
            }
        });
    };

    return (
        <AnimatedPressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
                animatedStyle,
                {
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(124, 58, 237, 0.18)',
                },
            ]}
        >
            <Text style={{ color: '#7c3aed', fontSize: 12, fontWeight: '700' }}>
                Compartilhar
            </Text>
        </AnimatedPressable>
    );
}

type TimeContext = 'today' | 'past' | 'future';

interface ActionCardProps {
    /** Workout scheduled for today (may be null if rest day) */
    todayWorkout?: {
        id: string;
        name: string;
        items?: { length: number } | any[];
        notes?: string;
    } | null;
    /** Session completed today for the scheduled workout */
    todaySession?: {
        id: string;
        started_at: string;
        completed_at?: string;
        rpe?: number | null;
    } | null;
    /** Full weekly progress data */
    weeklyProgress?: WeeklyProgress | null;
    /** Callbacks */
    onStartWorkout?: (workoutId: string) => void;
    onShare?: () => void;
    /** Legacy props for past/future date viewing */
    selectedWorkout?: {
        id: string;
        name: string;
        items?: { length: number } | any[];
        notes?: string;
    } | null;
    isCompleted?: boolean;
    isMissed?: boolean;
    title?: string;
    timeContext?: TimeContext;
    onPress?: () => void;
}

export function ActionCard({
    todayWorkout,
    todaySession,
    weeklyProgress,
    onStartWorkout,
    onShare,
    // Legacy/past-date props
    selectedWorkout,
    isCompleted,
    isMissed,
    title,
    timeContext = 'today',
    onPress,
}: ActionCardProps) {
    // ─── Non-today view: keep legacy behavior for past/future dates ───
    if (timeContext !== 'today') {
        const workout = selectedWorkout;
        const sectionTitle = title || "Hoje";

        if (!workout) {
            return (
                <View style={{ marginBottom: 32 }}>
                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                    <View style={styles.cardShell}>
                        <View style={styles.cardInner}>
                            <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Coffee size={24} color="#10b981" strokeWidth={1.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Descanso Merecido</Text>
                                <Text style={styles.cardSubtitle}>
                                    Recupere suas energias para o próximo treino.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (isCompleted) {
            return (
                <View style={{ marginBottom: 28 }}>
                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                    <PressableScale onPress={onPress} pressScale={0.96} style={styles.completedShell}>
                        <View style={styles.completedInner}>
                            <View style={styles.checkIcon}>
                                <Check size={22} color="#16a34a" strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{workout.name}</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#16a34a' }}>
                                    Concluído com sucesso!
                                </Text>
                            </View>
                            {onShare && <BreatheShareButton onPress={onShare} />}
                        </View>
                    </PressableScale>
                </View>
            );
        }

        if (isMissed) {
            return (
                <View style={{ marginBottom: 28 }}>
                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                    <PressableScale onPress={onPress} pressScale={0.96} style={styles.cardShell}>
                        <View style={[styles.cardInner, { borderColor: 'rgba(239, 68, 68, 0.15)' }]}>
                            <View style={[styles.iconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                                <Text style={{ fontSize: 20, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{workout.name}</Text>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#ef4444' }}>
                                    Treino não realizado
                                </Text>
                            </View>
                        </View>
                    </PressableScale>
                </View>
            );
        }

        // Future
        return (
            <View style={{ marginBottom: 32 }}>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                <PressableScale pressScale={0.96} style={[styles.cardShell, { opacity: 0.7 }]}>
                    <View style={styles.heroCardInner}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <View style={styles.heroIcon}>
                                <Dumbbell size={20} color="#7c3aed" />
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>PREVISTO</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{workout.name}</Text>
                        {workout.notes && (
                            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }} numberOfLines={1}>
                                {workout.notes}
                            </Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                                {(Array.isArray(workout.items) ? workout.items.length : workout.items?.length) || 0} exercícios
                            </Text>
                        </View>
                    </View>
                </PressableScale>
            </View>
        );
    }

    // ─── TODAY view: new state machine ───
    const pending = weeklyProgress?.pendingWorkouts || [];
    const isWeekComplete = weeklyProgress?.isWeekComplete || false;
    const remaining = (weeklyProgress?.expectedCount || 0) - (weeklyProgress?.completedCount || 0);
    const hasTodaySession = !!todaySession;

    // STATE 1: Scheduled today + not done yet
    if (todayWorkout && !hasTodaySession) {
        return (
            <View style={{ marginBottom: 32 }}>
                <Text style={styles.sectionTitle}>Treino de Hoje</Text>
                <PressableScale
                    onPress={() => onStartWorkout?.(todayWorkout.id)}
                    pressScale={0.96}
                    style={styles.cardShell}
                >
                    <View style={styles.heroCardInner}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <View style={styles.heroIcon}>
                                <Dumbbell size={20} color="#7c3aed" />
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>AGENDADO</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{todayWorkout.name}</Text>
                        {todayWorkout.notes && (
                            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }} numberOfLines={1}>
                                {todayWorkout.notes}
                            </Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                                {(Array.isArray(todayWorkout.items) ? todayWorkout.items.length : todayWorkout.items?.length) || 0} exercícios
                            </Text>
                            <View style={styles.startButton}>
                                <Play size={16} color="white" fill="white" />
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Iniciar</Text>
                            </View>
                        </View>
                    </View>
                </PressableScale>
            </View>
        );
    }

    // STATE 2: Done today + still has pending workouts this week
    if (hasTodaySession && remaining > 0) {
        const nextPending = pending[0];
        const startDate = new Date(todaySession!.started_at);
        const endDate = todaySession!.completed_at ? new Date(todaySession!.completed_at) : new Date();
        const durationMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
        const durationStr = durationMin >= 60
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
            : `${durationMin}min`;

        return (
            <View style={{ marginBottom: 28 }}>
                <Text style={styles.sectionTitle}>Treino de Hoje</Text>

                {/* Completed summary */}
                <PressableScale onPress={onPress} pressScale={0.96} style={styles.completedShell}>
                    <View style={styles.completedInner}>
                        <View style={styles.checkIcon}>
                            <Check size={22} color="#16a34a" strokeWidth={2.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>
                                {todayWorkout?.name || 'Treino concluído'}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: '#16a34a' }}>
                                {durationStr}{todaySession!.rpe ? ` • PSE ${todaySession!.rpe}` : ''}
                            </Text>
                        </View>
                        {onShare && <BreatheShareButton onPress={onShare} />}
                    </View>
                </PressableScale>

                {/* Pending workout suggestion */}
                {nextPending && (
                    <View style={{ marginTop: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <AlertCircle size={14} color="#f59e0b" strokeWidth={2} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400e', marginLeft: 6 }}>
                                {remaining === 1 ? 'Resta 1 treino esta semana' : `Restam ${remaining} treinos esta semana`}
                            </Text>
                        </View>
                        <PressableScale
                            onPress={() => onStartWorkout?.(nextPending.assignedWorkoutId)}
                            pressScale={0.97}
                            style={styles.cardShell}
                        >
                            <View style={[styles.cardInner, { borderColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                <View style={[styles.iconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                                    <Dumbbell size={20} color="#f59e0b" strokeWidth={1.5} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>{nextPending.workoutName}</Text>
                                    <Text style={styles.cardSubtitle}>
                                        era para {nextPending.originalDay} ({nextPending.missedDate})
                                    </Text>
                                </View>
                                <ChevronRight size={18} color="#f59e0b" strokeWidth={1.5} />
                            </View>
                        </PressableScale>
                        {pending.length > 1 && (
                            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
                                e mais {pending.length - 1} treino{pending.length - 1 > 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    }

    // STATE 3: Done today + week complete
    if (hasTodaySession && isWeekComplete) {
        const startDate = new Date(todaySession!.started_at);
        const endDate = todaySession!.completed_at ? new Date(todaySession!.completed_at) : new Date();
        const durationMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
        const durationStr = durationMin >= 60
            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
            : `${durationMin}min`;

        return (
            <View style={{ marginBottom: 28 }}>
                <Text style={styles.sectionTitle}>Treino de Hoje</Text>
                <PressableScale onPress={onPress} pressScale={0.96} style={styles.completedShell}>
                    <View style={styles.completedInner}>
                        <View style={styles.checkIcon}>
                            <Check size={22} color="#16a34a" strokeWidth={2.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>
                                {todayWorkout?.name || 'Treino concluído'}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: '#16a34a' }}>
                                {durationStr}{todaySession!.rpe ? ` • PSE ${todaySession!.rpe}` : ''} — Semana completa!
                            </Text>
                        </View>
                        {onShare && <BreatheShareButton onPress={onShare} />}
                    </View>
                </PressableScale>
            </View>
        );
    }

    // STATE 4: No workout scheduled today + has pending workouts
    if (!todayWorkout && !hasTodaySession && pending.length > 0) {
        const nextPending = pending[0];
        return (
            <View style={{ marginBottom: 32 }}>
                <Text style={styles.sectionTitle}>Treino de Hoje</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <AlertCircle size={16} color="#f59e0b" strokeWidth={2} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400e', marginLeft: 8 }}>
                        {pending.length === 1
                            ? 'Você tem 1 treino pendente'
                            : `Você tem ${pending.length} treinos pendentes`}
                    </Text>
                </View>

                <PressableScale
                    onPress={() => onStartWorkout?.(nextPending.assignedWorkoutId)}
                    pressScale={0.96}
                    style={styles.cardShell}
                >
                    <View style={styles.heroCardInner}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <View style={[styles.heroIcon, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                                <Dumbbell size={20} color="#f59e0b" />
                            </View>
                            <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                                <Text style={[styles.badgeText, { color: '#f59e0b' }]}>PENDENTE</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{nextPending.workoutName}</Text>
                        <Text style={{ fontSize: 13, color: '#92400e', marginBottom: 16 }}>
                            era para {nextPending.originalDay} ({nextPending.missedDate})
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                                {nextPending.exerciseCount} exercícios
                            </Text>
                            <View style={[styles.startButton, { backgroundColor: '#f59e0b' }]}>
                                <Play size={16} color="white" fill="white" />
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Compensar</Text>
                            </View>
                        </View>
                    </View>
                </PressableScale>

                {pending.length > 1 && (
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
                        e mais {pending.length - 1} treino{pending.length - 1 > 1 ? 's' : ''} pendente{pending.length - 1 > 1 ? 's' : ''}
                    </Text>
                )}
            </View>
        );
    }

    // STATE 5: No workout today + week complete (all done!)
    if (!todayWorkout && !hasTodaySession && isWeekComplete) {
        return (
            <View style={{ marginBottom: 32 }}>
                <Text style={styles.sectionTitle}>Treino de Hoje</Text>
                <View style={styles.cardShell}>
                    <View style={[styles.cardInner, { borderColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                            <PartyPopper size={24} color="#10b981" strokeWidth={1.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>Semana completa! 🎉</Text>
                            <Text style={styles.cardSubtitle}>
                                Todos os {weeklyProgress?.expectedCount || 0} treinos foram concluídos.
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // STATE 6: Rest day — no workout, no pending, week not complete (future days have workouts)
    return (
        <View style={{ marginBottom: 32 }}>
            <Text style={styles.sectionTitle}>Treino de Hoje</Text>
            <View style={styles.cardShell}>
                <View style={styles.cardInner}>
                    <View style={[styles.iconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                        <Coffee size={24} color="#10b981" strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Descanso Merecido</Text>
                        <Text style={styles.cardSubtitle}>
                            {remaining > 0
                                ? `${remaining} treino${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} esta semana.`
                                : 'Recupere suas energias para o próximo treino.'}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// ── Shared styles ──
const styles = {
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: '#0f172a',
        marginBottom: 14,
        letterSpacing: 0.5,
    },
    cardShell: {
        borderRadius: 24,
        overflow: 'hidden' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardInner: {
        backgroundColor: '#ffffff',
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    heroCardInner: {
        backgroundColor: '#ffffff',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    completedShell: {
        borderRadius: 24,
        overflow: 'hidden' as const,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
    },
    completedInner: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.15)',
        backgroundColor: '#f0fdf9',
    },
    checkIcon: {
        height: 48,
        width: 48,
        borderRadius: 24,
        backgroundColor: '#dcfce7',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginRight: 16,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    iconBadge: {
        height: 48,
        width: 48,
        borderRadius: 14,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginRight: 16,
    },
    heroIcon: {
        height: 44,
        width: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    badge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    badgeText: {
        color: '#64748b',
        fontSize: 9,
        fontWeight: '700' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: 2.5,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '800' as const,
        color: '#0f172a',
        marginBottom: 6,
    },
    startButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: '#7c3aed',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        gap: 6,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: '#0f172a',
        marginBottom: 3,
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
};

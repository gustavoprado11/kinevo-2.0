import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Calendar, Trophy, ChevronDown, Flame, Check, Clock, Dumbbell, Repeat,
} from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Easing,
    FadeInUp,
    runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useWorkoutHistory, HistorySession, HistoryStats } from '../../hooks/useWorkoutHistory';
import { PressableScale } from '../../components/shared/PressableScale';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Segmented Control with Sliding Pill ──
const SEGMENT_WIDTH_RATIO = 0.5; // each segment = 50%

function AnimatedSegmentedControl({
    activeTab,
    onTabChange,
}: {
    activeTab: 'history' | 'performance';
    onTabChange: (tab: 'history' | 'performance') => void;
}) {
    const pillX = useSharedValue(activeTab === 'history' ? 0 : 1);

    const handlePress = useCallback((tab: 'history' | 'performance') => {
        Haptics.selectionAsync();
        pillX.value = withSpring(tab === 'history' ? 0 : 1, { damping: 20, stiffness: 200 });
        onTabChange(tab);
    }, [onTabChange]);

    const pillStyle = useAnimatedStyle(() => ({
        position: 'absolute' as const,
        top: 4,
        bottom: 4,
        left: 4,
        width: '48%',
        borderRadius: 11,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        transform: [
            { translateX: interpolate(pillX.value, [0, 1], [0, 1]) },
        ],
        // We use 'left' percentage interpolation via a different approach
    }));

    // Calculate pill position using a wrapper approach
    const pillAnimStyle = useAnimatedStyle(() => {
        return {
            left: `${interpolate(pillX.value, [0, 1], [0.8, 50.8])}%`,
        };
    });

    return (
        <View
            style={{
                marginHorizontal: 20,
                marginVertical: 16,
                backgroundColor: 'rgba(226, 232, 240, 0.7)',
                borderRadius: 14,
                padding: 4,
                flexDirection: 'row',
                position: 'relative',
            }}
        >
            {/* Sliding pill */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        top: 4,
                        bottom: 4,
                        width: '48%',
                        borderRadius: 11,
                        backgroundColor: '#ffffff',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 3,
                        elevation: 2,
                    },
                    pillAnimStyle,
                ]}
            />

            {/* History tab */}
            <Pressable
                onPress={() => handlePress('history')}
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: 11,
                    gap: 8,
                }}
            >
                <Calendar size={16} color={activeTab === 'history' ? '#0f172a' : '#64748b'} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: activeTab === 'history' ? '700' : '500',
                        letterSpacing: 0.5,
                        color: activeTab === 'history' ? '#0f172a' : '#64748b',
                    }}
                >
                    Histórico
                </Text>
            </Pressable>

            {/* Performance tab */}
            <Pressable
                onPress={() => handlePress('performance')}
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: 11,
                    gap: 8,
                }}
            >
                <Trophy size={16} color={activeTab === 'performance' ? '#0f172a' : '#64748b'} />
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: activeTab === 'performance' ? '700' : '500',
                        letterSpacing: 0.5,
                        color: activeTab === 'performance' ? '#0f172a' : '#64748b',
                    }}
                >
                    Desempenho
                </Text>
            </Pressable>
        </View>
    );
}

// ── Main Screen ──
export default function LogsScreen() {
    const [activeTab, setActiveTab] = useState<'history' | 'performance'>('history');
    const { history, stats, isLoading } = useWorkoutHistory();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }} edges={['top']}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 30, fontWeight: '800', color: '#0f172a' }}>
                    Histórico de Treinos
                </Text>
                <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                    Acompanhe sua evolução
                </Text>
            </View>

            <AnimatedSegmentedControl activeTab={activeTab} onTabChange={setActiveTab} />

            <ScrollView
                style={{ flex: 1, paddingHorizontal: 20 }}
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <Text style={{ color: '#64748b', textAlign: 'center', marginTop: 40 }}>
                        Carregando histórico...
                    </Text>
                ) : activeTab === 'history' ? (
                    <HistoryList history={history} />
                ) : (
                    <PerformanceView stats={stats} />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

/* ─── History Tab ─── */

function HistoryList({ history }: { history: HistorySession[] }) {
    if (!history.length) {
        return (
            <Animated.View
                entering={FadeInUp.delay(100).springify().damping(18)}
                style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}
            >
                <View
                    style={{
                        width: 64, height: 64, backgroundColor: '#f1f5f9',
                        borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                    }}
                >
                    <Calendar size={28} color="#94a3b8" />
                </View>
                <Text style={{ color: '#64748b', textAlign: 'center', fontSize: 14 }}>
                    Nenhum treino registrado ainda.
                </Text>
            </Animated.View>
        );
    }

    return (
        <View>
            <Text
                style={{
                    fontSize: 12, fontWeight: '700', color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: 1,
                    marginBottom: 12, paddingHorizontal: 4,
                }}
            >
                Últimas Atividades
            </Text>
            {history.map((session, index) => (
                <Animated.View
                    key={session.id}
                    entering={FadeInUp.delay(index * 80).springify().damping(18).stiffness(100)}
                >
                    <HistoryCard session={session} />
                </Animated.View>
            ))}
        </View>
    );
}

function HistoryCard({ session }: { session: HistorySession }) {
    const [expanded, setExpanded] = useState(false);
    const chevronRotation = useSharedValue(0);

    const toggleExpand = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const next = !expanded;
        setExpanded(next);
        chevronRotation.value = withSpring(next ? 1 : 0, { damping: 20, stiffness: 150 });
    }, [expanded]);

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(chevronRotation.value, [0, 1], [0, 180])}deg` }],
    }));

    const dateStr = new Date(session.completed_at).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    }).toUpperCase();

    const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

    return (
        <PressableScale
            onPress={toggleExpand}
            pressScale={0.97}
            style={{
                backgroundColor: '#ffffff',
                borderRadius: 20,
                marginBottom: 14,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(0, 0, 0, 0.04)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            {/* Header */}
            <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
                                {session.workout_name}
                            </Text>
                            {session.is_intense && (
                                <View
                                    style={{
                                        backgroundColor: '#fff7ed', paddingHorizontal: 8,
                                        paddingVertical: 3, borderRadius: 8,
                                        flexDirection: 'row', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    <Flame size={10} color="#ea580c" fill="#ea580c" />
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#ea580c', letterSpacing: 1 }}>
                                        INTENSO
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 4, textTransform: 'uppercase' }}>
                            {dateStr}
                        </Text>
                    </View>
                    <Animated.View style={chevronStyle}>
                        <ChevronDown size={18} color="#cbd5e1" />
                    </Animated.View>
                </View>

                {/* Metrics */}
                <View
                    style={{
                        flexDirection: 'row', alignItems: 'center', marginTop: 12,
                        paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 20,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} color="#64748b" />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                            {Math.floor(session.duration_seconds / 60)} <Text>min</Text>
                        </Text>
                    </View>
                    <View style={{ width: 1, height: 12, backgroundColor: '#e2e8f0' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Dumbbell size={14} color="#64748b" />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                            {(session.volume_load / 1000).toFixed(1)} <Text>ton</Text>
                        </Text>
                    </View>
                    <View style={{ width: 1, height: 12, backgroundColor: '#e2e8f0' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Repeat size={14} color="#64748b" />
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b' }}>
                            {totalSets} <Text>séries</Text>
                        </Text>
                    </View>
                </View>
            </View>

            {/* Expanded Content */}
            {expanded && (
                <Animated.View
                    entering={FadeInUp.duration(200)}
                    style={{ paddingHorizontal: 20, paddingBottom: 20 }}
                >
                    {session.exercises.map((exercise, idx) => (
                        <View
                            key={exercise.id}
                            style={{
                                marginTop: idx === 0 ? 0 : 12,
                                paddingTop: idx === 0 ? 0 : 12,
                                borderTopWidth: idx === 0 ? 0 : 1,
                                borderTopColor: '#f1f5f9',
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View
                                    style={{
                                        width: 3, height: 16, backgroundColor: '#7c3aed',
                                        borderRadius: 2, marginRight: 10,
                                    }}
                                />
                                <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b', flex: 1 }}>
                                    {exercise.name}
                                </Text>
                            </View>
                            <View style={{ gap: 6, paddingLeft: 13 }}>
                                {exercise.sets.map((set, setIdx) => (
                                    <View
                                        key={set.id}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            justifyContent: 'space-between', backgroundColor: '#f8fafc',
                                            paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
                                        }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', width: 28 }}>
                                            #{setIdx + 1}
                                        </Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', width: 72, textAlign: 'center' }}>
                                            {set.weight}kg
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', width: 56, textAlign: 'right' }}>
                                            {set.reps} reps
                                        </Text>
                                        <View style={{ width: 20, alignItems: 'flex-end' }}>
                                            {set.completed && <Check size={14} color="#34d399" strokeWidth={2.5} />}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </Animated.View>
            )}
        </PressableScale>
    );
}

/* ─── Performance Tab with Count-Up ─── */

function AnimatedCounter({ value, suffix }: { value: number; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);

    useFocusEffect(
        useCallback(() => {
            setDisplayValue(0);
            const target = value;
            const duration = 1200;
            const steps = 40;
            const stepTime = duration / steps;
            let current = 0;

            const timer = setInterval(() => {
                current++;
                const progress = current / steps;
                // Ease-out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const val = Math.round(eased * target);
                setDisplayValue(val);
                if (current >= steps) clearInterval(timer);
            }, stepTime);

            return () => clearInterval(timer);
        }, [value])
    );

    return (
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
            {displayValue}{suffix || ''}
        </Text>
    );
}

function PerformanceView({ stats }: { stats: HistoryStats }) {
    return (
        <View>
            {/* Jornada Card */}
            <Animated.View
                entering={FadeInUp.delay(100).springify().damping(18)}
                style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    padding: 24,
                    marginBottom: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(0, 0, 0, 0.04)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                }}
            >
                <Text
                    style={{
                        fontSize: 12, fontWeight: '700', color: '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20,
                    }}
                >
                    Sua Jornada
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <AnimatedCounter value={stats.totalWorkouts} />
                        <Text style={labelStyle}>Treinos</Text>
                    </View>
                    <View
                        style={{
                            alignItems: 'center', flex: 1,
                            borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#f1f5f9',
                        }}
                    >
                        <AnimatedCounter value={Math.round(stats.totalVolume)} />
                        <Text style={labelStyle}>Toneladas</Text>
                    </View>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <AnimatedCounter value={stats.totalHours} />
                        <Text style={labelStyle}>Horas</Text>
                    </View>
                </View>
            </Animated.View>

            {/* Recordes Pessoais */}
            <View>
                <Animated.View
                    entering={FadeInUp.delay(200).springify().damping(18)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 }}
                >
                    <Text
                        style={{
                            fontSize: 12, fontWeight: '700', color: '#94a3b8',
                            textTransform: 'uppercase', letterSpacing: 1,
                        }}
                    >
                        Recordes Pessoais
                    </Text>
                    <Trophy size={14} color="#f59e0b" fill="#f59e0b" />
                </Animated.View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {stats.personalRecords.map((pr, idx) => (
                        <Animated.View
                            key={idx}
                            entering={FadeInUp.delay(300 + idx * 80).springify().damping(18).stiffness(100)}
                            style={{ width: '48%', marginBottom: 12 }}
                        >
                            <PressableScale
                                pressScale={0.96}
                                style={{
                                    backgroundColor: '#ffffff',
                                    padding: 16,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: 'rgba(0, 0, 0, 0.04)',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 8,
                                    elevation: 2,
                                }}
                            >
                                <Text
                                    style={{ fontSize: 14, color: '#64748b', fontWeight: '500', marginBottom: 6 }}
                                    numberOfLines={1}
                                >
                                    {pr.exerciseName}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    <Text style={{ fontSize: 30, fontWeight: '800', color: '#0f172a' }}>
                                        {pr.weight}
                                    </Text>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#94a3b8', marginLeft: 3 }}>
                                        kg
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                                    {new Date(pr.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </Text>
                            </PressableScale>
                        </Animated.View>
                    ))}
                    {stats.personalRecords.length === 0 && (
                        <Text style={{ color: '#64748b', fontStyle: 'italic', width: '100%', textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                            Complete treinos para registrar seus recordes!
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
}

const labelStyle = {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    fontWeight: '700' as const,
};

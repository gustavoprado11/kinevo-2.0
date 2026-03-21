import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Calendar, Trophy, ChevronDown, Flame, Check, Clock, Dumbbell, Repeat, ClipboardCheck, FileText,
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useWorkoutHistory, HistorySession, HistoryStats, HistoryWorkoutItem } from '../../hooks/useWorkoutHistory';
import { useStudentProfile } from '../../hooks/useStudentProfile';
import { supabase } from '../../lib/supabase';
import { WARMUP_TYPE_LABELS, CARDIO_EQUIPMENT_LABELS, type WarmupType, type CardioEquipment, type CardioConfig } from '@kinevo/shared/types/workout-items';
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>
                                {dateStr}
                            </Text>
                            {session.has_pre_checkin && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(124,58,237,0.08)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                    <ClipboardCheck size={9} color="#7c3aed" />
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#7c3aed' }}>Pré</Text>
                                </View>
                            )}
                            {session.has_post_checkin && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(16,185,129,0.08)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                    <ClipboardCheck size={9} color="#10b981" />
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#10b981' }}>Pós</Text>
                                </View>
                            )}
                        </View>
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
                            {session.duration_seconds != null
                                ? `${Math.floor(session.duration_seconds / 60)} min`
                                : '—'}
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
                    {session.workoutItems.length > 0 ? (
                        session.workoutItems.map((item, idx) => (
                            <HistoryItemRenderer key={item.id} item={item} isFirst={idx === 0} />
                        ))
                    ) : (
                        session.exercises.map((exercise, idx) => (
                            <View
                                key={exercise.id}
                                style={{
                                    marginTop: idx === 0 ? 0 : 12,
                                    paddingTop: idx === 0 ? 0 : 12,
                                    borderTopWidth: idx === 0 ? 0 : 1,
                                    borderTopColor: '#f1f5f9',
                                }}
                            >
                                <ExerciseSetsView name={exercise.name} sets={exercise.sets} />
                            </View>
                        ))
                    )}
                </Animated.View>
            )}
        </PressableScale>
    );
}

/* ─── Workout Item Renderers ─── */

function ExerciseSetsView({ name, sets }: { name: string; sets: { id: string; weight: number; reps: number; completed: boolean }[] }) {
    return (
        <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 3, height: 16, backgroundColor: '#7c3aed', borderRadius: 2, marginRight: 10 }} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748b', flex: 1 }}>{name}</Text>
            </View>
            <View style={{ gap: 6, paddingLeft: 13 }}>
                {sets.map((set, setIdx) => (
                    <View
                        key={set.id}
                        style={{
                            flexDirection: 'row', alignItems: 'center',
                            justifyContent: 'space-between', backgroundColor: '#f8fafc',
                            paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', width: 28 }}>#{setIdx + 1}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', width: 72, textAlign: 'center' }}>{set.weight}kg</Text>
                        <Text style={{ fontSize: 12, color: '#64748b', width: 56, textAlign: 'right' }}>{set.reps} reps</Text>
                        <View style={{ width: 20, alignItems: 'flex-end' }}>
                            {set.completed && <Check size={14} color="#34d399" strokeWidth={2.5} />}
                        </View>
                    </View>
                ))}
            </View>
        </>
    );
}

function HistoryItemRenderer({ item, isFirst }: { item: HistoryWorkoutItem; isFirst: boolean }) {
    const separator = !isFirst ? { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' } : {};

    if (item.itemType === 'warmup') {
        const config = item.itemConfig as { warmup_type?: WarmupType; duration_minutes?: number; description?: string } | undefined;
        const label = config?.warmup_type ? (WARMUP_TYPE_LABELS[config.warmup_type] || 'Aquecimento') : 'Aquecimento';
        return (
            <View style={{ ...separator as any }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(234,88,12,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Flame size={16} color="#ea580c" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>{label}</Text>
                        {(config?.duration_minutes || config?.description) && (
                            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                {config?.duration_minutes ? `${config.duration_minutes} min` : ''}{config?.duration_minutes && config?.description ? ' · ' : ''}{config?.description || ''}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    if (item.itemType === 'cardio') {
        const config = item.itemConfig as CardioConfig | undefined;
        const result = item.cardioResult;
        const equipment = (result?.equipment || config?.equipment) as CardioEquipment | undefined;
        const equipLabel = equipment ? (CARDIO_EQUIPMENT_LABELS[equipment] || 'Aeróbio') : 'Aeróbio';
        const mode = result?.mode || config?.mode;
        const details: string[] = [];
        if (result?.duration_minutes || config?.duration_minutes) details.push(`${result?.duration_minutes || config?.duration_minutes} min`);
        if (result?.distance_km || config?.distance_km) details.push(`${result?.distance_km || config?.distance_km} km`);
        if (result?.intensity || config?.intensity) details.push(result?.intensity || config?.intensity || '');

        return (
            <View style={{ ...separator as any }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Dumbbell size={16} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                            {equipLabel}
                            {mode ? <Text style={{ fontSize: 12, fontWeight: '400', color: '#94a3b8' }}> · {mode === 'continuous' ? 'Contínuo' : 'Intervalado'}</Text> : null}
                        </Text>
                        {details.length > 0 && (
                            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{details.join(' · ')}</Text>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    if (item.itemType === 'note' && item.notes) {
        return (
            <View style={{ ...separator as any }}>
                <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{item.notes}</Text>
                </View>
            </View>
        );
    }

    if (item.itemType === 'superset') {
        return (
            <View style={{ ...separator as any }}>
                <View style={{ borderLeftWidth: 2, borderLeftColor: '#7c3aed', borderRadius: 8, paddingLeft: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        {(item.children?.length || 0) <= 2 ? 'Bi-set' : 'Tri-set'}
                    </Text>
                    {(item.children || []).map((child, idx) => (
                        <View key={child.id} style={idx > 0 ? { marginTop: 10 } : {}}>
                            <ExerciseSetsView
                                name={child.exerciseName || 'Exercício'}
                                sets={child.setLogs}
                            />
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    // Exercise
    if (item.itemType === 'exercise') {
        return (
            <View style={{ ...separator as any }}>
                <ExerciseSetsView
                    name={item.exerciseName || 'Exercício'}
                    sets={item.setLogs}
                />
            </View>
        );
    }

    return null;
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

function PublishedReportsSection() {
    const { profile } = useStudentProfile();
    const router = useRouter();
    const [reports, setReports] = useState<{ id: string; program_name: string; program_started_at: string | null; program_completed_at: string | null; status: string }[]>([]);

    useEffect(() => {
        if (!profile?.id) return;
        (async () => {
            const { data } = await (supabase as any)
                .from("program_reports")
                .select("id, program_name, program_started_at, program_completed_at, status")
                .eq("student_id", profile.id)
                .eq("status", "published")
                .order("generated_at", { ascending: false });
            if (data) setReports(data);
        })();
    }, [profile?.id]);

    if (reports.length === 0) return null;

    return (
        <Animated.View entering={FadeInUp.delay(400).springify().damping(18)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Relatórios de Programa
                </Text>
                <FileText size={14} color="#7c3aed" />
            </View>
            {reports.map((r) => {
                const period = [r.program_started_at, r.program_completed_at]
                    .filter(Boolean)
                    .map((d) => new Date(d!).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }))
                    .join(" — ");
                return (
                    <TouchableOpacity
                        key={r.id}
                        activeOpacity={0.7}
                        onPress={() => router.push({ pathname: "/report/[id]", params: { id: r.id } } as any)}
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: 'rgba(0,0,0,0.04)',
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }} numberOfLines={1}>
                            {r.program_name}
                        </Text>
                        {period ? (
                            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{period}</Text>
                        ) : null}
                    </TouchableOpacity>
                );
            })}
        </Animated.View>
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

            {/* Published Program Reports */}
            <PublishedReportsSection />
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

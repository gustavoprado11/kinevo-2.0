import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager, TouchableOpacity, FlatList, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Calendar, Trophy, ChevronDown, Flame, Check, Clock, Dumbbell, Repeat2, ClipboardCheck, FileText,
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
import { ANIM } from '../../lib/animations';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutHistory, HistorySession, HistoryStats, HistoryWorkoutItem } from '../../hooks/useWorkoutHistory';
import { useStravaActivities } from '../../hooks/useStravaActivities';
import { StravaActivityRow } from '../../components/strava/StravaActivityRow';
import type { Database } from '@kinevo/shared';

type ExternalActivityRow = Database['public']['Tables']['external_activities']['Row'];
type HistoryFilter = 'all' | 'kinevo' | 'strava' | 'this_week';
import { useStudentProfile } from '../../hooks/useStudentProfile';
import { supabase } from '../../lib/supabase';
import { WARMUP_TYPE_LABELS, CARDIO_EQUIPMENT_LABELS, type WarmupType, type CardioEquipment, type CardioConfig } from '@kinevo/shared/types/workout-items';
import { PressableScale } from '../../components/shared/PressableScale';
import { KPRCard } from '../../components/v2/student';
import { useV2Colors } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';
import { v2 } from '@kinevo/shared/tokens';
import { WorkoutHealthCard } from '../../components/workout/WorkoutHealthCard';
import { useWorkoutHealthSummary } from '../../hooks/useWorkoutHealthSummary';
import { useActiveProgram } from '../../hooks/useActiveProgram';
import { WeekGoalCard, JourneyCard, IntensityBadge } from '../../components/history';
import {
    buildWeekGoalData,
    buildJourneyData,
    getWorkoutCategory,
    getIntensity,
    formatActivityDate,
    formatTon,
    type WorkoutCategory,
} from '../../lib/history';

// Cores do tile de categoria na ActivityRow (tokens-reference §CATEGORIA).
const CATEGORY_STYLE: Record<WorkoutCategory, { bg: string; fg: string }> = {
    inferior: { bg: '#FEF3C7', fg: '#A16207' },
    superior: { bg: '#DBEAFE', fg: '#1D4ED8' },
    fullbody: { bg: '#EDE9FE', fg: '#6D28D9' },
    cardio: { bg: '#FECACA', fg: '#B91C1C' },
    default: { bg: '#EDE9FE', fg: '#6D28D9' },
};

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
        pillX.value = withTiming(tab === 'history' ? 0 : 1, ANIM.timing.normal);
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
    const colors = useV2Colors();
    const params = useLocalSearchParams<{ filter?: string }>();
    const [activeTab, setActiveTab] = useState<'history' | 'performance'>('history');
    const [filter, setFilter] = useState<HistoryFilter>(
        params.filter === 'strava' ? 'strava' : 'all',
    );
    const { history, stats, isLoading, refetch } = useWorkoutHistory();
    // Aba fica montada: ao concluir um treino (router.replace pra Home) e voltar
    // em Logs, a sessão nova só aparecia matando o app. Re-busca ao focar (pula
    // o foco inicial, que o fetch do mount já cobre).
    const didFocusOnce = React.useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (!didFocusOnce.current) {
                didFocusOnce.current = true;
                return;
            }
            refetch();
        }, [refetch]),
    );
    const { activities: stravaActivities } = useStravaActivities(120);
    const { weeklyProgress } = useActiveProgram();
    // Meta semanal do programa ativo; fallback 5 (sem programa).
    const weeklyGoal = weeklyProgress?.targetSessions && weeklyProgress.targetSessions > 0
        ? weeklyProgress.targetSessions
        : 5;

    // Se ExtraActivitiesBlock / ActivityWeekCard navegam com ?filter=strava
    // após mount, sincronizar.
    useEffect(() => {
        if (params.filter === 'strava' && filter !== 'strava') {
            setFilter('strava');
            setActiveTab('history');
        }
    }, [params.filter]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={['top']}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text.primary }}>
                    Histórico de Treinos
                </Text>
                <Text style={{ fontSize: 14, color: colors.text.tertiary, marginTop: 4 }}>
                    Acompanhe sua evolução
                </Text>
            </View>

            <AnimatedSegmentedControl activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === 'history' && stravaActivities.length > 0 && (
                <FilterPills filter={filter} onChange={setFilter} />
            )}

            {isLoading ? (
                <Text style={{ color: colors.text.tertiary, textAlign: 'center', marginTop: 40 }}>
                    Carregando histórico...
                </Text>
            ) : activeTab === 'history' ? (
                <HistoryList
                    history={history}
                    stravaActivities={stravaActivities}
                    filter={filter}
                    weeklyGoal={weeklyGoal}
                />
            ) : (
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 20 }}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                >
                    <PerformanceView stats={stats} history={history} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── Filter pills ──
function FilterPills({
    filter,
    onChange,
}: {
    filter: HistoryFilter;
    onChange: (next: HistoryFilter) => void;
}) {
    const colors = useV2Colors();
    const options: { value: HistoryFilter; label: string }[] = [
        { value: 'all', label: 'Tudo' },
        { value: 'kinevo', label: 'Treinos Kinevo' },
        { value: 'strava', label: 'Strava' },
        { value: 'this_week', label: 'Esta semana' },
    ];
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, gap: 8 }}
        >
            {options.map((opt) => {
                const active = filter === opt.value;
                return (
                    <Pressable
                        key={opt.value}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onChange(opt.value);
                        }}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 999,
                            backgroundColor: active ? colors.text.primary : colors.surface.card,
                            borderWidth: 1,
                            borderColor: active ? colors.text.primary : colors.border.subtle,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: active ? colors.surface.canvas : colors.text.secondary,
                            }}
                        >
                            {opt.label}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

/* ─── History Tab ─── */

type TimelineItem =
    | { kind: 'kinevo'; session: HistorySession; date: number }
    | { kind: 'strava'; activity: ExternalActivityRow; date: number };

function startOfThisWeek(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const mondayOffset = (d.getDay() + 6) % 7; // dom=6, seg=0, ..., sáb=5
    d.setDate(d.getDate() - mondayOffset);
    return d.getTime();
}

function buildTimeline(
    history: HistorySession[],
    stravaActivities: ExternalActivityRow[],
    filter: HistoryFilter,
): TimelineItem[] {
    const items: TimelineItem[] = [];
    const weekStart = filter === 'this_week' ? startOfThisWeek() : -Infinity;

    if (filter !== 'strava') {
        for (const s of history) {
            const t = new Date(s.completed_at).getTime();
            if (t >= weekStart) items.push({ kind: 'kinevo', session: s, date: t });
        }
    }
    if (filter !== 'kinevo') {
        for (const a of stravaActivities) {
            const t = new Date(a.started_at).getTime();
            if (t >= weekStart) items.push({ kind: 'strava', activity: a, date: t });
        }
    }
    return items.sort((x, y) => y.date - x.date);
}

function HistoryList({
    history,
    stravaActivities,
    filter,
    weeklyGoal,
}: {
    history: HistorySession[];
    stravaActivities: ExternalActivityRow[];
    filter: HistoryFilter;
    weeklyGoal: number;
}) {
    const colors = useV2Colors();
    const timeline = useMemo(
        () => buildTimeline(history, stravaActivities, filter),
        [history, stravaActivities, filter],
    );

    const showWeekGoal = filter !== 'strava' && history.length > 0;

    const keyExtractor = useCallback(
        (item: TimelineItem) =>
            item.kind === 'kinevo' ? `k-${item.session.id}` : `s-${item.activity.id}`,
        [],
    );

    const renderItem = useCallback<ListRenderItem<TimelineItem>>(({ item, index }) => {
        // Limita o stagger a um índice máximo: itens distantes não acumulam delay.
        const delay = Math.min(index, 8) * ANIM.enter.stagger;
        return (
            <Animated.View
                entering={FadeInUp.delay(delay).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
            >
                {item.kind === 'kinevo' ? (
                    <HistoryCard session={item.session} />
                ) : (
                    <StravaActivityRow activity={item.activity} />
                )}
            </Animated.View>
        );
    }, []);

    const ListHeader = useMemo(
        () => (
            <View>
                {showWeekGoal && (
                    <WeekGoalCard data={buildWeekGoalData(history, weeklyGoal)} />
                )}
                {timeline.length > 0 && (
                    <Text
                        style={{
                            fontSize: 12, fontWeight: '700', color: colors.text.tertiary,
                            textTransform: 'uppercase', letterSpacing: 1,
                            marginBottom: 12, paddingHorizontal: 4,
                        }}
                    >
                        Últimas Atividades
                    </Text>
                )}
            </View>
        ),
        [showWeekGoal, history, weeklyGoal, timeline.length, colors.text.tertiary],
    );

    const ListEmpty = useMemo(
        () => (
            <Animated.View
                entering={FadeInUp.delay(100).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
                style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}
            >
                <View
                    style={{
                        width: 64, height: 64, backgroundColor: colors.neutral[100],
                        borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                    }}
                >
                    <Calendar size={28} color={colors.text.quaternary} />
                </View>
                <Text style={{ color: colors.text.tertiary, textAlign: 'center', fontSize: 14 }}>
                    Nenhuma atividade registrada ainda.
                </Text>
            </Animated.View>
        ),
        [colors.neutral, colors.text.quaternary, colors.text.tertiary],
    );

    return (
        <FlatList
            data={timeline}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            style={{ flex: 1, paddingHorizontal: 20 }}
            contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={11}
        />
    );
}

function HistoryCard({ session }: { session: HistorySession }) {
    const colors = useV2Colors();
    const [expanded, setExpanded] = useState(false);
    const chevronRotation = useSharedValue(0);

    const toggleExpand = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const next = !expanded;
        setExpanded(next);
        chevronRotation.value = withTiming(next ? 1 : 0, ANIM.timing.fast);
    }, [expanded]);

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(chevronRotation.value, [0, 1], [0, 180])}deg` }],
    }));

    const dateStr = formatActivityDate(session.completed_at);
    const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const category = getWorkoutCategory(session.workout_name);
    const catStyle = CATEGORY_STYLE[category];
    const intensity = getIntensity(session.volume_load);

    return (
        <PressableScale
            onPress={toggleExpand}
            pressScale={0.97}
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 20,
                marginBottom: 14,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border.default,
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
                    {/* Ícone de categoria */}
                    <View
                        style={{
                            width: 34, height: 34, borderRadius: 10,
                            backgroundColor: catStyle.bg,
                            alignItems: 'center', justifyContent: 'center', marginRight: 12,
                        }}
                    >
                        <Dumbbell size={16} color={catStyle.fg} strokeWidth={1.8} />
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {/* B2: nome encolhe/elipsa pra não empurrar o badge de
                                intensidade pra fora do card (antes saía cortado "Inten…"). */}
                            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: colors.text.primary }}>
                                {session.workout_name}
                            </Text>
                            <IntensityBadge level={intensity} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Text style={{ fontSize: 11.5, color: colors.text.tertiary, fontWeight: '500' }}>
                                {dateStr}
                            </Text>
                            {session.has_pre_checkin && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: toRgba(colors.purple[600], 0.08), paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                    <ClipboardCheck size={9} color={colors.purple[600]} />
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: colors.purple[600] }}>Pré</Text>
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
                        <ChevronDown size={18} color={colors.text.quaternary} />
                    </Animated.View>
                </View>

                {/* Metrics */}
                <View
                    style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        marginTop: 12, paddingTop: 12,
                        borderTopWidth: 1, borderTopColor: colors.border.subtle,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} color={colors.text.tertiary} strokeWidth={1.8} />
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text.secondary, fontVariant: ['tabular-nums'] }}>
                            {session.duration_seconds != null
                                ? `${Math.floor(session.duration_seconds / 60)} min`
                                : '—'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Dumbbell size={14} color={colors.text.tertiary} strokeWidth={1.8} />
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text.secondary, fontVariant: ['tabular-nums'] }}>
                            {formatTon(session.volume_load, 1)} t
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Repeat2 size={14} color={colors.text.tertiary} strokeWidth={1.8} />
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text.secondary, fontVariant: ['tabular-nums'] }}>
                            {totalSets} séries
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
                    <HealthCardSlot sessionId={session.id} />
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
                                    borderTopColor: colors.border.subtle,
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

/* ─── Health Card Slot (Fase 13) ─── */

function HealthCardSlot({ sessionId }: { sessionId: string }) {
    const { data } = useWorkoutHealthSummary(sessionId);
    if (!data) return null;
    return <WorkoutHealthCard summary={data} compact />;
}

/* ─── Workout Item Renderers ─── */

function ExerciseSetsView({ name, sets }: { name: string; sets: { id: string; weight: number; reps: number; completed: boolean }[] }) {
    const colors = useV2Colors();
    return (
        <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 3, height: 16, backgroundColor: colors.purple[600], borderRadius: 2, marginRight: 10 }} />
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text.tertiary, flex: 1 }}>{name}</Text>
            </View>
            <View style={{ gap: 6, paddingLeft: 13 }}>
                {sets.map((set, setIdx) => (
                    <View
                        key={set.id}
                        style={{
                            flexDirection: 'row', alignItems: 'center',
                            justifyContent: 'space-between', backgroundColor: 'rgba(148,163,184,0.10)',
                            paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.quaternary, width: 28 }}>#{setIdx + 1}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary, width: 72, textAlign: 'center' }}>{set.weight}kg</Text>
                        <Text style={{ fontSize: 12, color: colors.text.tertiary, width: 56, textAlign: 'right' }}>{set.reps} reps</Text>
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
    const colors = useV2Colors();
    const separator = !isFirst ? { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border.subtle } : {};

    if (item.itemType === 'warmup') {
        const config = item.itemConfig as { warmup_type?: WarmupType; duration_minutes?: number; description?: string } | undefined;
        const label = config?.warmup_type ? (WARMUP_TYPE_LABELS[config.warmup_type] || 'Aquecimento') : 'Aquecimento';
        return (
            <View style={{ ...separator as any }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 12, padding: 12, gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(234,88,12,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Flame size={16} color="#ea580c" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary }}>{label}</Text>
                        {(config?.duration_minutes || config?.description) && (
                            <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 2 }}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.10)', borderRadius: 12, padding: 12, gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Dumbbell size={16} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary }}>
                            {equipLabel}
                            {mode ? <Text style={{ fontSize: 12, fontWeight: '400', color: colors.text.quaternary }}> · {mode === 'continuous' ? 'Contínuo' : 'Intervalado'}</Text> : null}
                        </Text>
                        {details.length > 0 && (
                            <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 2 }}>{details.join(' · ')}</Text>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    if (item.itemType === 'note' && item.notes) {
        return (
            <View style={{ ...separator as any }}>
                <View style={{ backgroundColor: 'rgba(148,163,184,0.10)', borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic' }}>{item.notes}</Text>
                </View>
            </View>
        );
    }

    if (item.itemType === 'superset') {
        return (
            <View style={{ ...separator as any }}>
                <View style={{ borderLeftWidth: 2, borderLeftColor: colors.purple[600], borderRadius: 8, paddingLeft: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.purple[600], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
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

/* ─── Performance Tab ─── */

function PublishedReportsSection() {
    const colors = useV2Colors();
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
        <Animated.View entering={FadeInUp.delay(400).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text.quaternary, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Relatórios de Programa
                </Text>
                <FileText size={14} color={colors.purple[600]} />
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
                            backgroundColor: colors.surface.card,
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }} numberOfLines={1}>
                            {r.program_name}
                        </Text>
                        {period ? (
                            <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 4 }}>{period}</Text>
                        ) : null}
                    </TouchableOpacity>
                );
            })}
        </Animated.View>
    );
}

function PerformanceView({ stats, history }: { stats: HistoryStats; history: HistorySession[] }) {
    const colors = useV2Colors();
    return (
        <View>
            <JourneyCard data={buildJourneyData(history)} />

            {/* Recordes Pessoais */}
            <View>
                <Animated.View
                    entering={FadeInUp.delay(200).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 }}
                >
                    <Text
                        style={{
                            fontSize: 12, fontWeight: '700', color: colors.text.quaternary,
                            textTransform: 'uppercase', letterSpacing: 1,
                        }}
                    >
                        Recordes Pessoais
                    </Text>
                    <Trophy size={14} color="#f59e0b" fill="#f59e0b" />
                </Animated.View>

                {stats.personalRecords.length === 0 ? (
                    <Text style={{ color: colors.text.tertiary, fontStyle: 'italic', width: '100%', textAlign: 'center', paddingVertical: 16, fontSize: 13 }}>
                        Complete treinos para registrar seus recordes!
                    </Text>
                ) : (
                    stats.personalRecords.map((pr, idx) => {
                        // PR recente: bateu nos últimos 7 dias.
                        const daysSince = (Date.now() - new Date(pr.date).getTime()) / 86400000;
                        const recent = daysSince <= 7;
                        return (
                            <Animated.View
                                key={idx}
                                entering={FadeInUp.delay(200 + idx * ANIM.enter.stagger).duration(ANIM.enter.duration).easing(ANIM.enter.easing)}
                                style={{ marginBottom: 12 }}
                            >
                                <KPRCard
                                    exercise={pr.exerciseName}
                                    value={pr.weight}
                                    unit="kg"
                                    recent={recent}
                                    delta={undefined}
                                />
                            </Animated.View>
                        );
                    })
                )}
            </View>

            {/* Published Program Reports */}
            <PublishedReportsSection />
        </View>
    );
}


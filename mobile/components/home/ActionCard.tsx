// LEGACY — ainda usado em app/(tabs)/home.tsx (modo aluno). Migrar quando refatorar área student (futura fase).
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Dumbbell, ChevronRight, ChevronDown, Coffee, Check, Play, AlertCircle, PartyPopper, RotateCcw, ShieldCheck } from "lucide-react-native";
import Animated, {
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from "react-native-reanimated";
import { PressableScale } from "../shared/PressableScale";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ANIM } from "../../lib/animations";
import type { PendingWorkout, WeeklyProgress } from "@kinevo/shared/utils/schedule-projection";
import { useV2Colors, type V2Palette } from "../../hooks/useV2Colors";
import { useBrand } from "../../stores/brandStore";
import { toRgba } from "../../lib/brandColor";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Share Button (static — no breathing pulse) ──
function ShareButton({ onPress }: { onPress: () => void }) {
    const colors = useV2Colors();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            onPressIn={() => {
                scale.value = withTiming(0.95, { duration: 100, easing: ANIM.timing.fast.easing });
            }}
            onPressOut={() => {
                scale.value = withTiming(1, ANIM.timing.fast);
            }}
            style={[
                animatedStyle,
                {
                    backgroundColor: toRgba(colors.purple[600], 0.08),
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: toRgba(colors.purple[600], 0.18),
                },
            ]}
        >
            <Text style={{ color: colors.purple[600], fontSize: 12, fontWeight: '700' }}>
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
    /** Programa: nome, semana atual (1-indexed) e duração total — painel expandido */
    programName?: string | null;
    /** Carimbo de validação da Consultoria IA (ex.: "Validado por Ana · CREF 012345-G/SP"). */
    validationStamp?: string | null;
    programWeek?: number | null;
    programDurationWeeks?: number | null;
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
    isCompensated?: boolean;
    isMissed?: boolean;
    title?: string;
    timeContext?: TimeContext;
    onPress?: () => void;
}

export function ActionCard({
    todayWorkout,
    todaySession,
    weeklyProgress,
    programName,
    validationStamp,
    programWeek,
    programDurationWeeks,
    onStartWorkout,
    onShare,
    // Legacy/past-date props
    selectedWorkout,
    isCompleted,
    isCompensated,
    isMissed,
    title,
    timeContext = 'today',
    onPress,
}: ActionCardProps) {
    const colors = useV2Colors();
    const brand = useBrand();
    const styles = makeStyles(colors);
    const [expanded, setExpanded] = useState(false);
    // ─── Non-today view: keep legacy behavior for past/future dates ───
    if (timeContext !== 'today') {
        const workout = selectedWorkout;
        const sectionTitle = title || "Hoje";

        // Historic completed session (no workout from current program, but session exists)
        if (!workout && isCompleted && todaySession) {
            const startDate = new Date(todaySession.started_at);
            const endDate = todaySession.completed_at ? new Date(todaySession.completed_at) : new Date();
            const durationMin = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
            const durationStr = durationMin >= 60
                ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`
                : `${durationMin}min`;

            return (
                <View style={{ marginBottom: 28 }}>
                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                    <PressableScale onPress={onPress} pressScale={0.96} style={styles.completedShell}>
                        <View style={styles.completedInner}>
                            <View style={styles.checkIcon}>
                                <Check size={22} color="#16a34a" strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Treino realizado</Text>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#16a34a' }}>
                                    {durationStr}{(todaySession as any).rpe ? ` • PSE ${(todaySession as any).rpe}` : ''}
                                </Text>
                            </View>
                        </View>
                    </PressableScale>
                </View>
            );
        }

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
                            {onShare && <ShareButton onPress={onShare} />}
                        </View>
                    </PressableScale>
                </View>
            );
        }

        if (isCompensated) {
            return (
                <View style={{ marginBottom: 28 }}>
                    <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                    <View style={styles.cardShell}>
                        <View style={[styles.cardInner, { borderColor: 'rgba(245, 158, 11, 0.15)' }]}>
                            <View style={[styles.iconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                                <RotateCcw size={20} color="#f59e0b" strokeWidth={1.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{workout.name}</Text>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.semantic.warning.fg }}>
                                    Realizado em outro dia desta semana
                                </Text>
                            </View>
                        </View>
                    </View>
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
                                <Dumbbell size={20} color={colors.purple[600]} />
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>PREVISTO</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{workout.name}</Text>
                        {workout.notes && (
                            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 16 }} numberOfLines={1}>
                                {workout.notes}
                            </Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text.tertiary }}>
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

    // STATE 1: Scheduled today + not done yet → HERÓI premium expansível.
    // Toque no card = expandir/recolher o painel do programa; "Iniciar" (botão
    // aninhado) é a única forma de começar o treino — evita starts acidentais.
    if (todayWorkout && !hasTodaySession) {
        const expectedCount = weeklyProgress?.expectedCount ?? 0;
        const completedCount = weeklyProgress?.completedCount ?? 0;
        const pendingCount = weeklyProgress?.pendingWorkouts?.length ?? 0;
        const adherence = expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0;
        const pct = (programWeek != null && programDurationWeeks)
            ? Math.min(100, Math.round((programWeek / programDurationWeeks) * 100))
            : null;
        return (
            <View style={{ marginBottom: 32 }}>
                <PressableScale
                    onPress={() => setExpanded((e) => !e)}
                    pressScale={0.98}
                    accessibilityHint="Toque para ver o progresso do programa"
                    style={styles.heroShell}
                >
                    <LinearGradient
                        colors={['#18181B', '#27272A', brand.deep, brand.dark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroGradient}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={[styles.heroIconDark, { backgroundColor: brand.tint30 }]}>
                                <Dumbbell size={20} color="#FFFFFF" strokeWidth={2.2} />
                            </View>
                            <View style={styles.heroBadge}>
                                <Text style={styles.heroBadgeText}>Agendado</Text>
                            </View>
                        </View>
                        <Text style={styles.heroEyebrow}>Treino de hoje</Text>
                        <Text style={styles.heroTitleDark} numberOfLines={2}>{todayWorkout.name}</Text>
                        {todayWorkout.notes && (
                            <Text style={styles.heroNotes} numberOfLines={1}>{todayWorkout.notes}</Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                            <Text style={styles.heroCount}>
                                {(Array.isArray(todayWorkout.items) ? todayWorkout.items.length : todayWorkout.items?.length) || 0} exercícios
                            </Text>
                            <PressableScale
                                onPress={() => onStartWorkout?.(todayWorkout.id)}
                                pressScale={0.94}
                                hapticStyle={Haptics.ImpactFeedbackStyle.Medium}
                                accessibilityLabel={`Iniciar treino ${todayWorkout.name}`}
                                style={styles.heroStartButton}
                            >
                                <Play size={15} color={brand.dark} fill={brand.dark} />
                                <Text style={[styles.heroStartText, { color: brand.dark }]}>Iniciar</Text>
                            </PressableScale>
                        </View>

                        {expanded && (
                            <Animated.View entering={FadeIn.duration(180)} style={styles.heroPanel}>
                                <Text style={styles.panelEyebrow}>Programa atual</Text>
                                {programName ? (
                                    <Text
                                        style={[styles.panelTitle, validationStamp ? { marginBottom: 4 } : null]}
                                        numberOfLines={1}
                                    >
                                        {programName}
                                    </Text>
                                ) : null}
                                {validationStamp ? (
                                    <View style={styles.validationRow}>
                                        <ShieldCheck size={11} color="rgba(255,255,255,0.55)" />
                                        <Text style={styles.validationText} numberOfLines={1}>{validationStamp}</Text>
                                    </View>
                                ) : null}
                                {programWeek != null && (
                                    <>
                                        <View style={styles.weekRow}>
                                            <Text style={styles.weekText}>
                                                Semana {programWeek}{programDurationWeeks ? ` de ${programDurationWeeks}` : ''}
                                            </Text>
                                            {pct != null && <Text style={styles.weekPct}>{pct}% concluído</Text>}
                                        </View>
                                        {pct != null && (
                                            <View style={styles.bar}>
                                                <View style={[styles.barFill, { flex: pct, backgroundColor: brand.color }]} />
                                                <View style={{ flex: 100 - pct }} />
                                            </View>
                                        )}
                                    </>
                                )}
                                <View style={styles.tiles}>
                                    <View style={styles.tile}>
                                        <Text style={styles.tileLabel}>Aderência</Text>
                                        <Text style={styles.tileValue}>{adherence}<Text style={styles.tileSuffix}>%</Text></Text>
                                    </View>
                                    <View style={styles.tile}>
                                        <Text style={styles.tileLabel}>Feitos</Text>
                                        <Text style={styles.tileValue}>{completedCount}<Text style={styles.tileSuffix}>/{expectedCount}</Text></Text>
                                    </View>
                                    <View style={styles.tile}>
                                        <Text style={styles.tileLabel}>Pendentes</Text>
                                        <Text style={styles.tileValue}>{pendingCount}</Text>
                                    </View>
                                </View>
                                {pendingCount > 0 && (
                                    <View style={styles.pendHint}>
                                        <AlertCircle size={14} color="#FCD34D" strokeWidth={2.2} />
                                        <Text style={styles.pendHintText}>
                                            {pendingCount === 1
                                                ? 'Resta 1 treino para fechar a meta da semana'
                                                : `Restam ${pendingCount} treinos para fechar a meta da semana`}
                                        </Text>
                                    </View>
                                )}
                            </Animated.View>
                        )}

                        <View style={styles.handle}>
                            <Text style={styles.handleText}>{expanded ? 'Ocultar' : 'Ver progresso do programa'}</Text>
                            <ChevronDown
                                size={14}
                                color="rgba(255,255,255,0.6)"
                                strokeWidth={2.4}
                                style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                            />
                        </View>
                    </LinearGradient>
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
                        {onShare && <ShareButton onPress={onShare} />}
                    </View>
                </PressableScale>

                {/* Pending workout suggestion */}
                {nextPending && (
                    <View style={{ marginTop: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <AlertCircle size={14} color="#f59e0b" strokeWidth={2} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.semantic.warning.fg, marginLeft: 6 }}>
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
                            <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 8, textAlign: 'center' }}>
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
                        {onShare && <ShareButton onPress={onShare} />}
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
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.semantic.warning.fg, marginLeft: 8 }}>
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
                        <Text style={{ fontSize: 13, color: colors.semantic.warning.fg, marginBottom: 16 }}>
                            era para {nextPending.originalDay} ({nextPending.missedDate})
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text.tertiary }}>
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
                    <Text style={{ fontSize: 12, color: colors.text.quaternary, marginTop: 10, textAlign: 'center' }}>
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
                            <Text style={styles.cardTitle}>Semana completa!</Text>
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

// ── Shared styles factory ── (recebe paleta v2 → suporta dark mode)
function makeStyles(colors: V2Palette) {
    return {
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700' as const,
            color: colors.text.primary,
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
            backgroundColor: colors.surface.card,
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingVertical: 18,
            paddingHorizontal: 20,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border.default,
        },
        heroCardInner: {
            backgroundColor: colors.surface.card,
            padding: 24,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border.default,
        },
        // ── Herói premium (STATE 1: agendado hoje) ──
        heroShell: {
            borderRadius: 24,
            overflow: 'hidden' as const,
            shadowColor: colors.purple[600],
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.22,
            shadowRadius: 24,
            elevation: 8,
        },
        heroGradient: {
            padding: 20,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
        },
        heroIconDark: {
            height: 44,
            width: 44,
            borderRadius: 22,
            backgroundColor: toRgba(colors.purple[600], 0.30),
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        },
        heroBadge: {
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
        },
        heroBadgeText: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 9,
            fontWeight: '800' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: 2.5,
        },
        heroEyebrow: {
            fontSize: 10,
            fontWeight: '800' as const,
            letterSpacing: 1.5,
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.55)',
            marginBottom: 6,
        },
        heroTitleDark: {
            fontSize: 26,
            fontWeight: '800' as const,
            color: '#FFFFFF',
            letterSpacing: -0.6,
        },
        heroNotes: {
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 4,
        },
        heroCount: {
            fontSize: 14,
            fontWeight: '500' as const,
            color: 'rgba(255,255,255,0.7)',
        },
        heroStartButton: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            gap: 7,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 18,
            paddingVertical: 11,
            borderRadius: 14,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
        },
        heroStartText: {
            color: '#4C1D95',
            fontWeight: '800' as const,
            fontSize: 14,
        },
        // ── Painel expandido (progresso do programa) ──
        heroPanel: {
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.12)',
        },
        panelEyebrow: {
            fontSize: 10,
            fontWeight: '800' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: 1.4,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 3,
        },
        panelTitle: {
            fontSize: 16,
            fontWeight: '800' as const,
            color: '#FFFFFF',
            letterSpacing: -0.3,
            marginBottom: 12,
        },
        // Carimbo CREF da Consultoria IA — prova de responsabilidade técnica.
        validationRow: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            gap: 5,
            marginBottom: 12,
        },
        validationText: {
            fontSize: 11,
            fontWeight: '600' as const,
            color: 'rgba(255,255,255,0.55)',
            flexShrink: 1,
        },
        weekRow: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            marginBottom: 7,
        },
        weekText: {
            fontSize: 15,
            fontWeight: '800' as const,
            color: '#FFFFFF',
        },
        weekPct: {
            fontSize: 11,
            fontWeight: '700' as const,
            color: 'rgba(255,255,255,0.6)',
        },
        bar: {
            height: 7,
            borderRadius: 99,
            backgroundColor: 'rgba(255,255,255,0.14)',
            overflow: 'hidden' as const,
            flexDirection: 'row' as const,
            marginBottom: 16,
        },
        barFill: {
            borderRadius: 99,
            backgroundColor: '#C084FC',
        },
        tiles: {
            flexDirection: 'row' as const,
            gap: 8,
        },
        tile: {
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 14,
            paddingVertical: 11,
            paddingHorizontal: 10,
        },
        tileLabel: {
            fontSize: 9,
            fontWeight: '800' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.8,
            color: 'rgba(255,255,255,0.5)',
        },
        tileValue: {
            fontSize: 20,
            fontWeight: '800' as const,
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginTop: 3,
        },
        tileSuffix: {
            fontSize: 12,
            fontWeight: '700' as const,
            color: 'rgba(255,255,255,0.6)',
        },
        pendHint: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            gap: 7,
            marginTop: 12,
        },
        pendHintText: {
            flex: 1,
            fontSize: 12,
            fontWeight: '600' as const,
            color: '#FCD34D',
        },
        handle: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            gap: 6,
            marginTop: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.12)',
        },
        handleText: {
            fontSize: 11,
            fontWeight: '700' as const,
            letterSpacing: 0.6,
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.6)',
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
            // Tint verde sutil — funciona em ambos modos.
            backgroundColor: 'rgba(16,185,129,0.06)',
        },
        checkIcon: {
            height: 48,
            width: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(16,185,129,0.18)',
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
            backgroundColor: toRgba(colors.purple[600], 0.08),
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
        },
        badge: {
            backgroundColor: colors.neutral[100],
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
        },
        badgeText: {
            color: colors.text.tertiary,
            fontSize: 9,
            fontWeight: '700' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: 2.5,
        },
        heroTitle: {
            fontSize: 24,
            fontWeight: '800' as const,
            color: colors.text.primary,
            marginBottom: 6,
        },
        startButton: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            backgroundColor: colors.purple[600],
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 16,
            shadowColor: colors.purple[500],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
            gap: 6,
        },
        cardTitle: {
            fontSize: 15,
            fontWeight: '600' as const,
            color: colors.text.primary,
            marginBottom: 3,
        },
        cardSubtitle: {
            fontSize: 13,
            color: colors.text.tertiary,
            marginTop: 2,
        },
    };
}

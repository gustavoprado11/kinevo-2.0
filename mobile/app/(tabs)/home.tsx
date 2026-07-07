import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Image, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, Easing } from "react-native-reanimated";
import { ANIM } from "../../lib/animations";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useActiveProgram } from "../../hooks/useActiveProgram";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { useStudentAccess } from "../../hooks/useStudentAccess";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { PaymentBlockedScreen } from "../../components/PaymentBlockedScreen";
import { User } from "lucide-react-native";
import { toDateKey, isDateInProgram, getProgramWeek, getWeekRange } from "@kinevo/shared/utils/schedule-projection";

import { UnifiedCalendar } from "../../components/home/UnifiedCalendar";
import { ActionCard } from "../../components/home/ActionCard";
import { PerfectWeekBanner } from "../../components/home/PerfectWeekBanner";
import { PerfectWeekShareModal } from "../../components/workout/sharing/PerfectWeekShareModal";
import { PerfectWeekCelebrationSheet } from "../../components/home/PerfectWeekCelebrationSheet";
import type { PerfectWeekCardProps } from "../../components/workout/sharing/PerfectWeekTemplate";
import { usePerfectWeek } from "../../hooks/usePerfectWeek";
import { wasPerfectWeekCelebrated, markPerfectWeekCelebrated } from "../../lib/perfectWeekCelebration";
import { WorkoutList } from "../../components/home/WorkoutList";
import { ReportReadyCard } from "../../components/home/ReportReadyCard";
import { ExtraActivitiesBlock } from "../../components/strava/ExtraActivitiesBlock";
import { useStravaDays } from "../../hooks/useStravaActivities";
import { isStravaConnected, syncStravaIncremental } from "../../lib/healthSync/stravaSync";
import { supabase } from "../../lib/supabase";
import { ShareWorkoutModal } from "../../components/workout/ShareWorkoutModal";
import { useLatestUnreadReport } from "../../hooks/useLatestUnreadReport";
import { useV2Colors } from "../../hooks/useV2Colors";
import { useBrand, useBrandStore } from "../../stores/brandStore";
import { v2 } from "@kinevo/shared/tokens";
import { Flame, Dumbbell, Star, Award, ChevronRight, CreditCard } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AchievementCard } from "../../components/achievements/AchievementCard";
import { useStudentPendingCharge } from "../../hooks/useStudentPendingCharge";

// ─── Entering animation shorthand ───
const ENTER = ANIM.enter;

// Iniciais da marca pro placeholder do header (espelha web getInitials:
// primeiras letras de cada palavra, máx. 2). "Gustavo Prado Personal
// Trainer" → "GP".
function brandInitials(name: string): string {
    return (
        name
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "K"
    );
}

export default function HomeScreen() {
    const colors = useV2Colors();
    const brand = useBrand();
    const setBrandFromCoach = useBrandStore((s) => s.setBrandFromCoach);
    const router = useRouter();
    const { user } = useAuth();
    const { profile, refreshProfile } = useStudentProfile();
    const { allowed, reason, isLoading: accessLoading, refresh: refreshAccess } = useStudentAccess();
    const pendingCharge = useStudentPendingCharge();
    const { item: unreadReport, markOpened: markReportOpened } = useLatestUnreadReport();
    const { days: stravaDays, reload: reloadStravaDays } = useStravaDays(35);

    const {
        data: activeProgramData,
        programName,
        workouts,
        sessions,
        sessionsMap,
        allSessionsMap,
        weeklyProgress,
        weeklyProgressFull,
        studentName,
        programStartedAt,
        programDurationWeeks,
        programValidationStamp,
        isLoading,
        error,
        refetch,
        fetchRange,
    } = useActiveProgram();

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
            refreshAccess();
            refetch();
            pendingCharge.refresh();
        }, [refreshProfile, refreshAccess, refetch, pendingCharge.refresh])
    );

    // Aplica a marca do estúdio (white-label leve) a partir do coach do aluno.
    // Persiste em MMKV (via store) p/ aplicar instantâneo no próximo boot.
    useEffect(() => {
        setBrandFromCoach(profile?.coach ?? null);
    }, [profile?.coach, setBrandFromCoach]);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    // Share Modal State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [shareData, setShareData] = useState<any>(null);
    const [shareSessionId, setShareSessionId] = useState<string | undefined>(undefined);

    // Semana Perfeita — share + momento comemorativo
    const [perfectWeekShareVisible, setPerfectWeekShareVisible] = useState(false);
    const [perfectWeekCelebVisible, setPerfectWeekCelebVisible] = useState(false);

    const handleShareWorkout = useCallback(async (workout: any) => {
        if (!workout) return;

        // Use sessionsMap (indexed by completed_at ?? started_at) for consistent lookup
        const selectedKey = toDateKey(selectedDate);
        const daySessions = sessionsMap.get(selectedKey) || [];
        const session = daySessions.find(s =>
            s.status === 'completed' &&
            s.assigned_workout_id === workout.id
        ) || daySessions.find(s => s.status === 'completed');

        if (!session) {
            if (__DEV__) console.log("No completed session found for sharing");
            return;
        }

        const startDate = new Date(session.started_at);
        const endDate = session.completed_at ? new Date(session.completed_at) : new Date();
        const diffMs = endDate.getTime() - startDate.getTime();
        const durationMinutes = Math.floor(diffMs / 60000);
        const durationStr = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

        const exerciseCount = workout.items?.length || 0;

        // Semana do programa na data do treino (chip "SEMANA X/Y" do T4 Lista).
        const pWeek = (programStartedAt && programDurationWeeks)
            ? getProgramWeek(startDate, programStartedAt, programDurationWeeks)
            : null;

        setShareData({
            workoutName: workout.name,
            duration: durationStr,
            exerciseCount: exerciseCount,
            volume: 0,
            date: startDate.toLocaleDateString('pt-BR'),
            studentName: profile?.name || 'Aluno',
            coach: profile?.coach || null,
            programWeek: (pWeek && programDurationWeeks) ? { current: pWeek, total: programDurationWeeks } : undefined,
        });
        setShareModalVisible(true);
        setShareSessionId(session.id);
    }, [sessionsMap, selectedDate, profile, programStartedAt, programDurationWeeks]);

    const handleOpenReport = useCallback(async () => {
        if (!unreadReport) return;
        // Navega primeiro — melhor UX (tela abre imediato); markOpened roda
        // em paralelo com UI otimista e o card some via estado local do hook.
        const reportId = unreadReport.reportId;
        router.push(`/report/${reportId}` as any);
        markReportOpened();
    }, [unreadReport, router, markReportOpened]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // Strava roda em paralelo + silencioso (sem webhook, sem sync automático
        // confiável fora do background task de 12h). Recarrega os "dias com
        // atividade" do calendário ao final pra refletir corridas recém-sincadas.
        const stravaSync = (async () => {
            try {
                if (await isStravaConnected(supabase)) {
                    await syncStravaIncremental(supabase, 7);
                    await reloadStravaDays();
                }
            } catch { /* silencioso */ }
        })();
        await Promise.all([refetch(), refreshProfile(), refreshAccess(), stravaSync]);
        setRefreshing(false);
    }, [refetch, refreshProfile, refreshAccess, reloadStravaDays]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bom dia";
        if (hour < 18) return "Boa tarde";
        return "Boa noite";
    };

    const displayName = studentName
        ? studentName.split(" ")[0]
        : (user?.email?.split("@")[0] || "Atleta");

    // Determine Workout for Selected Date (with contextual info)
    const selectedWorkoutData = useMemo(() => {
        const selectedDayIndex = selectedDate.getDay();
        const selectedKey = toDateKey(selectedDate);
        const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const dayName = weekDays[selectedDayIndex];
        const dateStr = `${selectedDate.getDate().toString().padStart(2, '0')}/${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}`;

        // Time context
        const today = new Date();
        const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const selectedNoTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const isToday = selectedNoTime.getTime() === todayNoTime.getTime();
        const isPast = selectedNoTime < todayNoTime;
        const isFuture = selectedNoTime > todayNoTime;
        type TimeContext = 'today' | 'past' | 'future';
        const timeContext: TimeContext = isToday ? 'today' : isPast ? 'past' : 'future';

        // Check if selected date is within the current program
        const inProgram = programStartedAt
            ? isDateInProgram(selectedDate, programStartedAt, programDurationWeeks)
            : false;

        // Historic sessions (cross-program) for this day
        const historicSessions = allSessionsMap?.get(selectedKey) || [];
        const hasHistoricSession = historicSessions.some(s => s.status === 'completed');

        // If day is OUTSIDE current program: use historic data only
        if (!inProgram && !isToday) {
            if (hasHistoricSession) {
                const session = historicSessions.find(s => s.status === 'completed')!;
                return {
                    workout: null,
                    isCompleted: true,
                    isCompensated: false,
                    isMissed: false,
                    title: `Treino Realizado — ${dayName}, ${dateStr}`,
                    timeContext,
                    todaySession: session as any,
                };
            }
            // Outside program, no session → normal rest day
            return {
                workout: null,
                isCompleted: false,
                isCompensated: false,
                isMissed: false,
                title: `${dayName}, ${dateStr}`,
                timeContext,
                todaySession: null,
            };
        }

        // Within current program (or today) — existing logic
        const daySessions = sessionsMap.get(selectedKey) || [];

        // M7: pode haver 2+ treinos agendados no mesmo dia. Mostra o primeiro
        // ainda NÃO concluído; se todos concluídos, mostra o último (estado
        // concluído). Antes o .find pegava só o primeiro, então concluir o 2º
        // treino do dia não marcava o dia como feito no herói.
        const dayWorkouts = workouts.filter(w =>
            w.scheduled_days?.some((d: any) => Number(d) === selectedDayIndex)
        );
        const workout =
            dayWorkouts.find(w => !daySessions.some(s => s.status === 'completed' && s.assigned_workout_id === w.id))
            ?? dayWorkouts[dayWorkouts.length - 1];

        const isCompleted = workout
            ? daySessions.some(s => s.status === 'completed' && s.assigned_workout_id === workout.id)
            : daySessions.some(s => s.status === 'completed');

        const todaySession = workout
            ? daySessions.find(s => s.status === 'completed' && s.assigned_workout_id === workout.id) ?? null
            : daySessions.find(s => s.status === 'completed') ?? null;

        // Check weekly compensation for this workout
        let isCompensated = false;
        let isMissed = false;
        if (isPast && !!workout && !isCompleted) {
            const counts = weeklyProgressFull?.workoutCounts?.get(workout.id);
            if (counts && counts.completed >= counts.expected) {
                isCompensated = true;
            } else {
                isMissed = true;
            }
        }

        let title: string;
        if (isToday) {
            title = "Treino de Hoje";
        } else if (isFuture && workout) {
            title = `Treino Previsto — ${dayName}, ${dateStr}`;
        } else if (isPast && isCompleted) {
            title = `Treino Realizado — ${dayName}, ${dateStr}`;
        } else if (isPast && isCompensated) {
            title = `Treino Compensado — ${dayName}, ${dateStr}`;
        } else if (isPast && isMissed) {
            title = `Treino Perdido — ${dayName}, ${dateStr}`;
        } else {
            title = `Treino de ${dayName} (${dateStr})`;
        }

        return { workout, isCompleted, isCompensated, isMissed, title, timeContext, todaySession };
    }, [workouts, sessionsMap, allSessionsMap, selectedDate, programStartedAt, programDurationWeeks, weeklyProgressFull]);



    // Simple streak: conta semanas consecutivas (incluindo a atual) com
    // pelo menos 1 sessão completed. Heurística leve, não sobe até hook.
    const streakWeeks = useMemo(() => {
        if (!sessionsMap || sessionsMap.size === 0) return 0;
        const todayLocal = new Date();
        const startOfWeek = (d: Date) => {
            const x = new Date(d);
            x.setHours(0, 0, 0, 0);
            const mondayOffset = (x.getDay() + 6) % 7; // dom=6, seg=0, ..., sáb=5
            x.setDate(x.getDate() - mondayOffset);
            return x;
        };
        let cursor = startOfWeek(todayLocal);
        let count = 0;
        // Máximo 52 semanas pra evitar loop em datasets grandes
        for (let i = 0; i < 52; i++) {
            const weekStart = new Date(cursor);
            const weekEnd = new Date(cursor);
            weekEnd.setDate(weekEnd.getDate() + 7);
            let hasCompleted = false;
            sessionsMap.forEach((sessions) => {
                for (const s of sessions) {
                    if (s.status !== 'completed') continue;
                    const t = new Date(s.completed_at || s.started_at).getTime();
                    if (t >= weekStart.getTime() && t < weekEnd.getTime()) {
                        hasCompleted = true;
                        break;
                    }
                }
            });
            if (!hasCompleted) break;
            count++;
            cursor.setDate(cursor.getDate() - 7);
        }
        return count;
    }, [sessionsMap]);

    // ── Semana Perfeita ──
    // Persiste a semana 100% (idempotente) e devolve a contagem de semanas
    // perfeitas consecutivas. weekStart é o mesmo de calculateWeeklyProgress
    // (getWeekRange, segunda-baseado) p/ alinhar a chave.
    const weekStart = getWeekRange(new Date()).start;
    const { consecutiveCount, totalCount: perfectWeeksTotal } = usePerfectWeek({
        studentId: profile?.id,
        trainerId: profile?.coach_id,
        weekStart,
        isWeekComplete: !!weeklyProgressFull?.isWeekComplete,
        completedCount: weeklyProgressFull?.completedCount ?? 0,
        expectedCount: weeklyProgressFull?.expectedCount ?? 0,
        assignedProgramId: (activeProgramData as any)?.id ?? null,
        programWeek: programStartedAt ? getProgramWeek(new Date(), programStartedAt, programDurationWeeks) : null,
    });

    // Monta o card compartilhável a partir das sessões concluídas da semana.
    const perfectWeekCard = useMemo<PerfectWeekCardProps | null>(() => {
        const wp = weeklyProgressFull;
        if (!wp?.isWeekComplete || (wp.expectedCount ?? 0) <= 0) return null;

        const { start, end } = getWeekRange(new Date());
        const rows: { name: string; detail: string | null; t: number }[] = [];
        const seen = new Set<string>();
        sessionsMap.forEach((daySessions) => {
            for (const s of daySessions) {
                if (s.status !== 'completed') continue;
                const t = new Date(s.completed_at || s.started_at).getTime();
                if (t < start.getTime() || t > end.getTime()) continue;
                if (seen.has(s.id)) continue;
                seen.add(s.id);
                const w = workouts.find((w) => w.id === s.assigned_workout_id);
                let detail: string | null = null;
                if (s.completed_at && s.started_at) {
                    const mins = Math.max(1, Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000));
                    detail = `${mins} min`;
                }
                rows.push({ name: w?.name || 'Treino', detail, t });
            }
        });
        rows.sort((a, b) => a.t - b.t);

        const last = new Date(start);
        last.setDate(last.getDate() + 6);
        const shortMon = last.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const weekRangeLabel = `${start.getDate()}–${last.getDate()} ${shortMon}`;
        const pWeek = (programStartedAt && programDurationWeeks)
            ? getProgramWeek(new Date(), programStartedAt, programDurationWeeks)
            : null;

        return {
            completedCount: wp.completedCount,
            expectedCount: wp.expectedCount,
            programName,
            programWeek: pWeek,
            consecutiveCount,
            workouts: rows.map((r) => ({ name: r.name, detail: r.detail })),
            studentName: profile?.name || studentName || 'Atleta',
            weekRangeLabel,
            coach: profile?.coach ? { name: profile.coach.name, avatar_url: profile.coach.avatar_url, instagram_handle: profile.coach.instagram_handle ?? null } : null,
        };
    }, [weeklyProgressFull, sessionsMap, workouts, programName, programStartedAt, programDurationWeeks, profile, studentName, consecutiveCount]);

    // Momento comemorativo: sobe 1x por semana quando a semana fecha 100%
    // (o player faz replace p/ Home ao finalizar, então a folha aparece logo
    // após o treino que fechou a semana). Guard via MMKV.
    const perfectWeekKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
    useEffect(() => {
        if (perfectWeekCard && !wasPerfectWeekCelebrated(perfectWeekKey)) {
            markPerfectWeekCelebrated(perfectWeekKey);
            setPerfectWeekCelebVisible(true);
        }
    }, [perfectWeekCard, perfectWeekKey]);

    // Compute today's completed workout IDs for WorkoutList badges
    const todayCompletedWorkoutIds = useMemo(() => {
        const todayKey = toDateKey(new Date());
        const todaySessions = sessionsMap.get(todayKey) || [];
        const ids = new Set<string>();
        for (const s of todaySessions) {
            if (s.status === 'completed') ids.add(s.assigned_workout_id);
        }
        return ids;
    }, [sessionsMap]);

    // Block access if student has unpaid subscription
    if (!accessLoading && !allowed) {
        return <PaymentBlockedScreen reason={reason} />;
    }

    // Cast workouts for calendar (needs scheduled_days as number[])
    const calendarWorkouts = workouts.map(w => ({
        id: w.id,
        name: w.name,
        scheduled_days: (w.scheduled_days || []) as number[],
    }));

    // Cast sessionsMap for calendar (SessionRef type)
    const calendarSessionsMap = sessionsMap as any;

    return (
        <ScreenWrapper>
            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.color} />
                }
            >
                {/* ── Header: Fade-In 300ms ── */}
                <Animated.View
                    entering={FadeIn.duration(300)}
                    className="flex-row justify-between items-center mb-6"
                >
                    <View className="flex-row items-center gap-3">
                        {brand.enabled && brand.logoUrl ? (
                            <Image
                                source={{ uri: brand.logoUrl }}
                                style={{ width: 32, height: 32, borderRadius: 8 }}
                            />
                        ) : brand.enabled && brand.name ? (
                            // Marca personalizada sem logo enviada → iniciais num
                            // quadrado com a cor da marca (espelha o placeholder do
                            // web). Evita cair no logo Kinevo quando o personal já
                            // tem identidade própria (nome/cor), só não subiu imagem.
                            <View
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    backgroundColor: brand.color,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 }}>
                                    {brandInitials(brand.name)}
                                </Text>
                            </View>
                        ) : (
                            <Image
                                source={require("../../assets/images/logo-icon.jpg")}
                                style={{ width: 32, height: 32, borderRadius: 8 }}
                            />
                        )}
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text.tertiary }}>
                                {getGreeting()},
                            </Text>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text.primary }}>
                                {displayName}
                            </Text>
                            {brand.enabled && brand.name ? (
                                <Text style={{ fontSize: 11, fontWeight: '700', color: brand.color, marginTop: 2 }}>
                                    {brand.name}
                                </Text>
                            ) : null}
                            <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 4 }}>
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push("/profile")}
                        activeOpacity={0.7}
                    >
                        {profile?.avatar_url ? (
                            <Image
                                source={{ uri: profile.avatar_url }}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    backgroundColor: colors.neutral[200],
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <User size={24} color={colors.text.secondary} />
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* ── Banner de cobrança pendente (P13): antes disto o aluno só
                     descobria a cobrança pelo WhatsApp do treinador — ou quando
                     era bloqueado. Toque → /payment (paga in-app). ── */}
                {pendingCharge.hasPending && (
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push("/payment");
                        }}
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            backgroundColor: colors.semantic.warning.bg,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            marginBottom: 16,
                        }}
                    >
                        <CreditCard size={20} color={colors.semantic.warning.fg} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>
                                {pendingCharge.status === "past_due" ? "Pagamento atrasado" : "Você tem uma cobrança"}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 1 }}>
                                {pendingCharge.amount != null
                                    ? `${pendingCharge.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — toque para pagar pelo app`
                                    : "Toque para pagar pelo app"}
                            </Text>
                        </View>
                        <ChevronRight size={18} color={colors.text.tertiary} />
                    </TouchableOpacity>
                )}

                {/* ── Report Ready Card: só renderiza se há relatório não lido ── */}
                {unreadReport && (
                    <ReportReadyCard
                        programName={unreadReport.programName}
                        onPress={handleOpenReport}
                    />
                )}

                {/* ── Calendar: Unified accordion with smooth expand/collapse ── */}
                <Animated.View
                    entering={FadeInDown.delay(50).duration(ENTER.duration).easing(ENTER.easing)}
                >
                    <UnifiedCalendar
                        workouts={calendarWorkouts}
                        sessionsMap={calendarSessionsMap}
                        allSessionsMap={allSessionsMap as any}
                        programStartedAt={programStartedAt}
                        programDurationWeeks={programDurationWeeks}
                        selectedDate={selectedDate}
                        onDayPress={(date) => setSelectedDate(date)}
                        onWeekChange={() => { }}
                        fetchRange={fetchRange}
                        extraActivityDays={stravaDays}
                    />
                </Animated.View>

                {isLoading && !programName ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator color={brand.color} />
                        <Text style={{ color: colors.text.tertiary, marginTop: 16, fontWeight: '500' }}>Sincronizando...</Text>
                    </View>
                ) : (
                    <>
                        {/* ── Herói: Treino de hoje (ActionCard) — ação principal no topo ── */}
                        <Animated.View
                            entering={FadeInUp.delay(100).duration(ENTER.duration).easing(ENTER.easing)}
                        >
                            <ActionCard
                                todayWorkout={selectedWorkoutData.timeContext === 'today' ? selectedWorkoutData.workout : undefined}
                                todaySession={selectedWorkoutData.timeContext === 'today' ? selectedWorkoutData.todaySession : undefined}
                                weeklyProgress={weeklyProgressFull}
                                programName={programName}
                                validationStamp={programValidationStamp}
                                programWeek={programStartedAt ? getProgramWeek(new Date(), programStartedAt, programDurationWeeks) : null}
                                programDurationWeeks={programDurationWeeks}
                                onStartWorkout={(id) => router.push(`/workout/${id}`)}
                                onPress={() => {
                                    if (selectedWorkoutData.workout?.id) {
                                        router.push(`/workout/${selectedWorkoutData.workout.id}`);
                                    }
                                }}
                                onShare={selectedWorkoutData.isCompleted ? () => handleShareWorkout(selectedWorkoutData.workout) : undefined}
                                selectedWorkout={selectedWorkoutData.workout}
                                isCompleted={selectedWorkoutData.isCompleted}
                                isCompensated={selectedWorkoutData.isCompensated}
                                isMissed={selectedWorkoutData.isMissed}
                                title={selectedWorkoutData.title}
                                timeContext={selectedWorkoutData.timeContext}
                            />
                        </Animated.View>

                        {/* ── Semana Perfeita: banner persistente quando fecha 100% ── */}
                        {perfectWeekCard && (
                            <Animated.View
                                entering={FadeInUp.delay(115).duration(ENTER.duration).easing(ENTER.easing)}
                            >
                                <PerfectWeekBanner
                                    completedCount={perfectWeekCard.completedCount}
                                    consecutiveCount={perfectWeekCard.consecutiveCount}
                                    onShare={() => setPerfectWeekShareVisible(true)}
                                />
                            </Animated.View>
                        )}

                        {/* ── Achievements grid (sobe p/ acima da dobra) ── */}
                        {programName && (
                            <Animated.View
                                entering={FadeInUp.delay(160).duration(ENTER.duration).easing(ENTER.easing)}
                            >
                                <AchievementsGrid
                                    streak={streakWeeks}
                                    totalCompletedThisProgram={weeklyProgressFull?.completedCount ?? weeklyProgress?.totalSessions ?? 0}
                                    perfectWeeks={perfectWeeksTotal}
                                />
                            </Animated.View>
                        )}

                        {/* ── Workout List ── */}
                        <Animated.View
                            entering={FadeInUp.delay(220).duration(ENTER.duration).easing(ENTER.easing)}
                            className="mb-6"
                        >
                            {workouts.length > 0 ? (
                                <WorkoutList
                                    workouts={workouts}
                                    onWorkoutPress={(id) => router.push(`/workout/${id}`)}
                                    weeklyProgress={weeklyProgressFull}
                                    todayCompletedIds={todayCompletedWorkoutIds}
                                />
                            ) : (
                                <View className="items-center py-6">
                                    <Text style={{ color: colors.text.quaternary }}>Nenhum treino encontrado neste programa.</Text>
                                </View>
                            )}
                        </Animated.View>

                        {/* ── Weekly summary narrativo (V2 polish) ── */}
                        {programName && (
                            <Animated.View
                                entering={FadeInUp.delay(260).duration(ENTER.duration).easing(ENTER.easing)}
                            >
                                <WeeklySummaryCard
                                    completed={weeklyProgress?.totalSessions ?? 0}
                                    target={weeklyProgress?.targetSessions ?? 0}
                                />
                            </Animated.View>
                        )}

                        {/* ── Fase 16 · Atividades extras Strava (FIM da Home) ── */}
                        <Animated.View
                            entering={FadeInUp.delay(300).duration(ENTER.duration).easing(ENTER.easing)}
                        >
                            <ExtraActivitiesBlock />
                        </Animated.View>
                    </>
                )}
            </ScrollView>

            <ShareWorkoutModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                data={shareData}
                sessionId={shareSessionId}
            />

            <PerfectWeekShareModal
                visible={perfectWeekShareVisible}
                onClose={() => setPerfectWeekShareVisible(false)}
                data={perfectWeekCard ?? undefined}
            />

            {perfectWeekCard && (
                <PerfectWeekCelebrationSheet
                    visible={perfectWeekCelebVisible}
                    card={perfectWeekCard}
                    onShare={() => { setPerfectWeekCelebVisible(false); setPerfectWeekShareVisible(true); }}
                    onClose={() => setPerfectWeekCelebVisible(false)}
                />
            )}
        </ScreenWrapper>
    );
}

// ── Achievements grid (scroll horizontal). Cards usam dados disponíveis:
// semanas perfeitas (perfect_weeks), streak (já temos), total treinos do
// programa, marco. Não inventamos números — cada card sai de dado real.
function AchievementsGrid({
    streak,
    totalCompletedThisProgram,
    perfectWeeks,
}: {
    streak: number;
    totalCompletedThisProgram: number;
    perfectWeeks: number;
}) {
    const colors = useV2Colors();
    const router = useRouter();
    // Marco arbitrário pra "rumo a": próximo múltiplo de 25 acima do atual.
    const milestoneTarget = Math.max(25, Math.ceil((totalCompletedThisProgram + 1) / 25) * 25);
    const CARD_W = 116;
    const openAchievements = () => router.push('/profile/achievements');

    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 }}>
                <Text
                    style={{
                        fontFamily: 'PlusJakartaSans_700Bold',
                        fontSize: 11,
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        color: colors.text.tertiary,
                    }}
                >
                    Suas conquistas
                </Text>
                <TouchableOpacity
                    onPress={openAchievements}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                    accessibilityRole="button"
                    accessibilityLabel="Ver todas as conquistas"
                >
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.text.secondary }}>
                        Ver todas
                    </Text>
                    <ChevronRight size={14} color={colors.text.secondary} strokeWidth={2.5} />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {perfectWeeks > 0 && (
                    <AchievementCard
                        icon={Award}
                        title={perfectWeeks === 1 ? '1 semana' : `${perfectWeeks} semanas`}
                        subtitle="perfeitas"
                        gold
                        width={CARD_W}
                        onPress={openAchievements}
                    />
                )}
                <AchievementCard
                    icon={Flame}
                    title={streak >= 2 ? `${streak} semanas` : 'Comece um streak'}
                    subtitle={streak >= 2 ? 'consistente' : 'treine 2 sem.'}
                    locked={streak < 2}
                    width={CARD_W}
                    onPress={openAchievements}
                />
                <AchievementCard
                    icon={Dumbbell}
                    title={`${totalCompletedThisProgram} treinos`}
                    subtitle="neste programa"
                    locked={totalCompletedThisProgram === 0}
                    width={CARD_W}
                    onPress={openAchievements}
                />
                <AchievementCard
                    icon={Star}
                    title={`${totalCompletedThisProgram}/${milestoneTarget}`}
                    subtitle="rumo a marco"
                    locked={totalCompletedThisProgram < milestoneTarget}
                    width={CARD_W}
                    onPress={openAchievements}
                />
            </ScrollView>
        </View>
    );
}

// ── Weekly summary narrativo. Usa apenas dados disponíveis no
// hook useActiveProgram (totalSessions desta semana). Volume + PRs +
// aderência completa não estão expostos aqui → frase mais curta.
function WeeklySummaryCard({ completed, target }: { completed: number; target: number }) {
    const colors = useV2Colors();
    const brand = useBrand();
    if (completed === 0) return null;
    const adherence = target > 0 ? Math.round((completed / target) * 100) : 0;
    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: v2.radius.lg,
                borderWidth: 1,
                borderColor: colors.border.default,
                padding: 16,
                marginBottom: 16,
            }}
        >
            <Text
                style={{
                    fontFamily: 'PlusJakartaSans_500Medium',
                    fontSize: 13,
                    color: colors.text.secondary,
                    lineHeight: 20,
                }}
            >
                Você treinou{' '}
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: colors.text.primary }}>
                    {completed} {completed === 1 ? 'vez' : 'vezes'}
                </Text>
                {target > 0 ? (
                    <>
                        {' '}esta semana — aderência{' '}
                        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: colors.text.primary }}>
                            {adherence}%
                        </Text>
                        .{' '}
                    </>
                ) : '. '}
                <Text style={{ fontStyle: 'italic', color: brand.color }}>Continue assim</Text>
            </Text>
        </View>
    );
}


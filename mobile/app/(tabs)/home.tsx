import React, { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Image, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useActiveProgram } from "../../hooks/useActiveProgram";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { useStudentAccess } from "../../hooks/useStudentAccess";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { PaymentBlockedScreen } from "../../components/PaymentBlockedScreen";
import { User } from "lucide-react-native";
import { toDateKey } from "@kinevo/shared/utils/schedule-projection";

import { UnifiedCalendar } from "../../components/home/UnifiedCalendar";
import { ProgressCard } from "../../components/home/ProgressCard";
import { ActionCard } from "../../components/home/ActionCard";
import { WorkoutList } from "../../components/home/WorkoutList";
import { ShareWorkoutModal } from "../../components/workout/ShareWorkoutModal";

// ─── Spring-based entering animation configs ───
const SPRING_ENTER = { damping: 18, stiffness: 100, mass: 0.8 };

export default function HomeScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { profile, refreshProfile } = useStudentProfile();
    const { allowed, reason, isLoading: accessLoading, refresh: refreshAccess } = useStudentAccess();

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
            refreshAccess();
        }, [refreshProfile, refreshAccess])
    );

    const {
        programName,
        workouts,
        sessions,
        sessionsMap,
        weeklyProgress,
        studentName,
        programStartedAt,
        programDurationWeeks,
        isLoading,
        error,
        refetch,
        fetchRange,
    } = useActiveProgram();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    // Share Modal State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [shareData, setShareData] = useState<any>(null);
    const [shareSessionId, setShareSessionId] = useState<string | undefined>(undefined);

    const handleShareWorkout = useCallback(async (workout: any) => {
        if (!workout) return;

        const sessionDate = selectedDate;
        const session = sessions.find(s => {
            const sDate = new Date(s.started_at);
            return s.assigned_workout_id === workout.id &&
                s.status === 'completed' &&
                sDate.getDate() === sessionDate.getDate() &&
                sDate.getMonth() === sessionDate.getMonth() &&
                sDate.getFullYear() === sessionDate.getFullYear();
        });

        if (!session) {
            console.log("No completed session found for sharing");
            return;
        }

        const startDate = new Date(session.started_at);
        const endDate = session.completed_at ? new Date(session.completed_at) : new Date();
        const diffMs = endDate.getTime() - startDate.getTime();
        const durationMinutes = Math.floor(diffMs / 60000);
        const durationStr = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

        const exerciseCount = workout.items?.length || 0;

        setShareData({
            workoutName: workout.name,
            duration: durationStr,
            exerciseCount: exerciseCount,
            volume: 0,
            date: startDate.toLocaleDateString('pt-BR'),
            studentName: profile?.name || 'Aluno',
            coach: profile?.coach || null
        });
        setShareModalVisible(true);
        setShareSessionId(session.id);
    }, [sessions, selectedDate, profile]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetch(), refreshProfile(), refreshAccess()]);
        setRefreshing(false);
    }, [refetch, refreshProfile, refreshAccess]);

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

        const workout = workouts.find(w => {
            if (!w.scheduled_days) return false;
            return w.scheduled_days.some((d: any) => Number(d) === selectedDayIndex);
        });

        // Check completion for selected date
        const selectedKey = toDateKey(selectedDate);
        const daySessions = sessionsMap.get(selectedKey) || [];
        const isCompleted = daySessions.some(s => s.status === 'completed');

        // Time context
        const today = new Date();
        const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const selectedNoTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());

        const isToday = selectedNoTime.getTime() === todayNoTime.getTime();
        const isPast = selectedNoTime < todayNoTime;
        const isFuture = selectedNoTime > todayNoTime;

        const isMissed = isPast && !!workout && !isCompleted;

        type TimeContext = 'today' | 'past' | 'future';
        const timeContext: TimeContext = isToday ? 'today' : isPast ? 'past' : 'future';

        // Contextual title
        const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const dayName = weekDays[selectedDayIndex];
        const dateStr = `${selectedDate.getDate().toString().padStart(2, '0')}/${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}`;

        let title: string;
        if (isToday) {
            title = "Treino de Hoje";
        } else if (isFuture && workout) {
            title = `Treino Previsto — ${dayName}, ${dateStr}`;
        } else if (isPast && isCompleted) {
            title = `Treino Realizado — ${dayName}, ${dateStr}`;
        } else if (isPast && isMissed) {
            title = `Treino Perdido — ${dayName}, ${dateStr}`;
        } else {
            title = `Treino de ${dayName} (${dateStr})`;
        }

        return { workout, isCompleted, isMissed, title, timeContext };
    }, [workouts, sessionsMap, selectedDate]);



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
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
                }
            >
                {/* ── Header: Fade-In 300ms ── */}
                <Animated.View
                    entering={FadeIn.duration(300)}
                    className="flex-row justify-between items-center mb-6"
                >
                    <View className="flex-row items-center gap-3">
                        <Image
                            source={require("../../assets/images/logo-icon.jpg")}
                            style={{ width: 32, height: 32, borderRadius: 8 }}
                        />
                        <View>
                            <Text className="text-slate-500 text-xs font-medium">
                                {getGreeting()},
                            </Text>
                            <Text className="text-xl font-bold text-slate-900">
                                {displayName}
                            </Text>
                            <Text className="text-slate-500 text-xs mt-1">
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
                                    backgroundColor: '#e2e8f0',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <User size={24} color="#475569" />
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* ── Calendar: Unified accordion with smooth expand/collapse ── */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(400).springify().damping(18).stiffness(100)}
                >
                    <UnifiedCalendar
                        workouts={calendarWorkouts}
                        sessionsMap={calendarSessionsMap}
                        programStartedAt={programStartedAt}
                        programDurationWeeks={programDurationWeeks}
                        selectedDate={selectedDate}
                        onDayPress={(date) => setSelectedDate(date)}
                        onWeekChange={() => { }}
                        fetchRange={fetchRange}
                    />
                </Animated.View>

                {isLoading && !programName ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator color="#7c3aed" />
                        <Text className="text-slate-500 mt-4 font-medium">Sincronizando...</Text>
                    </View>
                ) : (
                    <>
                        {/* ── Progress Card: Slide-Up stagger delay 200ms ── */}
                        {programName && (
                            <Animated.View
                                entering={FadeInUp.delay(200).springify().damping(SPRING_ENTER.damping).stiffness(SPRING_ENTER.stiffness).mass(SPRING_ENTER.mass)}
                            >
                                <ProgressCard
                                    programName={programName}
                                    completedSessions={weeklyProgress?.totalSessions || 0}
                                    targetSessions={weeklyProgress?.targetSessions || 0}
                                />
                            </Animated.View>
                        )}

                        {/* ── Action Card: Slide-Up stagger delay 300ms ── */}
                        <Animated.View
                            entering={FadeInUp.delay(300).springify().damping(SPRING_ENTER.damping).stiffness(SPRING_ENTER.stiffness).mass(SPRING_ENTER.mass)}
                        >
                            <ActionCard
                                workout={selectedWorkoutData.workout}
                                isCompleted={selectedWorkoutData.isCompleted}
                                isMissed={selectedWorkoutData.isMissed}
                                title={selectedWorkoutData.title}
                                timeContext={selectedWorkoutData.timeContext}
                                onPress={() => {
                                    if (selectedWorkoutData.workout?.id) {
                                        router.push(`/workout/${selectedWorkoutData.workout.id}`);
                                    }
                                }}
                                onShare={selectedWorkoutData.isCompleted ? () => handleShareWorkout(selectedWorkoutData.workout) : undefined}
                            />
                        </Animated.View>

                        {/* ── Workout List: Slide-Up stagger delay 400ms ── */}
                        <Animated.View
                            entering={FadeInUp.delay(400).springify().damping(SPRING_ENTER.damping).stiffness(SPRING_ENTER.stiffness).mass(SPRING_ENTER.mass)}
                            className="mb-6"
                        >
                            {workouts.length > 0 ? (
                                <WorkoutList
                                    workouts={workouts}
                                    onWorkoutPress={(id) => router.push(`/workout/${id}`)}
                                />
                            ) : (
                                <View className="items-center py-6">
                                    <Text className="text-slate-400">Nenhum treino encontrado neste programa.</Text>
                                </View>
                            )}
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
        </ScreenWrapper>
    );
}

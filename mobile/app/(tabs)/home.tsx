import React, { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Image, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useActiveProgram } from "../../hooks/useActiveProgram";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { ScreenWrapper } from "../../components/ScreenWrapper";
import { User } from "lucide-react-native";

// Import new home components
import { WeekCalendar } from "../../components/home/WeekCalendar";
import { ProgressCard } from "../../components/home/ProgressCard";
import { ActionCard } from "../../components/home/ActionCard";
import { WorkoutList } from "../../components/home/WorkoutList";

export default function HomeScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { profile, refreshProfile } = useStudentProfile();

    // Re-fetch profile when tab gains focus (avatar may have changed on Profile tab)
    useFocusEffect(
        useCallback(() => {
            refreshProfile();
        }, [refreshProfile])
    );
    const {
        programName,
        workouts,
        sessions,
        weeklyProgress,
        studentName,
        isLoading,
        error,
        refetch
    } = useActiveProgram();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetch(), refreshProfile()]);
        setRefreshing(false);
    }, [refetch, refreshProfile]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bom dia";
        if (hour < 18) return "Boa tarde";
        return "Boa noite";
    };

    const displayName = studentName
        ? studentName.split(" ")[0]
        : (user?.email?.split("@")[0] || "Atleta");

    // Calendar & Schedule Logic
    const calendarData = useMemo(() => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start

        const days = Array.from({ length: 7 }).map((_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);

            // Simple date comparison (ignoring time)
            const isToday = date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();

            // Determine Status
            // 0=Sun, 6=Sat matches JS getDay()
            const dayOfWeek = i; // aligned with date.getDay() since we start from Sunday

            // Find workouts scheduled for this day
            const scheduledWorkouts = workouts.filter(w => w.scheduled_days?.includes(dayOfWeek));
            const isScheduled = scheduledWorkouts.length > 0;

            // Check if ANY workout was completed on this date
            // Simple check: start date matches day
            const isDone = sessions.some(s => {
                const sessionDate = new Date(s.started_at);
                return sessionDate.getDate() === date.getDate() &&
                    sessionDate.getMonth() === date.getMonth() &&
                    sessionDate.getFullYear() === date.getFullYear() &&
                    s.status === 'completed';
            });

            // Missed: Scheduled + Past + Not Done
            // Compare dates without time
            const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const dateNoTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            const isPast = dateNoTime < todayNoTime;

            let status: 'done' | 'missed' | 'scheduled' | 'rest' = 'rest';

            if (isDone) {
                status = 'done';
            } else if (isScheduled) {
                if (isPast) {
                    status = 'missed';
                } else {
                    status = 'scheduled';
                }
            }

            return {
                date,
                dayName: ["D", "S", "T", "Q", "Q", "S", "S"][i],
                dayNumber: date.getDate(),
                isToday,
                status
            };
        });

        return days;
    }, [workouts, sessions]);

    // Determine Workout for Selected Date
    const selectedWorkoutData = useMemo(() => {
        const selectedDayIndex = selectedDate.getDay();

        const workout = workouts.find(w => {
            if (!w.scheduled_days) return false;
            // Robust check: handle string "1" vs number 1
            const isScheduled = w.scheduled_days.some((d: any) => Number(d) === selectedDayIndex);
            return isScheduled;
        });

        // Check completion for selected date
        const isCompleted = sessions.some(s => {
            const sessionDate = new Date(s.started_at);
            return sessionDate.getDate() === selectedDate.getDate() &&
                sessionDate.getMonth() === selectedDate.getMonth() &&
                sessionDate.getFullYear() === selectedDate.getFullYear() &&
                s.status === 'completed';
        });

        // Determine display title
        const today = new Date();
        const isToday = selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();

        const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const dayName = weekDays[selectedDayIndex];

        // Format short date DD/MM
        const dateStr = `${selectedDate.getDate().toString().padStart(2, '0')}/${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}`;

        const title = isToday ? "Treino de Hoje" : `Treino de ${dayName} (${dateStr})`;

        return { workout, isCompleted, title };
    }, [workouts, sessions, selectedDate]);

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
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center gap-3">
                        <Image
                            source={require("../../assets/images/logo-icon.jpg")}
                            style={{ width: 32, height: 32, borderRadius: 8 }}
                        />
                        <View>
                            <Text className="text-slate-400 text-xs font-medium">
                                {getGreeting()},
                            </Text>
                            <Text className="text-xl font-bold text-slate-100">
                                {displayName}
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
                                    backgroundColor: '#1e293b',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: '#334155',
                                }}
                            >
                                <User size={24} color="#94a3b8" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Calendar */}
                <WeekCalendar
                    days={calendarData}
                    selectedDate={selectedDate}
                    onDayPress={(date) => setSelectedDate(date)}
                />

                {isLoading && !programName ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator className="text-violet-500" />
                        <Text className="text-slate-500 mt-4 font-medium">Sincronizando...</Text>
                    </View>
                ) : (
                    <>
                        {/* Progress */}
                        {programName && (
                            <ProgressCard
                                programName={programName}
                                completedSessions={weeklyProgress?.totalSessions || 0}
                                targetSessions={weeklyProgress?.targetSessions || 0}
                            />
                        )}

                        {/* Action Card (Selected Day) */}
                        <ActionCard
                            workout={selectedWorkoutData.workout}
                            isCompleted={selectedWorkoutData.isCompleted}
                            title={selectedWorkoutData.title}
                            onPress={() => {
                                if (selectedWorkoutData.workout?.id) {
                                    router.push(`/workout/${selectedWorkoutData.workout.id}`);
                                }
                            }}
                        />

                        {/* Workout List Section */}
                        <View className="mb-6">
                            {workouts.length > 0 ? (
                                <WorkoutList
                                    workouts={workouts}
                                    onWorkoutPress={(id) => router.push(`/workout/${id}`)}
                                />
                            ) : (
                                <View className="items-center py-6">
                                    <Text className="text-slate-500">Nenhum treino encontrado neste programa.</Text>
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

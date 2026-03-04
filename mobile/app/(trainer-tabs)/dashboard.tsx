import React from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, Dumbbell, DollarSign, TrendingUp, Play } from "lucide-react-native";
import Animated, { FadeInUp, FadeIn, Easing } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { useTrainerDashboard } from "../../hooks/useTrainerDashboard";
import { StatCard } from "../../components/trainer/StatCard";
import { PendingActionsSection } from "../../components/trainer/PendingActionsSection";
import { DailyActivityFeed } from "../../components/trainer/DailyActivityFeed";

function formatCurrency(value: number): string {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

function formatDate(): string {
    return new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

export default function DashboardScreen() {
    const { trainerProfile } = useRoleMode();
    const { stats, pendingActions, dailyActivity, isLoading, isRefreshing, refresh } = useTrainerDashboard();
    const router = useRouter();

    const firstName = trainerProfile?.name?.split(" ")[0] || "Treinador";

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }} edges={["top"]}>
                <ActivityIndicator size="large" color="#7c3aed" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#7c3aed" />
                }
            >
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: "#0f172a" }}>
                        {getGreeting()}, {firstName}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4, textTransform: "capitalize" }}>
                        {formatDate()}
                    </Text>
                </Animated.View>

                {/* Training Room CTA */}
                <Animated.View entering={FadeInUp.delay(30).duration(300).easing(Easing.out(Easing.cubic))} style={{ marginTop: 16 }}>
                    <TouchableOpacity
                        onPress={() => router.push("/training-room" as any)}
                        activeOpacity={0.7}
                        style={{
                            backgroundColor: "#7c3aed",
                            borderRadius: 16,
                            paddingVertical: 14,
                            paddingHorizontal: 20,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        <Play size={18} color="#fff" fill="#fff" />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                            Sala de Treino
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Pending Actions */}
                {pendingActions && (
                    <Animated.View entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))} style={{ marginTop: 20 }}>
                        <PendingActionsSection
                            pendingFinancial={pendingActions.pendingFinancial}
                            pendingForms={pendingActions.pendingForms}
                            inactiveStudents={pendingActions.inactiveStudents}
                            expiringPrograms={pendingActions.expiringPrograms}
                        />
                    </Animated.View>
                )}

                {/* Stats Grid */}
                {stats && (
                    <Animated.View entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: "#94a3b8",
                                letterSpacing: 2,
                                textTransform: "uppercase",
                                marginBottom: 10,
                                paddingLeft: 1,
                            }}
                        >
                            Resumo da semana
                        </Text>
                        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                            <StatCard
                                label="Alunos ativos"
                                value={stats.activeStudentsCount}
                                icon={Users}
                                iconColor="#7c3aed"
                                iconBg="#f5f3ff"
                            />
                            <StatCard
                                label="Treinos"
                                value={`${stats.sessionsThisWeek}/${stats.expectedSessionsThisWeek}`}
                                icon={Dumbbell}
                                iconColor="#16a34a"
                                iconBg="#f0fdf4"
                                subtitle="esta semana"
                            />
                        </View>
                        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                            <StatCard
                                label="MRR"
                                value={formatCurrency(stats.mrr)}
                                icon={DollarSign}
                                iconColor="#0ea5e9"
                                iconBg="#f0f9ff"
                            />
                            <StatCard
                                label="Aderência"
                                value={`${stats.adherencePercent}%`}
                                icon={TrendingUp}
                                iconColor={stats.adherencePercent >= 70 ? "#16a34a" : "#f59e0b"}
                                iconBg={stats.adherencePercent >= 70 ? "#f0fdf4" : "#fffbeb"}
                                subtitle={stats.hasActivePrograms ? undefined : "sem programas"}
                            />
                        </View>
                    </Animated.View>
                )}

                {/* Daily Activity */}
                <Animated.View entering={FadeInUp.delay(180).duration(300).easing(Easing.out(Easing.cubic))}>
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#94a3b8",
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            marginBottom: 10,
                            paddingLeft: 1,
                        }}
                    >
                        Atividade do dia
                    </Text>
                    <DailyActivityFeed items={dailyActivity} />
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

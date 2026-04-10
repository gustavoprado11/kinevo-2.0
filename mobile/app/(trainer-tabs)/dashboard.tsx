import React from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DashboardSkeleton } from "../../components/shared/skeletons/DashboardSkeleton";
import { colors } from "@/theme";
import { Users, Dumbbell, DollarSign, TrendingUp, Play, Bell } from "lucide-react-native";
import Animated, { FadeInUp, FadeIn, Easing } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { useTrainerDashboard } from "../../hooks/useTrainerDashboard";
import { StatCard } from "../../components/trainer/StatCard";
import { PendingActionsSection } from "../../components/trainer/PendingActionsSection";
import { DailyActivityFeed } from "../../components/trainer/DailyActivityFeed";
import { QuickActions } from "../../components/trainer/QuickActions";
import { useNotificationStore } from "../../stores/notification-store";
import { useResponsive } from "../../hooks/useResponsive";
import { ResponsiveContainer } from "../../components/shared/ResponsiveContainer";
import { ResponsiveGrid } from "../../components/shared/ResponsiveGrid";

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
    const unreadCount = useNotificationStore((s) => s.unreadCount);
    const { isTablet, spacingScale } = useResponsive();

    const firstName = trainerProfile?.name?.split(" ")[0] || "Treinador";

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={["top"]}>
                <DashboardSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: isTablet ? 40 : 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.brand.primary} />
                }
            >
              <ResponsiveContainer>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text.primary }}>
                            {getGreeting()}, {firstName}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 4, textTransform: "capitalize" }}>
                            {formatDate()}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push("/notifications" as any)}
                        accessibilityRole="button"
                        accessibilityLabel={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`}
                        hitSlop={12}
                        style={{ padding: 8, marginTop: 4 }}
                    >
                        <Bell size={24} color={colors.text.secondary} strokeWidth={1.8} />
                        {unreadCount > 0 && (
                            <View
                                style={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    minWidth: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    backgroundColor: colors.error.default,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingHorizontal: 4,
                                }}
                            >
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#ffffff" }}>
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Training Room CTA */}
                <Animated.View entering={FadeInUp.delay(30).duration(300).easing(Easing.out(Easing.cubic))} style={{ marginTop: 16 }}>
                    <TouchableOpacity
                        onPress={() => router.push("/training-room" as any)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir sala de treino"
                        style={{
                            backgroundColor: colors.brand.primary,
                            borderRadius: 16,
                            paddingVertical: 14,
                            paddingHorizontal: 20,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        <Play size={18} color={colors.text.inverse} fill={colors.text.inverse} />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.inverse }}>
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
                                color: colors.text.tertiary,
                                letterSpacing: 2,
                                textTransform: "uppercase",
                                marginBottom: 10,
                                paddingLeft: 1,
                            }}
                        >
                            Resumo da semana
                        </Text>
                        <ResponsiveGrid columns={{ phone: 2, tablet: 2 }} gap={10} style={{ marginBottom: 20 }}>
                            <StatCard
                                label="Alunos ativos"
                                value={stats.activeStudentsCount}
                                icon={Users}
                                iconColor={colors.brand.primary}
                                iconBg={colors.status.presencialBg}
                            />
                            <StatCard
                                label="Treinos"
                                value={`${stats.sessionsThisWeek}/${stats.expectedSessionsThisWeek}`}
                                icon={Dumbbell}
                                iconColor={colors.success.default}
                                iconBg={colors.success.light}
                                subtitle="esta semana"
                            />
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
                                iconColor={stats.adherencePercent >= 70 ? colors.success.default : colors.warning.default}
                                iconBg={stats.adherencePercent >= 70 ? colors.success.light : colors.warning.light}
                                subtitle={stats.hasActivePrograms ? undefined : "sem programas"}
                            />
                        </ResponsiveGrid>
                    </Animated.View>
                )}

                {/* Quick Actions */}
                <Animated.View entering={FadeInUp.delay(150).duration(300).easing(Easing.out(Easing.cubic))} style={{ marginBottom: 20 }}>
                    <QuickActions />
                </Animated.View>

                {/* Daily Activity */}
                <Animated.View entering={FadeInUp.delay(210).duration(300).easing(Easing.out(Easing.cubic))}>
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
              </ResponsiveContainer>
            </ScrollView>
        </SafeAreaView>
    );
}

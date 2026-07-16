import React from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Building2, Users, Activity, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, Easing } from "react-native-reanimated";
import { PressableScale } from "../components/shared/PressableScale";
import { KCard, KStatus } from "../components/v2";
import { useV2Colors } from "../hooks/useV2Colors";
import { v2 } from "@kinevo/shared/tokens";
import { toRgba } from "../lib/brandColor";
import {
    useStudioDashboard,
    type StudioCoachStats,
    type StudioStudentOverview,
} from "../hooks/useStudioDashboard";

const { spacing, radius } = v2;

/** "2026-07-10T..." → "há 6 dias" (curto, pt-BR). */
function relativeDays(iso: string | null): string {
    if (!iso) return "nunca treinou";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return "hoje";
    if (days === 1) return "ontem";
    return `há ${days} dias`;
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    const colors = useV2Colors();
    return (
        <KCard style={{ flex: 1, padding: spacing[3], gap: 6 }}>
            {icon}
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 20,
                    color: colors.text.primary,
                }}
            >
                {value}
            </Text>
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_500Medium",
                    fontSize: 11,
                    color: colors.text.tertiary,
                }}
            >
                {label}
            </Text>
        </KCard>
    );
}

function CoachRow({ coach }: { coach: StudioCoachStats }) {
    const colors = useV2Colors();
    const adherence = coach.adherence_pct != null ? Number(coach.adherence_pct) : null;
    const adherenceType = adherence == null ? "neutral" : adherence >= 70 ? "success" : adherence >= 40 ? "warning" : "danger";
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[4],
            }}
        >
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        fontSize: 14,
                        color: colors.text.primary,
                    }}
                >
                    {coach.coach_name}
                </Text>
                <Text
                    style={{
                        marginTop: 2,
                        fontFamily: "PlusJakartaSans_500Medium",
                        fontSize: 12,
                        color: colors.text.tertiary,
                    }}
                >
                    {Number(coach.active_students)} {Number(coach.active_students) === 1 ? "aluno" : "alunos"} · {Number(coach.completed_sessions)}/{Number(coach.expected_sessions)} treinos na semana
                </Text>
            </View>
            <KStatus
                type={adherenceType}
                label={adherence == null ? "—" : `${adherence}%`}
                layout="pill"
                size="sm"
            />
        </View>
    );
}

function StudentRiskRow({ student }: { student: StudioStudentOverview }) {
    const colors = useV2Colors();
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[4],
            }}
        >
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        fontSize: 14,
                        color: colors.text.primary,
                    }}
                >
                    {student.student_name}
                </Text>
                <Text
                    style={{
                        marginTop: 2,
                        fontFamily: "PlusJakartaSans_500Medium",
                        fontSize: 12,
                        color: colors.text.tertiary,
                    }}
                >
                    {student.coach_name ?? "sem responsável"} · último treino {relativeDays(student.last_session)}
                </Text>
            </View>
            {!student.has_active_program && (
                <KStatus type="warning" label="sem programa" layout="pill" size="sm" />
            )}
        </View>
    );
}

function Divider() {
    const colors = useV2Colors();
    return <View style={{ height: 1, backgroundColor: colors.border.subtle, marginHorizontal: spacing[4] }} />;
}

function SectionLabel({ title }: { title: string }) {
    const colors = useV2Colors();
    return (
        <Text
            style={{
                fontFamily: "PlusJakartaSans_600SemiBold",
                fontSize: 12,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: colors.text.quaternary,
                marginTop: spacing[5],
                marginBottom: spacing[2],
                marginLeft: spacing[1],
            }}
        >
            {title}
        </Text>
    );
}

export default function EstudioScreen() {
    const router = useRouter();
    const colors = useV2Colors();
    const {
        membership,
        coaches,
        students,
        totals,
        adherencePct,
        isLoading,
        isRefreshing,
        error,
        refresh,
    } = useStudioDashboard();

    const atRiskStudents = students.filter((s) => s.at_risk);

    // Guard: não-gestor (ou sem org) não tem painel — volta.
    if (!isLoading && (!membership || !membership.isManager)) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6] }}>
                    <Building2 size={32} color={colors.text.quaternary} />
                    <Text
                        style={{
                            marginTop: spacing[3],
                            textAlign: "center",
                            fontFamily: "PlusJakartaSans_600SemiBold",
                            fontSize: 15,
                            color: colors.text.primary,
                        }}
                    >
                        Painel disponível só para o gestor do estúdio
                    </Text>
                    <PressableScale
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.back();
                        }}
                        style={{
                            marginTop: spacing[4],
                            paddingHorizontal: spacing[5],
                            paddingVertical: spacing[3],
                            borderRadius: radius.lg,
                            backgroundColor: colors.brand.primary,
                        }}
                    >
                        <Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: "#fff" }}>Voltar</Text>
                    </PressableScale>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    gap: spacing[3],
                }}
            >
                <PressableScale
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.back();
                    }}
                    accessibilityLabel="Voltar"
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.surface.card,
                    }}
                >
                    <ChevronLeft size={20} color={colors.text.primary} />
                </PressableScale>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 18, color: colors.text.primary }}>
                        Estúdio
                    </Text>
                    {membership?.orgName ? (
                        <Text style={{ fontFamily: "PlusJakartaSans_500Medium", fontSize: 12, color: colors.text.tertiary }}>
                            {membership.orgName}
                        </Text>
                    ) : null}
                </View>
            </View>

            {isLoading && !coaches.length ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={colors.brand.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.text.tertiary} />
                    }
                >
                    {error ? (
                        <KCard style={{ padding: spacing[4] }}>
                            <Text style={{ fontFamily: "PlusJakartaSans_500Medium", fontSize: 13, color: colors.semantic.danger.fg }}>
                                Não foi possível carregar o painel. Puxe para tentar de novo.
                            </Text>
                        </KCard>
                    ) : null}

                    {/* KPIs */}
                    <Animated.View
                        entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
                        style={{ flexDirection: "row", gap: spacing[3] }}
                    >
                        <KpiCard
                            label="Alunos ativos"
                            value={String(totals.activeStudents)}
                            icon={<Users size={16} color={colors.brand.primary} />}
                        />
                        <KpiCard
                            label="Treinos na semana"
                            value={`${totals.completedSessions}/${totals.expectedSessions}`}
                            icon={<Activity size={16} color={colors.brand.primary} />}
                        />
                        <KpiCard
                            label="Aderência"
                            value={adherencePct == null ? "—" : `${adherencePct}%`}
                            icon={<AlertTriangle size={16} color={totals.atRisk > 0 ? colors.semantic.warning.default : colors.brand.primary} />}
                        />
                    </Animated.View>

                    {/* Treinadores */}
                    <SectionLabel title="Treinadores" />
                    <Animated.View entering={FadeInUp.delay(80).duration(300).easing(Easing.out(Easing.cubic))}>
                        <KCard style={{ padding: 0 }}>
                            {coaches.length === 0 ? (
                                <Text
                                    style={{
                                        padding: spacing[4],
                                        fontFamily: "PlusJakartaSans_500Medium",
                                        fontSize: 13,
                                        color: colors.text.tertiary,
                                    }}
                                >
                                    Nenhum treinador ativo no estúdio.
                                </Text>
                            ) : (
                                coaches.map((c, i) => (
                                    <React.Fragment key={c.coach_id}>
                                        {i > 0 && <Divider />}
                                        <CoachRow coach={c} />
                                    </React.Fragment>
                                ))
                            )}
                        </KCard>
                    </Animated.View>

                    {/* Alunos em risco */}
                    <SectionLabel title={`Alunos em risco (${atRiskStudents.length})`} />
                    <Animated.View entering={FadeInUp.delay(140).duration(300).easing(Easing.out(Easing.cubic))}>
                        <KCard style={{ padding: 0 }}>
                            {atRiskStudents.length === 0 ? (
                                <View style={{ padding: spacing[4], flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                                    <View
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: toRgba(colors.brand.primary, 0.9),
                                        }}
                                    />
                                    <Text style={{ fontFamily: "PlusJakartaSans_500Medium", fontSize: 13, color: colors.text.tertiary }}>
                                        Nenhum aluno em risco — sem programa ou 14+ dias sem treinar.
                                    </Text>
                                </View>
                            ) : (
                                atRiskStudents.map((s, i) => (
                                    <React.Fragment key={s.student_id}>
                                        {i > 0 && <Divider />}
                                        <StudentRiskRow student={s} />
                                    </React.Fragment>
                                ))
                            )}
                        </KCard>
                    </Animated.View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

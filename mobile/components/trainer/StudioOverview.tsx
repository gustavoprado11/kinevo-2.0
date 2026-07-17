import React from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { Users, Activity, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, Easing } from "react-native-reanimated";
import { KCard, KStatus } from "../v2";
import { useV2Colors } from "../../hooks/useV2Colors";
import { v2 } from "@kinevo/shared/tokens";
import { toRgba } from "../../lib/brandColor";
import {
    useStudioDashboard,
    type StudioCoachStats,
    type StudioStudentOverview,
} from "../../hooks/useStudioDashboard";

const { spacing } = v2;

/** "2026-07-10T..." → "há 6 dias". */
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
            <Text style={{ fontFamily: "MonaSans_700Bold", fontSize: 20, color: colors.text.primary }}>{value}</Text>
            <Text style={{ fontFamily: "MonaSans_500Medium", fontSize: 11, color: colors.text.tertiary }}>{label}</Text>
        </KCard>
    );
}

function CoachRow({ coach }: { coach: StudioCoachStats }) {
    const colors = useV2Colors();
    const adherence = coach.adherence_pct != null ? Number(coach.adherence_pct) : null;
    const adherenceType = adherence == null ? "neutral" : adherence >= 70 ? "success" : adherence >= 40 ? "warning" : "danger";
    return (
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], paddingHorizontal: spacing[4] }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "MonaSans_600SemiBold", fontSize: 14, color: colors.text.primary }}>
                    {coach.coach_name}
                </Text>
                <Text style={{ marginTop: 2, fontFamily: "MonaSans_500Medium", fontSize: 12, color: colors.text.tertiary }}>
                    {Number(coach.active_students)} {Number(coach.active_students) === 1 ? "aluno" : "alunos"} · {Number(coach.completed_sessions)}/{Number(coach.expected_sessions)} treinos na semana
                </Text>
            </View>
            <KStatus type={adherenceType} label={adherence == null ? "—" : `${adherence}%`} layout="pill" size="sm" />
        </View>
    );
}

function StudentRiskRow({ student }: { student: StudioStudentOverview }) {
    const colors = useV2Colors();
    return (
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], paddingHorizontal: spacing[4] }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "MonaSans_600SemiBold", fontSize: 14, color: colors.text.primary }}>
                    {student.student_name}
                </Text>
                <Text style={{ marginTop: 2, fontFamily: "MonaSans_500Medium", fontSize: 12, color: colors.text.tertiary }}>
                    {student.coach_name ?? "sem responsável"} · último treino {relativeDays(student.last_session)}
                </Text>
            </View>
            {!student.has_active_program && <KStatus type="warning" label="sem programa" layout="pill" size="sm" />}
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
                fontFamily: "MonaSans_600SemiBold",
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

/**
 * Visão do ESTÚDIO no Dashboard do gestor (decisão 16/jul: o estúdio usa as
 * telas normais — nada de painel paralelo). Renderizada dentro do
 * DashboardScreen quando o gestor está no escopo "Estúdio".
 */
export function StudioOverview({ scopeToggle }: { scopeToggle: React.ReactNode }) {
    const colors = useV2Colors();
    const { membership, coaches, students, totals, adherencePct, isLoading, isRefreshing, refresh } = useStudioDashboard();
    const atRiskStudents = students.filter((s) => s.at_risk);

    if (isLoading && !coaches.length) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={colors.brand.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.text.tertiary} />}
        >
            <View style={{ marginBottom: spacing[3], flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: spacing[2] }}>
                    <Text style={{ fontFamily: "MonaSans_700Bold", fontSize: 22, color: colors.text.primary }} numberOfLines={1}>
                        {membership?.orgName ?? "Estúdio"}
                    </Text>
                    <Text style={{ fontFamily: "MonaSans_500Medium", fontSize: 12, color: colors.text.tertiary }}>
                        Visão do estúdio
                    </Text>
                </View>
                {scopeToggle}
            </View>

            <Animated.View entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))} style={{ flexDirection: "row", gap: spacing[3] }}>
                <KpiCard label="Alunos ativos" value={String(totals.activeStudents)} icon={<Users size={16} color={colors.brand.primary} />} />
                <KpiCard label="Treinos na semana" value={`${totals.completedSessions}/${totals.expectedSessions}`} icon={<Activity size={16} color={colors.brand.primary} />} />
                <KpiCard
                    label="Aderência"
                    value={adherencePct == null ? "—" : `${adherencePct}%`}
                    icon={<AlertTriangle size={16} color={totals.atRisk > 0 ? colors.semantic.warning.default : colors.brand.primary} />}
                />
            </Animated.View>

            <SectionLabel title="Treinadores" />
            <Animated.View entering={FadeInUp.delay(80).duration(300).easing(Easing.out(Easing.cubic))}>
                <KCard style={{ padding: 0 }}>
                    {coaches.length === 0 ? (
                        <Text style={{ padding: spacing[4], fontFamily: "MonaSans_500Medium", fontSize: 13, color: colors.text.tertiary }}>
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

            <SectionLabel title={`Alunos em risco (${atRiskStudents.length})`} />
            <Animated.View entering={FadeInUp.delay(140).duration(300).easing(Easing.out(Easing.cubic))}>
                <KCard style={{ padding: 0 }}>
                    {atRiskStudents.length === 0 ? (
                        <View style={{ padding: spacing[4], flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toRgba(colors.brand.primary, 0.9) }} />
                            <Text style={{ fontFamily: "MonaSans_500Medium", fontSize: 13, color: colors.text.tertiary }}>
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
    );
}

import React, { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
    Users,
    Dumbbell,
    DollarSign,
    TrendingUp,
    Play,
    Bell,
    Calendar,
    ChevronRight,
    CreditCard,
    FileText,
    UserX,
    CalendarClock,
    Activity,
    CheckCircle2,
    LayoutTemplate,
} from "lucide-react-native";
import Animated, { FadeInUp, FadeIn, Easing } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { useTrainerDashboard, type DailyActivityItem } from "../../hooks/useTrainerDashboard";
import { useNotificationStore } from "../../stores/notification-store";
import { useResponsive } from "../../hooks/useResponsive";
import { ResponsiveContainer } from "../../components/shared/ResponsiveContainer";
import { AdaptiveModal } from "../../components/shared/AdaptiveModal";
import { v2 } from "@kinevo/shared/tokens";
import {
    KCard,
    KPICard,
    KStatus,
    KSkeleton,
    KSkeletonRow,
    KSkeletonKPICard,
} from "../../components/v2";
import { useV2Colors } from "../../hooks/useV2Colors";
import { useAssistantMode, syncAssistantModeFromServer } from "../../hooks/useAssistantMode";
import { useAssistantAccess } from "../../hooks/useAssistantAccess";
import { AssistantModeToggle } from "../../components/assistant/AssistantModeToggle";
import { AssistantDashboard } from "../../components/assistant/AssistantDashboard";

// Palette light fallback usada em arrays/configs module-level (cores brand
// não diferem entre modos). Componentes interno chamam `useV2Colors()` pra
// pegar tokens sensíveis a modo (surface/text/border).
const { colors, typography, spacing, radius } = v2;

function formatCurrency(value: number): string {
    if (value >= 1000) {
        const k = (value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
        return `R$ ${k}k`;
    }
    return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

function formatDate(): string {
    // pt-BR retorna "sábado, 9 de maio" minúsculo. Capitalizamos só o
    // primeiro caractere (sentence case): "Sábado, 9 de maio".
    const raw = new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const QUICK_ACCESS: Array<{
    key: string;
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    color: string;
    route: string;
}> = [
    { key: "agenda", label: "Agenda", icon: Calendar, color: colors.purple[600], route: "/agenda" },
    { key: "financial", label: "Financeiro", icon: DollarSign, color: colors.semantic.info.default, route: "/financial" },
    { key: "exercises", label: "Exercícios", icon: Dumbbell, color: colors.semantic.warning.default, route: "/exercises" },
    { key: "templates", label: "Modelos", icon: LayoutTemplate, color: colors.semantic.success.default, route: "/program-templates" },
];

export default function DashboardScreen() {
    // Modo da Home: clássico (default) ou assistente (mirror de trainers.home_style).
    const { mode } = useAssistantMode();
    const { allowed } = useAssistantAccess();
    // Sincroniza com o servidor uma vez ao entrar (paridade web↔mobile).
    React.useEffect(() => {
        void syncAssistantModeFromServer();
    }, []);
    // Gate por acesso: só honra o modo assistente se o tier tem IA (hoje: todos).
    if (mode === "assistant" && allowed) return <AssistantDashboard />;
    return <ClassicDashboard />;
}

function ClassicDashboard() {
    const colors = useV2Colors();
    const { setMode: setAssistantMode } = useAssistantMode();
    const { allowed: assistantAllowed } = useAssistantAccess();
    const { trainerProfile } = useRoleMode();
    const { stats, pendingActions, dailyActivity, isLoading, isRefreshing, refresh } = useTrainerDashboard();
    const router = useRouter();
    const unreadCount = useNotificationStore((s) => s.unreadCount);
    const { isTablet } = useResponsive();

    const firstName = trainerProfile?.name?.split(" ")[0] || "Treinador";
    const activeStudents = stats?.activeStudentsCount ?? 0;
    const subContext = activeStudents > 0
        ? `${activeStudents} ${activeStudents === 1 ? "aluno ativo" : "alunos ativos"}`
        : "sem alunos ativos";

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[5] }}>
                    {/* Header */}
                    <View style={{ gap: 8 }}>
                        <KSkeleton width="70%" height={28} />
                        <KSkeleton width="50%" height={13} />
                    </View>
                    {/* Sala de Treino CTA */}
                    <KSkeleton width="100%" height={64} variant="rect" style={{ borderRadius: radius.lg }} />
                    {/* Pending actions */}
                    <View style={{ gap: spacing[2] }}>
                        <KSkeleton width="40%" height={11} />
                        <KSkeletonRow lines={2} />
                        <KSkeletonRow lines={2} />
                        <KSkeletonRow lines={2} />
                    </View>
                    {/* KPI grid */}
                    <View style={{ gap: spacing[3] }}>
                        <KSkeleton width="40%" height={11} />
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                            <View style={{ flexBasis: "48%", flexGrow: 1 }}><KSkeletonKPICard /></View>
                            <View style={{ flexBasis: "48%", flexGrow: 1 }}><KSkeletonKPICard /></View>
                            <View style={{ flexBasis: "48%", flexGrow: 1 }}><KSkeletonKPICard /></View>
                            <View style={{ flexBasis: "48%", flexGrow: 1 }}><KSkeletonKPICard /></View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: isTablet ? 40 : 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.purple[600]} />
                }
            >
                <ResponsiveContainer>
                    {/* Header */}
                    <Animated.View
                        entering={FadeIn.duration(400)}
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing[5] }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                style={{
                                    fontFamily: "PlusJakartaSans_800ExtraBold",
                                    fontSize: 28,
                                    lineHeight: 34,
                                    letterSpacing: typography.display.letterSpacing,
                                    color: colors.text.primary,
                                }}
                            >
                                {getGreeting()}, {firstName}
                            </Text>
                            <Text
                                style={{
                                    fontFamily: "PlusJakartaSans_500Medium",
                                    fontSize: typography.bodySm.size,
                                    color: colors.text.tertiary,
                                    marginTop: spacing[1],
                                }}
                            >
                                {formatDate()} · {subContext}
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => router.push("/notifications" as any)}
                            accessibilityRole="button"
                            accessibilityLabel={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
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
                                        backgroundColor: colors.semantic.danger.default,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        paddingHorizontal: 4,
                                        borderWidth: 1.5,
                                        borderColor: colors.surface.card,
                                    }}
                                >
                                    <Text style={{ fontFamily: "PlusJakartaSans_800ExtraBold", fontSize: 10, color: "#FFFFFF" }}>
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    </Animated.View>

                    {/* Mode toggle (Clássico / Assistente) — espelha trainers.home_style.
                        Só aparece quando o tier tem IA (hoje: todos). */}
                    {assistantAllowed ? (
                        <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[5] }}>
                            <AssistantModeToggle mode="classic" onChange={setAssistantMode} />
                        </View>
                    ) : null}

                    {/* Training Room CTA */}
                    <Animated.View
                        entering={FadeInUp.delay(30).duration(300).easing(Easing.out(Easing.cubic))}
                        style={{ marginTop: spacing[4], paddingHorizontal: spacing[5] }}
                    >
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                router.push("/training-room" as any);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir sala de treino"
                            style={{
                                borderRadius: radius.lg,
                                overflow: "hidden",
                                shadowColor: colors.purple[600],
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.32,
                                shadowRadius: 28,
                                elevation: 12,
                            }}
                        >
                            <LinearGradient
                                colors={[colors.purple[700], colors.purple[500], colors.purple[600]]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                    paddingVertical: spacing[4],
                                    paddingHorizontal: spacing[5],
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: spacing[3],
                                }}
                            >
                                <View
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: "rgba(255,255,255,0.2)",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: "PlusJakartaSans_700Bold", fontSize: 16, color: "#FFFFFF", letterSpacing: -0.2 }}>
                                        Sala de Treino
                                    </Text>
                                    <Text style={{ fontFamily: "PlusJakartaSans_500Medium", fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: 2 }}>
                                        Toque para entrar
                                    </Text>
                                </View>
                                <ChevronRight size={20} color="#FFFFFF" />
                            </LinearGradient>
                        </Pressable>
                    </Animated.View>

                    {/* Pending Actions */}
                    {pendingActions ? (
                        <Animated.View
                            entering={FadeInUp.delay(60).duration(300).easing(Easing.out(Easing.cubic))}
                            style={{ marginTop: spacing[5], paddingHorizontal: spacing[5] }}
                        >
                            <SectionLabel>Ações pendentes</SectionLabel>
                            <PendingActionsList
                                pendingFinancial={pendingActions.pendingFinancial}
                                pendingForms={pendingActions.pendingForms}
                                inactiveStudents={pendingActions.inactiveStudents}
                                expiringPrograms={pendingActions.expiringPrograms}
                            />
                        </Animated.View>
                    ) : null}

                    {/* Stats Grid — KPICards */}
                    {stats ? (
                        <Animated.View
                            entering={FadeInUp.delay(120).duration(300).easing(Easing.out(Easing.cubic))}
                            style={{ marginTop: spacing[5], paddingHorizontal: spacing[5] }}
                        >
                            <SectionLabel>Resumo da semana</SectionLabel>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                                <KPICol>
                                    <KPICard
                                        label="Alunos"
                                        value={String(stats.activeStudentsCount)}
                                        icon={<Users size={14} color={colors.purple[600]} strokeWidth={2.5} />}
                                        accent="purple"
                                        data={[]}
                                    />
                                </KPICol>
                                <KPICol>
                                    <KPICard
                                        label="Treinos"
                                        value={String(stats.sessionsThisWeek)}
                                        valueSub={`/${stats.expectedSessionsThisWeek}`}
                                        icon={<Dumbbell size={14} color={colors.semantic.success.default} strokeWidth={2.5} />}
                                        accent="success"
                                        data={[]}
                                    />
                                </KPICol>
                                <KPICol>
                                    <KPICard
                                        label="Receita Mensal"
                                        value={formatCurrency(stats.mrr)}
                                        icon={<DollarSign size={14} color={colors.semantic.info.default} strokeWidth={2.5} />}
                                        accent="info"
                                        data={[]}
                                    />
                                </KPICol>
                                <KPICol>
                                    <KPICard
                                        label="Aderência"
                                        value={String(stats.adherencePercent)}
                                        valueSub="%"
                                        icon={
                                            <TrendingUp
                                                size={14}
                                                color={stats.adherencePercent >= 70 ? colors.semantic.success.default : colors.semantic.warning.default}
                                                strokeWidth={2.5}
                                            />
                                        }
                                        accent={stats.adherencePercent >= 70 ? "success" : "warning"}
                                        data={[]}
                                    />
                                </KPICol>
                            </View>
                        </Animated.View>
                    ) : null}

                    {/* Quick Access — grade 2x2 (wrap). */}
                    <Animated.View
                        entering={FadeInUp.delay(150).duration(300).easing(Easing.out(Easing.cubic))}
                        style={{ marginTop: spacing[5], paddingHorizontal: spacing[5] }}
                    >
                        <SectionLabel>Acesso rápido</SectionLabel>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                            {QUICK_ACCESS.map((q) => {
                                // Atalho da Agenda usa a marca; resolve com o hook
                                // (o array é module-level e não enxerga a marca custom).
                                const qColor = q.key === "agenda" ? colors.purple[600] : q.color;
                                return (
                                <View key={q.key} style={{ width: "48%" }}>
                                    <KCard
                                        variant="tinted"
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            router.push(q.route as never);
                                        }}
                                        accessibilityLabel={q.label}
                                    >
                                        <View style={{ alignItems: "flex-start", gap: spacing[2] }}>
                                            <View
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: radius.sm,
                                                    backgroundColor: qColor + "1A",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <q.icon size={16} color={qColor} strokeWidth={2.4} />
                                            </View>
                                            <Text
                                                style={{
                                                    fontFamily: "PlusJakartaSans_600SemiBold",
                                                    fontSize: 11,
                                                    color: colors.text.primary,
                                                    letterSpacing: -0.005,
                                                }}
                                                numberOfLines={1}
                                            >
                                                {q.label}
                                            </Text>
                                        </View>
                                    </KCard>
                                </View>
                                );
                            })}
                        </View>
                    </Animated.View>

                    {/* Atividade do dia — V2 (refatorado da Fase 3) */}
                    <Animated.View
                        entering={FadeInUp.delay(210).duration(300).easing(Easing.out(Easing.cubic))}
                        style={{ marginTop: spacing[5], paddingHorizontal: spacing[5] }}
                    >
                        <SectionLabel>Atividade do dia</SectionLabel>
                        <DailyActivitySection items={dailyActivity} />
                    </Animated.View>
                </ResponsiveContainer>
            </ScrollView>
        </SafeAreaView>
    );
}

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            style={{
                fontFamily: "PlusJakartaSans_700Bold",
                fontSize: 11,
                color: colors.text.tertiary,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: spacing[3],
            }}
        >
            {children}
        </Text>
    );
}

function KPICol({ children }: { children: React.ReactNode }) {
    return <View style={{ flexBasis: "48%", flexGrow: 1 }}>{children}</View>;
}

// ── Pending Actions list (V2 — KCard + KStatus) ─────────────────────

type PendingFinancialItem = NonNullable<
    ReturnType<typeof useTrainerDashboard>["pendingActions"]
>["pendingFinancial"][number];
type PendingFormItem = NonNullable<
    ReturnType<typeof useTrainerDashboard>["pendingActions"]
>["pendingForms"][number];
type InactiveStudentItem = NonNullable<
    ReturnType<typeof useTrainerDashboard>["pendingActions"]
>["inactiveStudents"][number];
type ExpiringProgramItem = NonNullable<
    ReturnType<typeof useTrainerDashboard>["pendingActions"]
>["expiringPrograms"][number];

// Urgency rank: urgent=0 (mais alto, vem primeiro), warning=1, info=2.
type Urgency = "urgent" | "warning" | "info";

interface PendingActionItem {
    key: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    urgency: Urgency;
    statusType: "warning" | "danger" | "info" | "neutral";
    statusLabel: string;
    onPress: () => void;
}

const URGENCY_RANK: Record<Urgency, number> = {
    urgent: 0,
    warning: 1,
    info: 2,
};

function sortByUrgency(actions: PendingActionItem[]): PendingActionItem[] {
    return [...actions].sort((a, b) => {
        const rankDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        if (rankDiff !== 0) return rankDiff;
        return a.title.localeCompare(b.title, "pt-BR");
    });
}

function PendingActionsList({
    pendingFinancial,
    pendingForms,
    inactiveStudents,
    expiringPrograms,
}: {
    pendingFinancial: PendingFinancialItem[];
    pendingForms: PendingFormItem[];
    inactiveStudents: InactiveStudentItem[];
    expiringPrograms: ExpiringProgramItem[];
}) {
    const colors = useV2Colors();
    const router = useRouter();
    const [showAllVisible, setShowAllVisible] = useState(false);

    const items: PendingActionItem[] = [];

    pendingFinancial.forEach((p) => {
        items.push({
            key: `fin-${p.id}`,
            title: p.student_name,
            subtitle: "Pagamento pendente",
            icon: CreditCard,
            urgency: "warning",
            statusType: "warning",
            statusLabel: "Financeiro",
            onPress: () => router.push("/financial" as never),
        });
    });
    pendingForms.forEach((f) => {
        items.push({
            key: `form-${f.id}`,
            title: f.student_name,
            subtitle: f.template_title,
            icon: FileText,
            urgency: "info",
            statusType: "info",
            statusLabel: "Formulário",
            onPress: () => router.push("/(trainer-tabs)/forms" as never),
        });
    });
    inactiveStudents.forEach((s) => {
        items.push({
            key: `inactive-${s.id}`,
            title: s.name,
            subtitle: `Inativo há ${s.days_since_last_session} dias · ${s.program_name}`,
            icon: UserX,
            urgency: "urgent",
            statusType: "danger",
            statusLabel: "Inativo",
            onPress: () =>
                router.push({ pathname: "/student/[id]", params: { id: s.id } } as never),
        });
    });
    expiringPrograms.forEach((p) => {
        items.push({
            key: `exp-${p.student_id}`,
            title: p.student_name,
            subtitle: `Programa expira em ${p.ends_in_days} dia${p.ends_in_days === 1 ? "" : "s"}`,
            icon: CalendarClock,
            urgency: "warning",
            statusType: "warning",
            statusLabel: "Programa",
            onPress: () =>
                router.push({ pathname: "/student/[id]", params: { id: p.student_id } } as never),
        });
    });

    if (items.length === 0) {
        return (
            <KCard>
                <Text style={{ fontFamily: "PlusJakartaSans_500Medium", fontSize: 13, color: colors.text.tertiary }}>
                    Tudo em dia. Nenhuma ação pendente. ✓
                </Text>
            </KCard>
        );
    }

    const sorted = sortByUrgency(items);
    const top3 = sorted.slice(0, 3);
    const hasMore = sorted.length > 3;

    return (
        <>
            <View style={{ gap: spacing[2] }}>
                {top3.map((it) => (
                    <PendingActionRow key={it.key} item={it} />
                ))}

                {hasMore ? (
                    <Pressable
                        onPress={() => setShowAllVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver todas as ${sorted.length} ações pendentes`}
                        hitSlop={6}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingVertical: 12,
                            paddingHorizontal: 4,
                            gap: 4,
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_600SemiBold",
                                fontSize: typography.bodySm.size,
                                color: colors.purple[700],
                            }}
                        >
                            Ver todas as {sorted.length} ações
                        </Text>
                        <ChevronRight size={14} color={colors.purple[700]} strokeWidth={2.4} />
                    </Pressable>
                ) : null}
            </View>

            <AdaptiveModal
                visible={showAllVisible}
                onClose={() => setShowAllVisible(false)}
                title={`Ações pendentes · ${sorted.length}`}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingHorizontal: spacing[5],
                        paddingTop: spacing[4],
                        paddingBottom: spacing[8],
                        gap: spacing[2],
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    {sorted.map((it) => (
                        <PendingActionRow
                            key={it.key}
                            item={it}
                            onPress={() => {
                                setShowAllVisible(false);
                                it.onPress();
                            }}
                        />
                    ))}
                </ScrollView>
            </AdaptiveModal>
        </>
    );
}

function PendingActionRow({
    item,
    onPress,
}: {
    item: PendingActionItem;
    onPress?: () => void;
}) {
    const colors = useV2Colors();
    const accentColor: Record<Urgency, string> = {
        urgent: colors.semantic.danger.default,
        warning: colors.semantic.warning.default,
        info: colors.purple[600],
    };
    const border = accentColor[item.urgency];
    const handlePress = onPress ?? item.onPress;

    return (
        <View style={{ position: "relative" }}>
            <View
                style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: border,
                    zIndex: 1,
                }}
            />
            <KCard onPress={handlePress} accessibilityLabel={`${item.statusLabel}: ${item.title}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                    <View
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            backgroundColor: border + "1A",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <item.icon size={18} color={border} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                            <Text
                                style={{
                                    fontFamily: "PlusJakartaSans_700Bold",
                                    fontSize: 14,
                                    color: colors.text.primary,
                                    flex: 1,
                                }}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>
                            <KStatus type={item.statusType} label={item.statusLabel} layout="pill" size="sm" />
                        </View>
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_500Medium",
                                fontSize: 12,
                                color: colors.text.tertiary,
                                marginTop: 2,
                            }}
                            numberOfLines={1}
                        >
                            {item.subtitle}
                        </Text>
                    </View>
                    <ChevronRight size={16} color={colors.text.quaternary} />
                </View>
            </KCard>
        </View>
    );
}

// ── Daily Activity (V2) ─────────────────────────────────────────────

const MAX_ACTIVITY_ROWS = 4;

function DailyActivitySection({ items }: { items: DailyActivityItem[] }) {
    const colors = useV2Colors();
    const router = useRouter();

    if (items.length === 0) {
        return (
            <KCard>
                <View style={{ alignItems: "center", paddingVertical: spacing[2], gap: spacing[2] }}>
                    <Activity size={32} color={colors.text.quaternary} strokeWidth={1.8} />
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: 14,
                            color: colors.text.tertiary,
                            textAlign: "center",
                        }}
                    >
                        Nenhum treino completado hoje
                    </Text>
                    <Pressable
                        onPress={() => router.push("/(trainer-tabs)/students" as never)}
                        accessibilityRole="link"
                        accessibilityLabel="Ver lista de alunos"
                        hitSlop={6}
                    >
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_600SemiBold",
                                fontSize: 13,
                                color: colors.purple[700],
                            }}
                        >
                            Ver alunos
                        </Text>
                    </Pressable>
                </View>
            </KCard>
        );
    }

    const visible = items.slice(0, MAX_ACTIVITY_ROWS);
    const rest = items.length - visible.length;

    return (
        <KCard style={{ padding: 0 }}>
            <View>
                {visible.map((item, idx) => (
                    <DailyActivityRow
                        key={item.id}
                        item={item}
                        showDivider={idx < visible.length - 1}
                    />
                ))}
                {rest > 0 ? (
                    <Pressable
                        onPress={() => router.push("/(trainer-tabs)/students" as never)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver todas as ${items.length} atividades de hoje`}
                        hitSlop={6}
                        style={{
                            paddingVertical: spacing[3],
                            paddingHorizontal: spacing[4],
                            alignItems: "center",
                            borderTopWidth: 1,
                            borderTopColor: colors.border.subtle,
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_600SemiBold",
                                fontSize: 13,
                                color: colors.purple[700],
                            }}
                        >
                            Ver mais {rest} {rest === 1 ? "atividade" : "atividades"}
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        </KCard>
    );
}

function DailyActivityRow({
    item,
    showDivider,
}: {
    item: DailyActivityItem;
    showDivider: boolean;
}) {
    const colors = useV2Colors();
    const router = useRouter();
    const time = new Date(item.completed_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <Pressable
            onPress={() =>
                router.push({ pathname: "/student/[id]", params: { id: item.student_id } } as never)
            }
            accessibilityRole="button"
            accessibilityLabel={`Treino ${item.workout_name} concluído por ${item.student_name} às ${time}`}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[3],
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[4],
                borderBottomWidth: showDivider ? 1 : 0,
                borderBottomColor: colors.border.subtle,
            }}
        >
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.sm,
                    backgroundColor: colors.semantic.success.bg,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <CheckCircle2 size={16} color={colors.semantic.success.fg} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    style={{
                        fontFamily: "PlusJakartaSans_600SemiBold",
                        fontSize: 13,
                        color: colors.text.primary,
                    }}
                    numberOfLines={1}
                >
                    {item.student_name}
                </Text>
                <Text
                    style={{
                        fontFamily: "PlusJakartaSans_500Medium",
                        fontSize: 12,
                        color: colors.text.tertiary,
                        marginTop: 2,
                    }}
                    numberOfLines={1}
                >
                    {item.workout_name}
                </Text>
            </View>
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_500Medium",
                    fontSize: 11,
                    color: colors.text.quaternary,
                }}
            >
                {time}
            </Text>
        </Pressable>
    );
}

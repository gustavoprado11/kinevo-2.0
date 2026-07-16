import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Users, Plus, ChevronRight, Lock } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInUp, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
    useTrainerStudentsList,
    type TrainerStudent,
    type StudentFilter,
} from "../../hooks/useTrainerStudentsList";
import { EmptyState } from "../../components/shared/EmptyState";
import { AddStudentModal } from "../../components/trainer/students/AddStudentModal";
import { MasterDetailLayout } from "../../components/shared/MasterDetailLayout";
import { useResponsive } from "../../hooks/useResponsive";
import { useAiStatus } from "../../hooks/useAiStatus";
import { v2 } from "@kinevo/shared/tokens";
import {
    KCard,
    KSearchBox,
    KSegmented,
    Avatar,
    type AvatarStatus,
    type KStatusType,
} from "../../components/v2";
import { KStatus } from "../../components/v2";
import { useV2Colors } from "../../hooks/useV2Colors";
import { KSkeleton, KSkeletonRow } from "../../components/v2";

// Palette light fallback usada em arrays/configs module-level. Componentes
// chamam `useV2Colors()` para tokens sensíveis a modo.
const { colors, typography, spacing, radius } = v2;

const StudentProfileScreen = React.lazy(() => import("../student/[id]"));

function StudentDetailPlaceholder() {
    const colors = useV2Colors();
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.canvas }}>
            <Users size={48} color={colors.text.quaternary} />
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_500Medium",
                    fontSize: 16,
                    color: colors.text.tertiary,
                    marginTop: 12,
                }}
            >
                Selecione um aluno
            </Text>
        </View>
    );
}

function relativeDate(dateStr: string | null): string {
    if (!dateStr) return "nunca";
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "hoje";
    if (diffDays === 1) return "ontem";
    if (diffDays < 30) return `há ${diffDays} dias`;
    return `há ${Math.floor(diffDays / 30)}m`;
}

function getStudentMeta(s: TrainerStudent): {
    avatarStatus: AvatarStatus | undefined;
    metaLabel: string;
    metaType: KStatusType;
    cta: { label: string; onPress?: () => void } | null;
} {
    const isInactive = s.status === "inactive";
    const noProgram = !s.program_name && !s.is_trainer_profile;
    const last = s.last_session_date;
    let avatarStatus: AvatarStatus | undefined;
    let metaLabel = "";
    let metaType: KStatusType = "neutral";

    if (isInactive) {
        avatarStatus = "inactive";
        metaLabel = `Inativo · ${relativeDate(last)}`;
        metaType = "danger";
    } else if (noProgram) {
        metaLabel = "Sem programa";
        metaType = "neutral";
    } else if (last) {
        const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
        if (days <= 1) {
            avatarStatus = "online";
            metaLabel = `Treinou ${relativeDate(last)} · ${s.sessions_this_week}/${s.expected_per_week}`;
            metaType = "success";
        } else if (days <= 5) {
            metaLabel = `Treinou ${relativeDate(last)} · ${s.sessions_this_week}/${s.expected_per_week}`;
            metaType = "info";
        } else {
            avatarStatus = "attention";
            metaLabel = `Sem treino ${relativeDate(last)}`;
            metaType = "warning";
        }
    } else {
        metaLabel = "Sem sessões ainda";
        metaType = "neutral";
    }

    return { avatarStatus, metaLabel, metaType, cta: null };
}

export default function StudentsScreen() {
    const colors = useV2Colors();
    const {
        students,
        counts,
        isLoading,
        isRefreshing,
        search,
        setSearch,
        filter,
        setFilter,
        refresh,
    } = useTrainerStudentsList();

    const router = useRouter();
    const { isTablet } = useResponsive();
    const insets = useSafeAreaInsets();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [showAddStudent, setShowAddStudent] = useState(false);
    // Gate de tier: no Free já no limite de alunos, o backend recusa a criação.
    // Aqui espelhamos isso na UX trocando o FAB por um CTA de assinatura.
    const { status: aiStatus } = useAiStatus();
    const studentsLocked = aiStatus?.studentsLocked ?? false;

    useEffect(() => {
        if (isTablet && students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(students[0].id);
        }
    }, [isTablet, students, selectedStudentId]);

    const handleStudentPress = useCallback(
        (student: TrainerStudent) => {
            if (isTablet) {
                setSelectedStudentId(student.id);
            } else {
                router.push({ pathname: "/student/[id]", params: { id: student.id } } as never);
            }
        },
        [isTablet, router],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: TrainerStudent; index: number }) => (
            <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 25).duration(220).easing(Easing.out(Easing.cubic))}>
                <StudentRow
                    student={item}
                    selected={isTablet && selectedStudentId === item.id}
                    onPress={() => handleStudentPress(item)}
                />
            </Animated.View>
        ),
        [handleStudentPress, isTablet, selectedStudentId],
    );

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3] }}>
                    {/* Header */}
                    <View style={{ gap: 8 }}>
                        <KSkeleton width="35%" height={28} />
                        <KSkeleton width="60%" height={13} />
                    </View>
                    {/* Search */}
                    <KSkeleton width="100%" height={44} />
                    {/* Segmented */}
                    <KSkeleton width="80%" height={36} variant="pill" />
                    {/* Lista */}
                    <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                        <KSkeletonRow />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const masterContent = (
        <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)}>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_800ExtraBold",
                            fontSize: typography.display.size,
                            lineHeight: typography.display.lineHeight,
                            letterSpacing: typography.display.letterSpacing,
                            color: colors.text.primary,
                        }}
                    >
                        Alunos
                    </Text>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: typography.bodySm.size,
                            color: colors.text.tertiary,
                            marginTop: spacing[1],
                        }}
                    >
                        {counts.all} {counts.all === 1 ? "aluno" : "alunos"}
                        {counts.attention > 0 ? ` · ${counts.attention} precisa${counts.attention === 1 ? "" : "m"} de atenção` : ""}
                    </Text>
                </Animated.View>

                {/* Search */}
                <Animated.View
                    entering={FadeInUp.delay(40).duration(280)}
                    style={{ marginTop: spacing[4] }}
                >
                    <KSearchBox
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar por nome ou email"
                        accessibilityLabel="Buscar alunos por nome ou email"
                        onClear={() => setSearch("")}
                    />
                </Animated.View>

                {/* Segmented */}
                <Animated.View
                    entering={FadeInUp.delay(70).duration(280)}
                    style={{ marginTop: spacing[3], marginBottom: spacing[3] }}
                >
                    <KSegmented<StudentFilter>
                        value={filter}
                        onChange={setFilter}
                        items={[
                            { value: "all", label: "Todos", count: counts.all },
                            { value: "attention", label: "Atenção", count: counts.attention },
                            { value: "online", label: "Online", count: counts.online },
                            { value: "presencial", label: "Presencial", count: counts.presencial },
                        ]}
                        accessibilityLabel="Filtro de alunos"
                    />
                </Animated.View>
            </View>

            {/* List */}
            <FlatList
                data={students}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                accessibilityRole="list"
                accessibilityLabel="Lista de alunos"
                contentContainerStyle={{
                    paddingHorizontal: spacing[5],
                    paddingBottom: isTablet ? 40 : 120,
                    gap: spacing[2],
                }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.purple[600]} />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon={<Users size={40} color={colors.text.quaternary} />}
                        title={search ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
                        description={search ? "Tente ajustar o termo de busca" : "Toque no + para adicionar seu primeiro aluno"}
                    />
                }
            />
        </View>
    );

    const detailContent = selectedStudentId ? (
        <React.Suspense fallback={<View style={{ flex: 1, backgroundColor: colors.surface.canvas }} />}>
            <StudentProfileScreen embedded studentIdOverride={selectedStudentId} />
        </React.Suspense>
    ) : null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
            <MasterDetailLayout
                masterContent={masterContent}
                detailContent={detailContent}
                placeholder={<StudentDetailPlaceholder />}
                masterWidthPercent={35}
            />
            {studentsLocked ? (
                /* Free no limite de alunos: CTA de assinatura (gate revalidado no backend). */
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push("/profile/subscription");
                    }}
                    accessibilityLabel="Assine para adicionar alunos"
                    accessibilityRole="button"
                    style={{
                        position: "absolute",
                        left: spacing[5],
                        right: spacing[5],
                        bottom: insets.bottom + 90,
                        height: 52,
                        borderRadius: 26,
                        overflow: "hidden",
                        shadowColor: colors.purple[600],
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.32,
                        shadowRadius: 24,
                        elevation: 12,
                    }}
                >
                    <LinearGradient
                        colors={[colors.purple[600], colors.purple[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: spacing[2],
                        }}
                    >
                        <Lock size={18} color="#FFFFFF" strokeWidth={2.5} />
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_700Bold",
                                fontSize: 15,
                                color: "#FFFFFF",
                                letterSpacing: -0.01,
                            }}
                        >
                            Assine para adicionar alunos
                        </Text>
                    </LinearGradient>
                </Pressable>
            ) : (
                /* FAB V2 — gradient roxo + glow */
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setShowAddStudent(true);
                    }}
                    accessibilityLabel="Adicionar aluno"
                    accessibilityRole="button"
                    style={{
                        position: "absolute",
                        right: spacing[5],
                        bottom: insets.bottom + 90,
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        overflow: "hidden",
                        shadowColor: colors.purple[600],
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.32,
                        shadowRadius: 24,
                        elevation: 12,
                    }}
                >
                    <LinearGradient
                        colors={[colors.purple[600], colors.purple[700]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                    >
                        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                </Pressable>
            )}
            <AddStudentModal
                visible={showAddStudent}
                onClose={() => setShowAddStudent(false)}
                onStudentCreated={refresh}
            />
        </SafeAreaView>
    );
}

function StudentRow({
    student,
    selected,
    onPress,
}: {
    student: TrainerStudent;
    selected: boolean;
    onPress: () => void;
}) {
    const colors = useV2Colors();
    const meta = getStudentMeta(student);
    const progressPct =
        student.expected_per_week > 0
            ? Math.min(1, student.sessions_this_week / student.expected_per_week)
            : 0;

    return (
        <KCard
            onPress={onPress}
            variant={selected ? "tinted" : "default"}
            accessibilityLabel={`Aluno ${student.name}, ${meta.metaLabel}`}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                <Avatar
                    name={student.name}
                    size="md"
                    src={student.avatar_url ?? undefined}
                    status={meta.avatarStatus}
                />

                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                        <Text
                            style={{
                                fontFamily: "PlusJakartaSans_700Bold",
                                fontSize: typography.title3.size,
                                color: colors.text.primary,
                                flex: 1,
                                letterSpacing: typography.title3.letterSpacing,
                            }}
                            numberOfLines={1}
                        >
                            {student.name}
                        </Text>
                        {student.is_trainer_profile ? (
                            <View
                                style={{
                                    backgroundColor: colors.purple[100],
                                    paddingHorizontal: spacing[2],
                                    paddingVertical: 2,
                                    borderRadius: radius.sm,
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: "PlusJakartaSans_700Bold",
                                        fontSize: 9,
                                        color: colors.purple[700],
                                        letterSpacing: 0.4,
                                    }}
                                >
                                    EU
                                </Text>
                            </View>
                        ) : student.is_private ? (
                            <View
                                style={{
                                    backgroundColor: colors.purple[100],
                                    paddingHorizontal: spacing[2],
                                    paddingVertical: 2,
                                    borderRadius: radius.sm,
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: "PlusJakartaSans_700Bold",
                                        fontSize: 9,
                                        color: colors.purple[700],
                                        letterSpacing: 0.4,
                                    }}
                                >
                                    PARTICULAR
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {student.program_name ? (
                        <View style={{ marginTop: 4 }}>
                            <Text
                                style={{
                                    fontFamily: "PlusJakartaSans_500Medium",
                                    fontSize: 12,
                                    color: colors.text.secondary,
                                }}
                                numberOfLines={1}
                            >
                                {student.program_name}
                            </Text>
                            <View
                                style={{
                                    height: 3,
                                    borderRadius: 2,
                                    backgroundColor: colors.border.default,
                                    marginTop: 4,
                                    overflow: "hidden",
                                }}
                            >
                                <View
                                    style={{
                                        width: `${progressPct * 100}%`,
                                        height: "100%",
                                        backgroundColor: colors.purple[500],
                                    }}
                                />
                            </View>
                        </View>
                    ) : null}

                    <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center" }}>
                        <KStatus type={meta.metaType} label={meta.metaLabel} layout="dot" size="sm" />
                    </View>
                </View>

                <ChevronRight size={16} color={colors.text.quaternary} />
            </View>
        </KCard>
    );
}

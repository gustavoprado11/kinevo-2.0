import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    ScrollView,
    RefreshControl,
    ActionSheetIOS,
    Platform,
    Alert,
} from "react-native";
import { StudentDetailSkeleton } from "../../components/shared/skeletons/StudentDetailSkeleton";
import { toast } from "../../lib/toast";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    ChevronLeft,
    Dumbbell,
    Calendar,
    Sparkles,
    User,
} from "lucide-react-native";
import { useStudentDetail } from "../../hooks/useStudentDetail";
import { useTrainingRoomStore } from "../../stores/training-room-store";
import { StudentOverviewTab } from "../../components/trainer/student/StudentOverviewTab";
import { StudentProgramsTab } from "../../components/trainer/student/StudentProgramsTab";
import { StudentFormsTab } from "../../components/trainer/student/StudentFormsTab";
import { AssignProgramWizard } from "../../components/trainer/student/AssignProgramWizard";
import { SubmissionDetailSheet } from "../../components/trainer/forms/SubmissionDetailSheet";
import { colors } from "@/theme";

type ProfileTab = "overview" | "programs" | "forms";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active: { bg: "#dcfce7", text: colors.status.active },
    inactive: { bg: "#fee2e2", text: colors.error.default },
    pending: { bg: "#fef3c7", text: "#d97706" },
};

const MODALITY_LABELS: Record<string, string> = {
    presencial: "Presencial",
    online: "Online",
};

export default function StudentProfileScreen({
    embedded,
    studentIdOverride,
}: {
    embedded?: boolean;
    studentIdOverride?: string;
} = {}) {
    const params = useLocalSearchParams<{ id: string }>();
    const id = studentIdOverride ?? params.id;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { data, isLoading, isRefreshing, refresh } = useStudentDetail(id || null);

    const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
    const [showAssignProgram, setShowAssignProgram] = useState(false);
    const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);

    // Training room store for "Start Training Room" action
    const { sessions, addStudent, setActiveStudent } = useTrainingRoomStore();

    const handleStartTrainingRoom = useCallback(async () => {
        if (!data) return;

        const student = data.student;
        const existingSession = Object.values(sessions).find(
            (s) => s.studentId === student.id
        );

        if (existingSession) {
            // Student already in session, just navigate and select
            setActiveStudent(student.id);
            router.push("/(trainer-tabs)/training-room" as any);
            return;
        }

        // Check if student has a workout today
        if (!data.activeProgram) {
            toast.info("Sem programa ativo", "Este aluno não tem um programa ativo. Atribua um programa primeiro.");
            return;
        }

        // Navigate to training room — the StudentPickerModal will handle adding
        router.push("/(trainer-tabs)/training-room" as any);
    }, [data, sessions, setActiveStudent, router]);

    const handleAssignProgram = useCallback(() => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancelar', 'Selecionar existente', 'Criar novo programa'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) setShowAssignProgram(true);
                    if (buttonIndex === 2) {
                        router.push({ pathname: '/program-builder', params: { studentId: id, mode: 'new' } } as any);
                    }
                }
            );
        } else {
            Alert.alert(
                'Atribuir programa',
                'Como deseja prosseguir?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Selecionar existente', onPress: () => setShowAssignProgram(true) },
                    { text: 'Criar novo', onPress: () => router.push({ pathname: '/program-builder', params: { studentId: id, mode: 'new' } } as any) },
                ]
            );
        }
    }, [id, router]);

    const handlePrescribe = useCallback(() => {
        if (!data) return;
        if (!data.aiEnabled) {
            toast.info("IA não habilitada", "O módulo de prescrição IA não está habilitado para sua conta. Entre em contato com o suporte.");
            return;
        }
        router.push({ pathname: "/student/[id]/prescribe", params: { id: id! } } as any);
    }, [data, id, router]);

    if (isLoading || !data) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background.primary, paddingTop: embedded ? 0 : insets.top }}>
                {!embedded && (
                    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                            <ChevronLeft size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                )}
                <StudentDetailSkeleton />
            </View>
        );
    }

    const { student } = data;
    const statusColor = STATUS_COLORS[student.status] || STATUS_COLORS.active;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
            {/* Header */}
            <View style={{ backgroundColor: colors.background.card, paddingTop: embedded ? 8 : insets.top, paddingBottom: 0 }}>
                {/* Back button — hidden in embedded mode */}
                {!embedded && (
                    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ flexDirection: "row", alignItems: "center" }}
                        >
                            <ChevronLeft size={22} color={colors.brand.primary} />
                            <Text style={{ fontSize: 16, color: colors.brand.primary, marginLeft: 2 }}>Alunos</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Student info */}
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14 }}>
                    <View
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: "#e2e8f0",
                            overflow: "hidden",
                            marginRight: 14,
                        }}
                    >
                        {student.avatar_url ? (
                            <Image source={{ uri: student.avatar_url }} style={{ width: 56, height: 56 }} />
                        ) : (
                            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                <User size={24} color={colors.text.secondary} />
                            </View>
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text.primary }}>
                            {student.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2 }}>
                            {student.email}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                            <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor.text }}>
                                    {student.status === "active" ? "Ativo" : student.status === "inactive" ? "Inativo" : "Pendente"}
                                </Text>
                            </View>
                            {student.modality && (
                                <View style={{ backgroundColor: colors.status.inactiveBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#475569" }}>
                                        {MODALITY_LABELS[student.modality] || student.modality}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Action buttons */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14, gap: 8 }}
                >
                    <ActionButton
                        icon={<Dumbbell size={14} color={colors.text.inverse} />}
                        label="Sala de Treino"
                        primary
                        onPress={handleStartTrainingRoom}
                    />
                    <ActionButton
                        icon={<Calendar size={14} color={colors.brand.primary} />}
                        label="Atribuir Programa"
                        onPress={handleAssignProgram}
                    />
                    {data.aiEnabled && (
                        <ActionButton
                            icon={<Sparkles size={14} color={colors.brand.primary} />}
                            label="Prescrever IA"
                            onPress={handlePrescribe}
                        />
                    )}
                </ScrollView>

                {/* Tab bar */}
                <View style={{ flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "rgba(0,0,0,0.06)" }}>
                    {(["overview", "programs", "forms"] as ProfileTab[]).map((tab) => {
                        const isActive = activeTab === tab;
                        const labels: Record<ProfileTab, string> = {
                            overview: "Visão Geral",
                            programs: "Programas",
                            forms: "Formulários",
                        };
                        return (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={labels[tab]}
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    alignItems: "center",
                                    borderBottomWidth: 2,
                                    borderBottomColor: isActive ? colors.brand.primary : "transparent",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: isActive ? colors.brand.primary : colors.text.tertiary,
                                    }}
                                >
                                    {labels[tab]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Tab content */}
            <View style={{ flex: 1 }}>
                {activeTab === "overview" && <StudentOverviewTab data={data} />}
                {activeTab === "programs" && <StudentProgramsTab data={data} />}
                {activeTab === "forms" && (
                    <StudentFormsTab
                        data={data}
                        onSubmissionPress={(subId) => setDetailSubmissionId(subId)}
                    />
                )}
            </View>

            {/* Assign Program Wizard */}
            <AssignProgramWizard
                visible={showAssignProgram}
                studentId={id!}
                studentName={student.name}
                hasActiveProgram={!!data.activeProgram}
                onClose={() => setShowAssignProgram(false)}
                onSuccess={() => {
                    setShowAssignProgram(false);
                    refresh();
                }}
            />

            {/* Submission Detail */}
            <SubmissionDetailSheet
                visible={!!detailSubmissionId}
                submissionId={detailSubmissionId}
                onClose={() => setDetailSubmissionId(null)}
                onFeedbackSent={() => refresh()}
            />
        </View>
    );
}

function ActionButton({
    icon,
    label,
    primary,
    onPress,
}: {
    icon: React.ReactNode;
    label: string;
    primary?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: primary ? colors.brand.primary : "#f3f0ff",
                gap: 6,
            }}
        >
            {icon}
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: primary ? colors.text.inverse : colors.brand.primary,
                }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

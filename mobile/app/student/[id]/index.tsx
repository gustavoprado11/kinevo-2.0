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
import { StudentDetailSkeleton } from "../../../components/shared/skeletons/StudentDetailSkeleton";
import { toast } from "../../../lib/toast";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
    ChevronLeft,
    Dumbbell,
    Calendar,
    MessageCircle,
    MoreVertical,
    User,
} from "lucide-react-native";
import { useStudentDetail } from "../../../hooks/useStudentDetail";
import { useTrainingRoomStore } from "../../../stores/training-room-store";
import { StudentOverviewTab } from "../../../components/trainer/student/StudentOverviewTab";
import { StudentProgramsTab } from "../../../components/trainer/student/StudentProgramsTab";
import { StudentFormsTab } from "../../../components/trainer/student/StudentFormsTab";
import { ResetPasswordModal } from "../../../components/trainer/student/ResetPasswordModal";
import { EditStudentModal } from "../../../components/trainer/student/EditStudentModal";
import { SubmissionDetailSheet } from "../../../components/trainer/forms/SubmissionDetailSheet";
import { useArchiveStudent } from "../../../hooks/useArchiveStudent";
import { colors } from "@/theme";
import type { Student, StudentModality } from "../../../types/student";

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
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);

    const { archiveStudent, isArchiving } = useArchiveStudent();

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

    /**
     * Single entry point — replaces "Atribuir Programa" / "Prescrever IA" /
     * "Prescrever por Texto". The program builder is the hub; the choice of
     * "novo programa" / "IA" / "texto" / "selecionar existente" lives inside
     * the builder via the IA menu.
     */
    const handleOpenBuilder = useCallback(() => {
        router.push({ pathname: '/program-builder', params: { studentId: id } } as any);
    }, [id, router]);

    const handleEditStudent = useCallback(() => {
        if (!data) return;
        Haptics.selectionAsync();
        Alert.alert(
            `Editar ${data.student.name}?`,
            "Você poderá alterar nome, email, telefone e modalidade.",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Editar", onPress: () => setShowEditModal(true) },
            ]
        );
    }, [data]);

    const handleArchiveStudent = useCallback(() => {
        if (!data) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            `Arquivar ${data.student.name}?`,
            "O aluno sairá da sua lista e não poderá acessar mais treinos. Você pode restaurar depois em Configurações.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Arquivar",
                    style: "destructive",
                    onPress: async () => {
                        const result = await archiveStudent(data.student.id);
                        if (result.success) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            toast.success("Aluno arquivado");
                            router.back();
                        } else {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert("Erro", result.error);
                        }
                    },
                },
            ]
        );
    }, [data, archiveStudent, router]);

    const handleOpenStudentMenu = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancelar', 'Editar aluno', 'Gerar nova senha', 'Arquivar'],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: 3,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) handleEditStudent();
                    else if (buttonIndex === 2) setShowResetPassword(true);
                    else if (buttonIndex === 3) handleArchiveStudent();
                }
            );
        } else {
            Alert.alert(
                'Ações do aluno',
                undefined,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Editar aluno', onPress: handleEditStudent },
                    { text: 'Gerar nova senha', onPress: () => setShowResetPassword(true) },
                    { text: 'Arquivar', style: 'destructive', onPress: handleArchiveStudent },
                ]
            );
        }
    }, [handleEditStudent, handleArchiveStudent]);

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
                    {!student.is_trainer_profile && (
                        <TouchableOpacity
                            onPress={handleOpenStudentMenu}
                            accessibilityRole="button"
                            accessibilityLabel="Mais ações"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: "center",
                                justifyContent: "center",
                                marginLeft: 8,
                            }}
                        >
                            <MoreVertical size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                    )}
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
                        label="Prescrever"
                        onPress={handleOpenBuilder}
                    />
                    <ActionButton
                        icon={<MessageCircle size={14} color={colors.brand.primary} />}
                        label="Conversar"
                        onPress={() => router.push({ pathname: "/messages/[studentId]" as any, params: { studentId: id } })}
                    />
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

            {/* AssignProgramWizard and TextPrescriptionSheet now live inside
                the program builder (Fase 3 unification). */}

            {/* Submission Detail */}
            <SubmissionDetailSheet
                visible={!!detailSubmissionId}
                submissionId={detailSubmissionId}
                onClose={() => setDetailSubmissionId(null)}
                onFeedbackSent={() => refresh()}
            />

            {/* Reset Password Modal */}
            <ResetPasswordModal
                visible={showResetPassword}
                studentId={id!}
                studentName={student.name}
                studentEmail={student.email}
                studentPhone={student.phone}
                onClose={() => setShowResetPassword(false)}
            />

            {/* Edit Student Modal */}
            <EditStudentModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSuccess={(updated: Student) => {
                    setShowEditModal(false);
                    toast.success("Aluno atualizado");
                    refresh();
                }}
                student={{
                    id: student.id,
                    name: student.name,
                    email: student.email,
                    phone: student.phone,
                    modality: (student.modality as StudentModality | null) ?? null,
                }}
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

import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    ScrollView,
    RefreshControl,
    Alert,
} from "react-native";
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

type ProfileTab = "overview" | "programs" | "forms";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active: { bg: "#dcfce7", text: "#16a34a" },
    inactive: { bg: "#fee2e2", text: "#ef4444" },
    pending: { bg: "#fef3c7", text: "#d97706" },
};

const MODALITY_LABELS: Record<string, string> = {
    presencial: "Presencial",
    online: "Online",
};

export default function StudentProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
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
            Alert.alert(
                "Sem programa ativo",
                "Este aluno não tem um programa ativo. Atribua um programa primeiro.",
                [{ text: "OK" }]
            );
            return;
        }

        // Navigate to training room — the StudentPickerModal will handle adding
        router.push("/(trainer-tabs)/training-room" as any);
    }, [data, sessions, setActiveStudent, router]);

    const handlePrescribe = useCallback(() => {
        if (!data) return;
        if (!data.aiEnabled) {
            Alert.alert(
                "IA não habilitada",
                "O módulo de prescrição IA não está habilitado para sua conta. Entre em contato com o suporte.",
                [{ text: "OK" }]
            );
            return;
        }
        router.push({ pathname: "/student/[id]/prescribe", params: { id: id! } } as any);
    }, [data, id, router]);

    if (isLoading || !data) {
        return (
            <View style={{ flex: 1, backgroundColor: "#F2F2F7", paddingTop: insets.top }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                        <ChevronLeft size={24} color="#1a1a2e" />
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                </View>
            </View>
        );
    }

    const { student } = data;
    const statusColor = STATUS_COLORS[student.status] || STATUS_COLORS.active;

    return (
        <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
            {/* Header */}
            <View style={{ backgroundColor: "#ffffff", paddingTop: insets.top, paddingBottom: 0 }}>
                {/* Back button */}
                <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{ flexDirection: "row", alignItems: "center" }}
                    >
                        <ChevronLeft size={22} color="#7c3aed" />
                        <Text style={{ fontSize: 16, color: "#7c3aed", marginLeft: 2 }}>Alunos</Text>
                    </TouchableOpacity>
                </View>

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
                                <User size={24} color="#64748b" />
                            </View>
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: "#1a1a2e" }}>
                            {student.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                            {student.email}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                            <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor.text }}>
                                    {student.status === "active" ? "Ativo" : student.status === "inactive" ? "Inativo" : "Pendente"}
                                </Text>
                            </View>
                            {student.modality && (
                                <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
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
                        icon={<Dumbbell size={14} color="#ffffff" />}
                        label="Sala de Treino"
                        primary
                        onPress={handleStartTrainingRoom}
                    />
                    <ActionButton
                        icon={<Calendar size={14} color="#7c3aed" />}
                        label="Atribuir Programa"
                        onPress={() => setShowAssignProgram(true)}
                    />
                    {data.aiEnabled && (
                        <ActionButton
                            icon={<Sparkles size={14} color="#7c3aed" />}
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
                                style={{
                                    flex: 1,
                                    paddingVertical: 12,
                                    alignItems: "center",
                                    borderBottomWidth: 2,
                                    borderBottomColor: isActive ? "#7c3aed" : "transparent",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: isActive ? "#7c3aed" : "#94a3b8",
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
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: primary ? "#7c3aed" : "#f3f0ff",
                gap: 6,
            }}
        >
            {icon}
            <Text
                style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: primary ? "#ffffff" : "#7c3aed",
                }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

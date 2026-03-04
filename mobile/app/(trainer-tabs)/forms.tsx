import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipboardList, FileText } from "lucide-react-native";
import { useTrainerFormTemplates, FormTemplate } from "../../hooks/useTrainerFormTemplates";
import {
    useTrainerFormSubmissions,
    FormSubmission,
    SubmissionFilter,
} from "../../hooks/useTrainerFormSubmissions";
import { FormTemplateCard } from "../../components/trainer/forms/FormTemplateCard";
import { SubmissionCard } from "../../components/trainer/forms/SubmissionCard";
import { AssignFormModal } from "../../components/trainer/forms/AssignFormModal";
import { SubmissionDetailSheet } from "../../components/trainer/forms/SubmissionDetailSheet";

type Tab = "responses" | "templates";

const FILTER_CHIPS: { key: SubmissionFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendentes" },
    { key: "completed", label: "Concluídas" },
];

export default function FormsScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<Tab>("responses");

    // Data
    const templates = useTrainerFormTemplates();
    const submissions = useTrainerFormSubmissions();

    // Modals
    const [assignTemplate, setAssignTemplate] = useState<FormTemplate | null>(null);
    const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);

    const handleAssign = useCallback((t: FormTemplate) => setAssignTemplate(t), []);
    const handleSubmissionPress = useCallback((s: FormSubmission) => setDetailSubmissionId(s.id), []);

    const handleRefresh = useCallback(() => {
        if (activeTab === "responses") submissions.refresh();
        else templates.refresh();
    }, [activeTab, submissions, templates]);

    const isRefreshing = activeTab === "responses" ? submissions.isRefreshing : templates.isRefreshing;
    const isLoading = activeTab === "responses" ? submissions.isLoading : templates.isLoading;

    return (
        <View style={{ flex: 1, backgroundColor: "#F2F2F7", paddingTop: insets.top }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#1a1a2e" }}>
                    Formulários
                </Text>
            </View>

            {/* Tab switch */}
            <View
                style={{
                    flexDirection: "row",
                    marginHorizontal: 20,
                    marginBottom: 12,
                    backgroundColor: "#e2e8f0",
                    borderRadius: 10,
                    padding: 3,
                }}
            >
                <TouchableOpacity
                    onPress={() => setActiveTab("responses")}
                    style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: activeTab === "responses" ? "#ffffff" : "transparent",
                        alignItems: "center",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: activeTab === "responses" ? "#1a1a2e" : "#64748b",
                        }}
                    >
                        Respostas{submissions.counts.pending > 0 ? ` (${submissions.counts.pending})` : ""}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab("templates")}
                    style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: activeTab === "templates" ? "#ffffff" : "transparent",
                        alignItems: "center",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: activeTab === "templates" ? "#1a1a2e" : "#64748b",
                        }}
                    >
                        Templates
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Filter chips (responses only) */}
            {activeTab === "responses" && (
                <View style={{ flexDirection: "row", paddingHorizontal: 20, marginBottom: 10, gap: 8 }}>
                    {FILTER_CHIPS.map((chip) => {
                        const isActive = submissions.filter === chip.key;
                        const count = submissions.counts[chip.key];
                        return (
                            <TouchableOpacity
                                key={chip.key}
                                onPress={() => submissions.setFilter(chip.key)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 20,
                                    backgroundColor: isActive ? "#7c3aed" : "#ffffff",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: isActive ? "#ffffff" : "#64748b",
                                    }}
                                >
                                    {chip.label} {count > 0 ? `(${count})` : ""}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Content */}
            {isLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                </View>
            ) : activeTab === "responses" ? (
                <FlatList
                    data={submissions.submissions}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor="#7c3aed"
                        />
                    }
                    renderItem={({ item }) => (
                        <SubmissionCard submission={item} onPress={handleSubmissionPress} />
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", marginTop: 60 }}>
                            <ClipboardList size={48} color="#d1d5db" />
                            <Text style={{ fontSize: 16, fontWeight: "600", color: "#94a3b8", marginTop: 16 }}>
                                Nenhuma resposta
                            </Text>
                            <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>
                                Envie formulários para seus alunos{"\n"}para ver as respostas aqui
                            </Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={templates.templates}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor="#7c3aed"
                        />
                    }
                    renderItem={({ item }) => (
                        <FormTemplateCard template={item} onAssign={handleAssign} />
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", marginTop: 60 }}>
                            <FileText size={48} color="#d1d5db" />
                            <Text style={{ fontSize: 16, fontWeight: "600", color: "#94a3b8", marginTop: 16 }}>
                                Nenhum template
                            </Text>
                            <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>
                                Crie templates de formulário{"\n"}pelo site para usá-los aqui
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Modals */}
            <AssignFormModal
                visible={!!assignTemplate}
                template={assignTemplate}
                onClose={() => setAssignTemplate(null)}
                onSuccess={() => {
                    submissions.refresh();
                    templates.refresh();
                }}
            />

            <SubmissionDetailSheet
                visible={!!detailSubmissionId}
                submissionId={detailSubmissionId}
                onClose={() => setDetailSubmissionId(null)}
                onFeedbackSent={() => submissions.refresh()}
            />
        </View>
    );
}

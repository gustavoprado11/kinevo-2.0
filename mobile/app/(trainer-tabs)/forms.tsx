import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from "react-native";
import { FormsSkeleton } from "../../components/shared/skeletons/FormsSkeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipboardList, FileText, Plus } from "lucide-react-native";
import { EmptyState } from "../../components/shared/EmptyState";
import { useTrainerFormTemplates, FormTemplate } from "../../hooks/useTrainerFormTemplates";
import {
    useTrainerFormSubmissions,
    FormSubmission,
    SubmissionFilter,
} from "../../hooks/useTrainerFormSubmissions";
import { useFormTemplateCrud } from "../../hooks/useFormTemplateCrud";
import { FormTemplateCard } from "../../components/trainer/forms/FormTemplateCard";
import { SubmissionCard } from "../../components/trainer/forms/SubmissionCard";
import { AssignFormModal } from "../../components/trainer/forms/AssignFormModal";
import { SubmissionDetailSheet } from "../../components/trainer/forms/SubmissionDetailSheet";
import { FormBuilderModal, type EditingTemplate } from "../../components/trainer/forms/FormBuilderModal";
import { colors } from "@/theme";
import { useResponsive } from "../../hooks/useResponsive";
import { toast } from "../../lib/toast";
import * as Haptics from "expo-haptics";

type Tab = "responses" | "templates";

const FILTER_CHIPS: { key: SubmissionFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendentes" },
    { key: "completed", label: "Concluídas" },
];

export default function FormsScreen() {
    const insets = useSafeAreaInsets();
    const { isTablet } = useResponsive();
    const [activeTab, setActiveTab] = useState<Tab>("responses");

    // Data
    const templates = useTrainerFormTemplates();
    const submissions = useTrainerFormSubmissions();

    // CRUD
    const crud = useFormTemplateCrud(() => {
        templates.refresh();
    });

    // Modals
    const [assignTemplate, setAssignTemplate] = useState<FormTemplate | null>(null);
    const [detailSubmissionId, setDetailSubmissionId] = useState<string | null>(null);
    const [builderVisible, setBuilderVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);

    const handleAssign = useCallback((t: FormTemplate) => setAssignTemplate(t), []);
    const handleSubmissionPress = useCallback((s: FormSubmission) => setDetailSubmissionId(s.id), []);

    const handleRefresh = useCallback(() => {
        if (activeTab === "responses") submissions.refresh();
        else templates.refresh();
    }, [activeTab, submissions, templates]);

    const isRefreshing = activeTab === "responses" ? submissions.isRefreshing : templates.isRefreshing;
    const isLoading = activeTab === "responses" ? submissions.isLoading : templates.isLoading;

    // Builder handlers
    const handleCreateNew = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setEditingTemplate(null);
        setBuilderVisible(true);
    }, []);

    const handleEdit = useCallback(
        async (t: FormTemplate) => {
            try {
                const full = await crud.fetchTemplateSchema(t.id);
                setEditingTemplate(full);
                setBuilderVisible(true);
            } catch {
                toast.error("Erro ao carregar template");
            }
        },
        [crud],
    );

    const handleDelete = useCallback(
        (t: FormTemplate) => {
            Alert.alert("Excluir template", `Deseja excluir "${t.title}"? Esta ação não pode ser desfeita.`, [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await crud.deleteTemplate(t.id);
                            toast.success("Template excluído");
                        } catch {
                            toast.error("Erro ao excluir template");
                        }
                    },
                },
            ]);
        },
        [crud],
    );

    const handleSaveBuilder = useCallback(
        async (data: Parameters<typeof crud.createTemplate>[0] & { templateId?: string }) => {
            try {
                if (data.templateId) {
                    await crud.updateTemplate({ ...data, templateId: data.templateId });
                    toast.success("Template atualizado");
                } else {
                    await crud.createTemplate(data);
                    toast.success("Template criado");
                }
                setBuilderVisible(false);
                setEditingTemplate(null);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Erro ao salvar";
                toast.error(message);
            }
        },
        [crud],
    );

    const handleCloseBuilder = useCallback(() => {
        setBuilderVisible(false);
        setEditingTemplate(null);
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary, paddingTop: insets.top }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text.primary }}>
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
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === "responses" }}
                    accessibilityLabel="Respostas"
                    style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: activeTab === "responses" ? colors.background.card : "transparent",
                        alignItems: "center",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: activeTab === "responses" ? colors.text.primary : colors.text.secondary,
                        }}
                    >
                        Respostas{submissions.counts.pending > 0 ? ` (${submissions.counts.pending})` : ""}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab("templates")}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activeTab === "templates" }}
                    accessibilityLabel="Templates"
                    style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: activeTab === "templates" ? colors.background.card : "transparent",
                        alignItems: "center",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: activeTab === "templates" ? colors.text.primary : colors.text.secondary,
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
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={`Filtro ${chip.label}`}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 20,
                                    backgroundColor: isActive ? colors.brand.primary : colors.background.card,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: isActive ? colors.text.inverse : colors.text.secondary,
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
                <FormsSkeleton />
            ) : activeTab === "responses" ? (
                <FlatList
                    key={isTablet ? "submissions-2col" : "submissions-1col"}
                    data={submissions.submissions}
                    keyExtractor={(item) => item.id}
                    numColumns={isTablet ? 2 : 1}
                    columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: isTablet ? 40 : insets.bottom + 80,
                        gap: 10,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.brand.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={isTablet ? { flex: 1 } : undefined}>
                            <SubmissionCard submission={item} onPress={handleSubmissionPress} />
                        </View>
                    )}
                    ListEmptyComponent={
                        <EmptyState
                            icon={<ClipboardList size={40} color={colors.text.quaternary} />}
                            title="Nenhuma resposta recebida"
                            description="Envie formulários para seus alunos para ver as respostas aqui"
                        />
                    }
                />
            ) : (
                <FlatList
                    key={isTablet ? "templates-2col" : "templates-1col"}
                    data={templates.templates}
                    keyExtractor={(item) => item.id}
                    numColumns={isTablet ? 2 : 1}
                    columnWrapperStyle={isTablet ? { gap: 10 } : undefined}
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: isTablet ? 40 : insets.bottom + 100,
                        gap: 10,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.brand.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <View style={isTablet ? { flex: 1 } : undefined}>
                            <FormTemplateCard
                                template={item}
                                onAssign={handleAssign}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </View>
                    )}
                    ListEmptyComponent={
                        <EmptyState
                            icon={<FileText size={40} color={colors.text.quaternary} />}
                            title="Nenhum template"
                            description="Toque no + para criar seu primeiro template de formulário"
                        />
                    }
                />
            )}

            {/* FAB — templates tab only */}
            {activeTab === "templates" && (
                <TouchableOpacity
                    onPress={handleCreateNew}
                    activeOpacity={0.8}
                    accessibilityLabel="Criar novo template"
                    accessibilityRole="button"
                    style={{
                        position: "absolute",
                        right: 20,
                        bottom: insets.bottom + 66,
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "#7c3aed",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#7c3aed",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.35,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                >
                    <Plus size={26} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
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

            <FormBuilderModal
                visible={builderVisible}
                template={editingTemplate}
                onClose={handleCloseBuilder}
                onSave={handleSaveBuilder}
                isSaving={crud.isSaving}
            />
        </View>
    );
}

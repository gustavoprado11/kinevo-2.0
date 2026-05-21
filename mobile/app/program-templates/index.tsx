import React, { useCallback, useMemo, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Search, Plus, ChevronLeft, LayoutTemplate } from "lucide-react-native";
import Animated, { FadeInUp, Easing, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProgramTemplateLibraryCard } from "@/components/trainer/program-templates/ProgramTemplateLibraryCard";
import { openProgramTemplateActionsMenu } from "@/components/trainer/program-templates/ProgramTemplateActionsMenu";
import { AssignTemplateToStudentSheet } from "@/components/trainer/program-templates/AssignTemplateToStudentSheet";
import { useTrainerProgramTemplates, type ProgramTemplate } from "@/hooks/useTrainerProgramTemplates";
import { useProgramTemplateActions } from "@/hooks/useProgramTemplateActions";
import { useV2Colors } from "@/hooks/useV2Colors";
import { toast } from "@/lib/toast";

export default function ProgramTemplatesScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    const { templates, isLoading, refetch } = useTrainerProgramTemplates();
    const { deleteTemplate, duplicateTemplate } = useProgramTemplateActions();
    const [search, setSearch] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [assignTarget, setAssignTarget] = useState<ProgramTemplate | null>(null);

    // Refetch on focus so edits / duplicates / deletes reflect when returning
    // from the builder or after an action.
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch]),
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return templates;
        return templates.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                (t.description?.toLowerCase().includes(q) ?? false),
        );
    }, [templates, search]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const handleCreate = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // No studentId → builder saves as a reusable template (is_template = true).
        router.push("/program-builder");
    };

    const handleOpenTemplate = (templateId: string) => {
        router.push({ pathname: "/program-templates/[id]", params: { id: templateId } });
    };

    const handleDuplicate = async (template: ProgramTemplate) => {
        try {
            await duplicateTemplate(template.id);
            await refetch();
            toast.success("Modelo duplicado!", `"${template.name}" foi copiado.`);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao duplicar.";
            toast.error("Erro", message);
        }
    };

    const handleDelete = (template: ProgramTemplate) => {
        Alert.alert(
            "Excluir modelo",
            `Deseja excluir "${template.name}"? Esta ação não pode ser desfeita. Programas já atribuídos a alunos não serão afetados.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTemplate(template.id);
                            await refetch();
                            toast.success("Modelo excluído!");
                        } catch (err) {
                            const message = err instanceof Error ? err.message : "Falha ao excluir.";
                            toast.error("Erro", message);
                        }
                    },
                },
            ],
        );
    };

    const handleOpenActions = (template: ProgramTemplate) => {
        openProgramTemplateActionsMenu({
            templateName: template.name,
            onChoose: (choice) => {
                if (choice === "edit") handleOpenTemplate(template.id);
                else if (choice === "assign") setAssignTarget(template);
                else if (choice === "duplicate") handleDuplicate(template);
                else if (choice === "delete") handleDelete(template);
            },
        });
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingTop: 8,
                        paddingBottom: 4,
                        gap: 8,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                        hitSlop={8}
                        style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
                    >
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 20, fontWeight: "700", color: colors.text.primary }}>
                        Modelos
                    </Text>
                </View>

                {/* Search */}
                <Animated.View
                    entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
                    style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: colors.surface.card,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            gap: 10,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.05)",
                        }}
                    >
                        <Search size={18} color={colors.text.tertiary} />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar modelo..."
                            placeholderTextColor="#94a3b8"
                            style={{ flex: 1, fontSize: 14, color: colors.text.primary }}
                            accessibilityLabel="Buscar modelo"
                        />
                    </View>
                </Animated.View>

                {/* List */}
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.purple[600]} />
                    </View>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={<LayoutTemplate size={40} color={colors.text.tertiary} />}
                        title={search ? "Nenhum modelo encontrado" : "Nenhum modelo salvo"}
                        description={
                            search
                                ? "Tente outro termo de busca."
                                : "Crie um modelo reutilizável para atribuir rapidamente aos seus alunos."
                        }
                        actionLabel={search ? undefined : "Novo modelo"}
                        onAction={search ? undefined : handleCreate}
                    />
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                        renderItem={({ item }) => (
                            <ProgramTemplateLibraryCard
                                template={item}
                                onPress={() => handleOpenTemplate(item.id)}
                                onPressActions={() => handleOpenActions(item)}
                            />
                        )}
                        onRefresh={handleRefresh}
                        refreshing={refreshing}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* FAB */}
                <Animated.View
                    entering={FadeIn.delay(400).duration(300)}
                    style={{ position: "absolute", bottom: 32, right: 20 }}
                >
                    <TouchableOpacity
                        onPress={handleCreate}
                        activeOpacity={0.8}
                        accessibilityLabel="Criar novo modelo"
                        accessibilityRole="button"
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: colors.purple[600],
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: "#7c3aed",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>

            <AssignTemplateToStudentSheet
                visible={!!assignTarget}
                templateId={assignTarget?.id ?? null}
                templateName={assignTarget?.name ?? ""}
                workoutCount={assignTarget?.workout_count ?? 0}
                durationWeeks={assignTarget?.duration_weeks ?? null}
                onClose={() => setAssignTarget(null)}
                onSuccess={() => setAssignTarget(null)}
            />
        </>
    );
}

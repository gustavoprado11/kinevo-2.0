import React, { useEffect } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useLoadTemplate } from "@/hooks/useLoadTemplate";
import { useProgramBuilderStore } from "@/stores/program-builder-store";

/**
 * Edit-existing-template entry route. Loads the program template (with
 * workouts, items, per-set rows), hydrates the Program Builder store via
 * `initFromTemplate`, then forwards to the builder with `mode=edit-template`
 * so the UI renders the edit affordances and the save calls
 * `saveTemplateFull`. Mirrors `program-builder/edit/[assignedProgramId].tsx`.
 */
export default function EditTemplateRoute() {
    const colors = useV2Colors();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data, loading, error } = useLoadTemplate(id ?? null);
    const initFromTemplate = useProgramBuilderStore((s) => s.initFromTemplate);

    useEffect(() => {
        if (!data) return;
        initFromTemplate({
            id: data.id,
            name: data.name,
            description: data.description,
            duration_weeks: data.duration_weeks,
            workout_templates: data.workout_templates,
        });
        router.replace({
            pathname: "/program-builder",
            params: { mode: "edit-template" },
        });
    }, [data, initFromTemplate, router]);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.canvas }}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={colors.purple[600]} />
                <Text style={{ marginTop: 12, fontSize: 14, color: colors.text.secondary }}>
                    Carregando modelo…
                </Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.surface.canvas }}>
                <Stack.Screen options={{ headerShown: false }} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary, textAlign: "center" }}>
                    Não foi possível carregar o modelo
                </Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: colors.text.secondary, textAlign: "center" }}>
                    {error}
                </Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ marginTop: 16, flexDirection: "row", alignItems: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                >
                    <ChevronLeft size={18} color={colors.purple[600]} />
                    <Text style={{ fontSize: 14, color: colors.purple[600] }}>Voltar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return null;
}

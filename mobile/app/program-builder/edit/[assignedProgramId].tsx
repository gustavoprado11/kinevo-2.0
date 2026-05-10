import React, { useEffect } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useLoadAssignedProgram } from "@/hooks/useLoadAssignedProgram";
import { useProgramBuilderStore } from "@/stores/program-builder-store";

/**
 * Edit-existing-assigned-program entry route. Loads the assigned program
 * (with workouts, items, per-set rows), hydrates the Program Builder store
 * via `initFromAssignedProgram`, then forwards to the builder screen with
 * `mode=edit` so the UI knows to render the edit affordances and call
 * `saveAssignedProgramMetadata` instead of the create/assign flow.
 *
 * Round 1 (current): the builder is a read-only viewer with metadata-only
 * save (name/description/duration_weeks). Round 2 will unlock workouts/items.
 */
export default function EditAssignedProgramRoute() {
    const colors = useV2Colors();
    const router = useRouter();
    const { assignedProgramId } = useLocalSearchParams<{ assignedProgramId: string }>();
    const { data, loading, error } = useLoadAssignedProgram(assignedProgramId ?? null);
    const initFromAssignedProgram = useProgramBuilderStore((s) => s.initFromAssignedProgram);

    useEffect(() => {
        if (!data) return;
        initFromAssignedProgram(data.student_id, {
            id: data.id,
            name: data.name,
            description: data.description,
            duration_weeks: data.duration_weeks,
            assigned_workouts: data.assigned_workouts,
        });
        router.replace({
            pathname: "/program-builder",
            params: { studentId: data.student_id, mode: "edit" },
        });
    }, [data, initFromAssignedProgram, router]);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface.canvas }}>
                <ActivityIndicator size="large" color={colors.purple[600]} />
                <Text style={{ marginTop: 12, fontSize: 14, color: colors.text.secondary }}>
                    Carregando programa…
                </Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.surface.canvas }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text.primary, textAlign: "center" }}>
                    Não foi possível carregar o programa
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

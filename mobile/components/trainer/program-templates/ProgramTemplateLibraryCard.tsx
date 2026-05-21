import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Calendar, Dumbbell, Users, MoreVertical } from "lucide-react-native";
import { useV2Colors } from "@/hooks/useV2Colors";
import { PressableScale } from "@/components/shared/PressableScale";
import type { ProgramTemplate } from "@/hooks/useTrainerProgramTemplates";

interface Props {
    template: ProgramTemplate;
    onPress: () => void;
    /**
     * Opens the actions menu (Editar / Duplicar / Atribuir / Excluir). Wired in
     * Fase 2 — when omitted (Fase 1) the 3-dot button is hidden.
     */
    onPressActions?: () => void;
}

/**
 * List card for the Program Template Library (distinct from the selection-style
 * `ProgramTemplateCard` used inside AssignProgramWizard). Shows the template's
 * name, description and metrics (duration, workout count, usage count).
 */
export function ProgramTemplateLibraryCard({ template, onPress, onPressActions }: Props) {
    const colors = useV2Colors();
    const usageCount = template.usage_count ?? 0;

    return (
        <PressableScale onPress={onPress} pressScale={0.98}>
            <View
                style={{
                    backgroundColor: colors.surface.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.05)",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 3,
                    elevation: 1,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                            {template.name}
                        </Text>
                        {!!template.description && (
                            <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 4 }} numberOfLines={2}>
                                {template.description}
                            </Text>
                        )}
                    </View>
                    {onPressActions && (
                        <TouchableOpacity
                            onPress={onPressActions}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Ações para ${template.name}`}
                            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                        >
                            <MoreVertical size={18} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                    {!!template.duration_weeks && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Calendar size={13} color={colors.text.tertiary} />
                            <Text style={{ fontSize: 12, color: colors.text.tertiary }}>
                                {template.duration_weeks} semanas
                            </Text>
                        </View>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Dumbbell size={13} color={colors.text.tertiary} />
                        <Text style={{ fontSize: 12, color: colors.text.tertiary }}>
                            {template.workout_count} treino(s)
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Users size={13} color={colors.text.tertiary} />
                        <Text style={{ fontSize: 12, color: colors.text.tertiary }}>
                            {usageCount > 0 ? `${usageCount} aluno(s)` : "Não usado"}
                        </Text>
                    </View>
                </View>
            </View>
        </PressableScale>
    );
}

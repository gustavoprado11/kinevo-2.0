import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Calendar, Dumbbell } from "lucide-react-native";
import type { ProgramTemplate } from "../../../hooks/useTrainerProgramTemplates";

interface Props {
    template: ProgramTemplate;
    isSelected: boolean;
    onPress: () => void;
}

export function ProgramTemplateCard({ template, isSelected, onPress }: Props) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            style={{
                backgroundColor: isSelected ? "#f3f0ff" : "#ffffff",
                borderRadius: 14,
                padding: 16,
                marginBottom: 10,
                borderWidth: isSelected ? 2 : 0,
                borderColor: isSelected ? "#7c3aed" : "transparent",
            }}
        >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1a1a2e" }}>
                {template.name}
            </Text>
            {template.description && (
                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 4 }} numberOfLines={2}>
                    {template.description}
                </Text>
            )}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                {template.duration_weeks && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Calendar size={13} color="#64748b" />
                        <Text style={{ fontSize: 12, color: "#64748b" }}>
                            {template.duration_weeks} semanas
                        </Text>
                    </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Dumbbell size={13} color="#64748b" />
                    <Text style={{ fontSize: 12, color: "#64748b" }}>
                        {template.workout_count} treino(s)
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

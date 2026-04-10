import React, { useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { FileText, Send, Trash2, Edit3 } from "lucide-react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { FormTemplate } from "../../../hooks/useTrainerFormTemplates";

const CATEGORY_LABELS: Record<string, string> = {
    anamnese: "Anamnese",
    checkin: "Check-in",
    survey: "Pesquisa",
};

interface Props {
    template: FormTemplate;
    onAssign: (template: FormTemplate) => void;
    onEdit?: (template: FormTemplate) => void;
    onDelete?: (template: FormTemplate) => void;
}

export function FormTemplateCard({ template, onAssign, onEdit, onDelete }: Props) {
    const swipeableRef = useRef<Swipeable>(null);

    const renderRightActions = () => {
        if (!onEdit && !onDelete) return null;
        return (
            <View style={{ flexDirection: "row", gap: 8, marginLeft: 8 }}>
                {onEdit && (
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            swipeableRef.current?.close();
                            onEdit(template);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Editar template"
                        accessibilityRole="button"
                        style={{
                            backgroundColor: "#3b82f6",
                            justifyContent: "center",
                            alignItems: "center",
                            width: 70,
                            borderRadius: 14,
                            marginBottom: 10,
                        }}
                    >
                        <Edit3 size={18} color="#ffffff" />
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#ffffff", marginTop: 4 }}>
                            Editar
                        </Text>
                    </TouchableOpacity>
                )}
                {onDelete && (
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            swipeableRef.current?.close();
                            onDelete(template);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Excluir template"
                        accessibilityRole="button"
                        style={{
                            backgroundColor: "#ef4444",
                            justifyContent: "center",
                            alignItems: "center",
                            width: 70,
                            borderRadius: 14,
                            marginBottom: 10,
                        }}
                    >
                        <Trash2 size={18} color="#ffffff" />
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#ffffff", marginTop: 4 }}>
                            Excluir
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const card = (
        <TouchableOpacity
            onPress={() => {
                if (onEdit) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onEdit(template);
                }
            }}
            activeOpacity={onEdit ? 0.7 : 1}
            style={{
                backgroundColor: "#ffffff",
                borderRadius: 14,
                padding: 16,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
            }}
        >
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "#f3f0ff",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                }}
            >
                <FileText size={20} color="#7c3aed" />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>{template.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                    <Text style={{ fontSize: 12, color: "#7c3aed", fontWeight: "500" }}>
                        {CATEGORY_LABELS[template.category] || template.category}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#94a3b8", marginHorizontal: 6 }}>·</Text>
                    <Text style={{ fontSize: 12, color: "#64748b" }}>
                        {template.question_count} {template.question_count === 1 ? "pergunta" : "perguntas"}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#94a3b8", marginHorizontal: 6 }}>·</Text>
                    <Text style={{ fontSize: 12, color: "#64748b" }}>
                        {template.response_count} {template.response_count === 1 ? "resposta" : "respostas"}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onAssign(template);
                }}
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#7c3aed",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                activeOpacity={0.7}
            >
                <Send size={16} color="#ffffff" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    if (!onEdit && !onDelete) return card;

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            friction={2}
            rightThreshold={40}
        >
            {card}
        </Swipeable>
    );
}

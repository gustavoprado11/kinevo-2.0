import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { FileText, Send } from "lucide-react-native";
import type { FormTemplate } from "../../../hooks/useTrainerFormTemplates";

const CATEGORY_LABELS: Record<string, string> = {
    anamnese: "Anamnese",
    checkin: "Check-in",
    survey: "Pesquisa",
};

interface Props {
    template: FormTemplate;
    onAssign: (template: FormTemplate) => void;
}

export function FormTemplateCard({ template, onAssign }: Props) {
    return (
        <View
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
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>
                    {template.title}
                </Text>
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
                onPress={() => onAssign(template)}
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
        </View>
    );
}

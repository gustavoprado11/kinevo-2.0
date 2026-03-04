import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ClipboardList, CheckCircle, Clock } from "lucide-react-native";
import type { StudentDetailData } from "../../../hooks/useStudentDetail";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "agora";
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ontem";
    if (days < 30) return `há ${days} dias`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

interface Props {
    data: StudentDetailData;
    onSubmissionPress?: (submissionId: string) => void;
}

export function StudentFormsTab({ data, onSubmissionPress }: Props) {
    if (data.formSubmissions.length === 0) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60 }}>
                <ClipboardList size={40} color="#d1d5db" />
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#94a3b8", marginTop: 12 }}>
                    Nenhum formulário
                </Text>
                <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>
                    Envie formulários na tab Formulários
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            <View style={{ backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden" }}>
                {data.formSubmissions.map((sub, idx) => {
                    const hasFeedback = !!sub.feedback_sent_at;
                    return (
                        <TouchableOpacity
                            key={sub.id}
                            onPress={() => onSubmissionPress?.(sub.id)}
                            activeOpacity={0.6}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                borderBottomWidth: idx < data.formSubmissions.length - 1 ? 0.5 : 0,
                                borderBottomColor: "rgba(0,0,0,0.06)",
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#1a1a2e" }}>
                                    {sub.template_title}
                                </Text>
                                <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                    {timeAgo(sub.submitted_at)}
                                </Text>
                            </View>
                            {hasFeedback ? (
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <CheckCircle size={14} color="#16a34a" />
                                    <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "600", marginLeft: 3 }}>
                                        Respondido
                                    </Text>
                                </View>
                            ) : (
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Clock size={14} color="#d97706" />
                                    <Text style={{ fontSize: 12, color: "#d97706", fontWeight: "600", marginLeft: 3 }}>
                                        Pendente
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </ScrollView>
    );
}

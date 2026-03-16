import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MessageSquare, CheckCircle } from "lucide-react-native";
import type { FormSubmission } from "../../../hooks/useTrainerFormSubmissions";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ontem";
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    return `${weeks}sem`;
}

interface Props {
    submission: FormSubmission;
    onPress: (submission: FormSubmission) => void;
}

export function SubmissionCard({ submission, onPress }: Props) {
    const isPending = !submission.feedback_sent_at;

    return (
        <TouchableOpacity
            onPress={() => onPress(submission)}
            activeOpacity={0.6}
            style={{
                backgroundColor: "#ffffff",
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
            }}
        >
            {/* Avatar */}
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#e2e8f0",
                    marginRight: 12,
                    overflow: "hidden",
                }}
            >
                {submission.student_avatar ? (
                    <Image
                        source={{ uri: submission.student_avatar }}
                        style={{ width: 40, height: 40 }}
                    />
                ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#64748b" }}>
                            {submission.student_name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>
                    {submission.student_name}
                </Text>
                <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }} numberOfLines={1}>
                    {submission.template_title}
                </Text>
            </View>

            {/* Status + time */}
            <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                <Text style={{ fontSize: 11, color: "#94a3b8" }}>
                    {timeAgo(submission.submitted_at)}
                </Text>
                <View style={{ marginTop: 4 }}>
                    {isPending ? (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "#fef3c7",
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 10,
                            }}
                        >
                            <MessageSquare size={11} color="#d97706" />
                            <Text style={{ fontSize: 11, color: "#d97706", fontWeight: "600", marginLeft: 3 }}>
                                Pendente
                            </Text>
                        </View>
                    ) : (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: "#dcfce7",
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 10,
                            }}
                        >
                            <CheckCircle size={11} color="#16a34a" />
                            <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "600", marginLeft: 3 }}>
                                Respondido
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

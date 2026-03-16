import React, { useState } from "react";
import * as Haptics from "expo-haptics";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { X, Send, CheckCircle, Clock } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { useTrainerFormSubmissionDetail } from "../../../hooks/useTrainerFormSubmissionDetail";
import { AnswerRenderer } from "./AnswerRenderer";

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ontem";
    if (days < 30) return `há ${days} dias`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

interface Props {
    visible: boolean;
    submissionId: string | null;
    onClose: () => void;
    onFeedbackSent: () => void;
}

export function SubmissionDetailSheet({ visible, submissionId, onClose, onFeedbackSent }: Props) {
    const insets = useSafeAreaInsets();
    const { submission, isLoading, refetch } = useTrainerFormSubmissionDetail(
        visible ? submissionId : null
    );
    const [feedbackText, setFeedbackText] = useState("");
    const [isSending, setIsSending] = useState(false);

    const handleSendFeedback = async () => {
        if (!submission || !feedbackText.trim()) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSending(true);
        try {
            const { error } = await supabase.rpc("send_submission_feedback" as any, {
                p_submission_id: submission.id,
                p_feedback: { message: feedbackText.trim() },
            });

            if (error) throw error;

            Alert.alert("Feedback enviado!", "O aluno será notificado.");
            setFeedbackText("");
            refetch();
            onFeedbackSent();
        } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao enviar feedback.");
        } finally {
            setIsSending(false);
        }
    };

    const questions = submission?.schema_snapshot_json?.questions || [];
    const answers = submission?.answers_json?.answers || {};
    const hasFeedback = !!submission?.feedback_sent_at;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1, backgroundColor: "#F2F2F7" }}
            >
                {/* Header */}
                <View
                    style={{
                        paddingTop: insets.top + 8,
                        paddingHorizontal: 20,
                        paddingBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#ffffff",
                        borderBottomWidth: 0.5,
                        borderBottomColor: "rgba(0,0,0,0.08)",
                    }}
                >
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Fechar" accessibilityRole="button">
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a2e" }}>
                        Detalhes
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator size="large" color="#7c3aed" />
                    </View>
                ) : submission ? (
                    <>
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
                        >
                            {/* Student info */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    backgroundColor: "#ffffff",
                                    borderRadius: 14,
                                    padding: 14,
                                    marginBottom: 16,
                                }}
                            >
                                <View
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: "#e2e8f0",
                                        overflow: "hidden",
                                        marginRight: 12,
                                    }}
                                >
                                    {submission.student_avatar ? (
                                        <Image
                                            source={{ uri: submission.student_avatar }}
                                            style={{ width: 44, height: 44 }}
                                        />
                                    ) : (
                                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                            <Text style={{ fontSize: 18, fontWeight: "600", color: "#64748b" }}>
                                                {submission.student_name.charAt(0)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#1a1a2e" }}>
                                        {submission.student_name}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                                        {submission.template_title}
                                    </Text>
                                </View>
                                <View style={{ alignItems: "flex-end" }}>
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
                                    <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                                        {timeAgo(submission.submitted_at)}
                                    </Text>
                                </View>
                            </View>

                            {/* Answers */}
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: "600",
                                    color: "#64748b",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    marginBottom: 12,
                                }}
                            >
                                Respostas
                            </Text>

                            <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                                {questions.map((q) => (
                                    <AnswerRenderer key={q.id} question={q} answer={answers[q.id]} />
                                ))}
                                {questions.length === 0 && (
                                    <Text style={{ fontSize: 14, color: "#94a3b8", textAlign: "center" }}>
                                        Nenhuma resposta
                                    </Text>
                                )}
                            </View>

                            {/* Existing feedback */}
                            {hasFeedback && submission.trainer_feedback && (
                                <>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "600",
                                            color: "#64748b",
                                            textTransform: "uppercase",
                                            letterSpacing: 1,
                                            marginBottom: 12,
                                        }}
                                    >
                                        Seu Feedback
                                    </Text>
                                    <View
                                        style={{
                                            backgroundColor: "#f0fdf4",
                                            borderRadius: 14,
                                            padding: 16,
                                            borderLeftWidth: 3,
                                            borderLeftColor: "#16a34a",
                                        }}
                                    >
                                        <Text style={{ fontSize: 14, color: "#1a1a2e", lineHeight: 20 }}>
                                            {submission.trainer_feedback.message ||
                                                submission.trainer_feedback.text ||
                                                "Feedback enviado"}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                                            Enviado {timeAgo(submission.feedback_sent_at!)}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        {/* Feedback input (only if no feedback yet) */}
                        {!hasFeedback && (
                            <View
                                style={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 12,
                                    paddingBottom: insets.bottom + 12,
                                    backgroundColor: "#ffffff",
                                    borderTopWidth: 0.5,
                                    borderTopColor: "rgba(0,0,0,0.08)",
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                                    <TextInput
                                        placeholder="Escreva seu feedback..."
                                        value={feedbackText}
                                        onChangeText={setFeedbackText}
                                        multiline
                                        style={{
                                            flex: 1,
                                            backgroundColor: "#f1f5f9",
                                            borderRadius: 14,
                                            paddingHorizontal: 14,
                                            paddingVertical: 12,
                                            fontSize: 14,
                                            color: "#1a1a2e",
                                            maxHeight: 100,
                                        }}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    <TouchableOpacity
                                        onPress={handleSendFeedback}
                                        disabled={!feedbackText.trim() || isSending}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 22,
                                            backgroundColor:
                                                feedbackText.trim() ? "#7c3aed" : "#d1d5db",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {isSending ? (
                                            <ActivityIndicator color="#ffffff" size="small" />
                                        ) : (
                                            <Send size={18} color="#ffffff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 15, color: "#94a3b8" }}>
                            Submissão não encontrada
                        </Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

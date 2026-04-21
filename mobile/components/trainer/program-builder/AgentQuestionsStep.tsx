import React from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Check, ChevronRight, SkipForward } from "lucide-react-native";
import type { PrescriptionAgentQuestion } from "@kinevo/shared/types/prescription";
import { colors } from "@/theme";

interface Props {
    questions: PrescriptionAgentQuestion[];
    answers: Record<string, string>;
    onAnswer: (questionId: string, value: string) => void;
    onSubmit: () => void;
    onSkip: () => void;
    isLoading: boolean;
}

const MULTI_SEPARATOR = "||";

function parseMulti(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(MULTI_SEPARATOR).filter((v) => v.length > 0);
}

function joinMulti(values: string[]): string {
    return values.join(MULTI_SEPARATOR);
}

export function AgentQuestionsStep({
    questions,
    answers,
    onAnswer,
    onSubmit,
    onSkip,
    isLoading,
}: Props) {
    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text
                    style={{
                        fontSize: 13,
                        color: colors.text.secondary,
                        marginBottom: 16,
                        lineHeight: 20,
                    }}
                >
                    A IA gerou {questions.length}{" "}
                    {questions.length === 1 ? "pergunta" : "perguntas"} para entender melhor o aluno.
                    Responda ou pule para gerar com o que ela já tem.
                </Text>

                {questions.map((q) => (
                    <View
                        key={q.id}
                        style={{
                            backgroundColor: colors.background.card,
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: 14,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: colors.text.primary,
                                marginBottom: 4,
                            }}
                        >
                            {q.question}
                        </Text>
                        {q.context ? (
                            <Text
                                style={{
                                    fontSize: 12,
                                    color: colors.text.tertiary,
                                    marginBottom: 12,
                                    lineHeight: 17,
                                }}
                            >
                                {q.context}
                            </Text>
                        ) : (
                            <View style={{ height: 6 }} />
                        )}

                        {q.type === "single_choice" && q.options && (
                            <View style={{ gap: 8 }}>
                                {q.options.map((opt) => {
                                    const selected = answers[q.id] === opt;
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => onAnswer(q.id, opt)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderRadius: 10,
                                                backgroundColor: selected ? colors.brand.primaryLight : "transparent",
                                                borderWidth: 1,
                                                borderColor: selected ? colors.brand.primary : colors.border.secondary,
                                                gap: 10,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: 9,
                                                    borderWidth: 2,
                                                    borderColor: selected ? colors.brand.primary : colors.border.secondary,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {selected && (
                                                    <View
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 4,
                                                            backgroundColor: colors.brand.primary,
                                                        }}
                                                    />
                                                )}
                                            </View>
                                            <Text
                                                style={{
                                                    flex: 1,
                                                    fontSize: 14,
                                                    color: colors.text.primary,
                                                    fontWeight: selected ? "600" : "500",
                                                }}
                                            >
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {q.type === "multi_choice" && q.options && (
                            <View style={{ gap: 8 }}>
                                {q.options.map((opt) => {
                                    const selectedValues = parseMulti(answers[q.id]);
                                    const selected = selectedValues.includes(opt);
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => {
                                                const next = selected
                                                    ? selectedValues.filter((v) => v !== opt)
                                                    : [...selectedValues, opt];
                                                onAnswer(q.id, joinMulti(next));
                                            }}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: selected }}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                paddingVertical: 10,
                                                paddingHorizontal: 12,
                                                borderRadius: 10,
                                                backgroundColor: selected ? colors.brand.primaryLight : "transparent",
                                                borderWidth: 1,
                                                borderColor: selected ? colors.brand.primary : colors.border.secondary,
                                                gap: 10,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: 4,
                                                    borderWidth: 2,
                                                    borderColor: selected ? colors.brand.primary : colors.border.secondary,
                                                    backgroundColor: selected ? colors.brand.primary : "transparent",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {selected && <Check size={12} color={colors.text.inverse} strokeWidth={3} />}
                                            </View>
                                            <Text
                                                style={{
                                                    flex: 1,
                                                    fontSize: 14,
                                                    color: colors.text.primary,
                                                    fontWeight: selected ? "600" : "500",
                                                }}
                                            >
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {q.type === "text" && (
                            <TextInput
                                value={answers[q.id] || ""}
                                onChangeText={(t) => onAnswer(q.id, t)}
                                placeholder={q.placeholder || "Digite sua resposta…"}
                                placeholderTextColor={colors.text.tertiary}
                                multiline
                                textAlignVertical="top"
                                style={{
                                    minHeight: 80,
                                    backgroundColor: "#ffffff",
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: colors.border.secondary,
                                    padding: 12,
                                    fontSize: 14,
                                    color: colors.text.primary,
                                }}
                            />
                        )}
                    </View>
                ))}
            </ScrollView>

            {/* Action bar */}
            <View
                style={{
                    flexDirection: "row",
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border.primary,
                    backgroundColor: colors.background.card,
                }}
            >
                <TouchableOpacity
                    onPress={onSkip}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Pular perguntas"
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.brand.primary,
                        opacity: isLoading ? 0.5 : 1,
                    }}
                >
                    <SkipForward size={14} color={colors.brand.primary} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.brand.primary }}>
                        Pular perguntas
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onSubmit}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Gerar programa"
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: colors.brand.primary,
                        opacity: isLoading ? 0.7 : 1,
                    }}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={colors.text.inverse} />
                    ) : (
                        <ChevronRight size={14} color={colors.text.inverse} />
                    )}
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.inverse }}>
                        Gerar programa
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

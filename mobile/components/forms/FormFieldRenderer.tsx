import React from "react";
import { View, Text, TextInput, Pressable, Image } from "react-native";
import { Upload, Camera } from "lucide-react-native";

// ---------------------------------------------------------------------------
// Types — shared across FormRenderer and inbox
// ---------------------------------------------------------------------------

export type QuestionType =
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multi_choice"
    | "scale"
    | "photo";

export interface QuestionOption {
    value: string;
    label: string;
}

export interface Question {
    id: string;
    type: QuestionType;
    label: string;
    required?: boolean;
    options?: QuestionOption[];
    scale?: { min?: number; max?: number };
}

export interface FormFieldRendererProps {
    question: Question;
    answer: any;
    onChangeAnswer: (questionId: string, value: any) => void;
    /** Called when user wants to pick an image (full mode only). */
    onPickImage?: (questionId: string) => void;
    /** If true, all inputs are disabled (e.g. already submitted). */
    disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormFieldRenderer({
    question,
    answer,
    onChangeAnswer,
    onPickImage,
    disabled,
}: FormFieldRendererProps) {
    // ── Short / Long Text ──
    if (question.type === "short_text" || question.type === "long_text") {
        return (
            <TextInput
                value={answer?.value || ""}
                onChangeText={(text) =>
                    onChangeAnswer(question.id, { type: question.type, value: text })
                }
                multiline={question.type === "long_text"}
                placeholder="Digite sua resposta"
                editable={!disabled}
                style={{
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    borderRadius: 10,
                    padding: 10,
                    color: "#0f172a",
                    backgroundColor: "#f8fafc",
                    minHeight: question.type === "long_text" ? 90 : 44,
                    textAlignVertical: "top",
                    marginTop: 8,
                    opacity: disabled ? 0.6 : 1,
                }}
                placeholderTextColor="#94a3b8"
            />
        );
    }

    // ── Single Choice ──
    if (question.type === "single_choice") {
        return (
            <View style={{ marginTop: 8, gap: 8 }}>
                {(question.options || []).map((opt) => {
                    const isSelected = answer?.value === opt.value;
                    return (
                        <Pressable
                            key={opt.value}
                            onPress={() =>
                                !disabled &&
                                onChangeAnswer(question.id, { type: "single_choice", value: opt.value })
                            }
                            style={{
                                borderWidth: 1,
                                borderColor: isSelected ? "#7c3aed" : "#e2e8f0",
                                backgroundColor: isSelected ? "#f5f3ff" : "#f8fafc",
                                borderRadius: 10,
                                padding: 10,
                                opacity: disabled ? 0.6 : 1,
                            }}
                        >
                            <Text style={{ color: "#0f172a", fontSize: 14 }}>{opt.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    }

    // ── Multi Choice ──
    if (question.type === "multi_choice") {
        const selectedValues: string[] = answer?.values || [];
        return (
            <View style={{ marginTop: 8, gap: 8 }}>
                {(question.options || []).map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                        <Pressable
                            key={opt.value}
                            onPress={() => {
                                if (disabled) return;
                                const updated = isSelected
                                    ? selectedValues.filter((v: string) => v !== opt.value)
                                    : [...selectedValues, opt.value];
                                onChangeAnswer(question.id, { type: "multi_choice", values: updated });
                            }}
                            style={{
                                borderWidth: 1,
                                borderColor: isSelected ? "#7c3aed" : "#e2e8f0",
                                backgroundColor: isSelected ? "#f5f3ff" : "#f8fafc",
                                borderRadius: 10,
                                padding: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                opacity: disabled ? 0.6 : 1,
                            }}
                        >
                            <View
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    borderWidth: 1.5,
                                    borderColor: isSelected ? "#7c3aed" : "#cbd5e1",
                                    backgroundColor: isSelected ? "#7c3aed" : "transparent",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {isSelected && (
                                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>
                                )}
                            </View>
                            <Text style={{ color: "#0f172a", fontSize: 14, flex: 1 }}>{opt.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    }

    // ── Scale ──
    if (question.type === "scale") {
        const min = question.scale?.min ?? 1;
        const max = question.scale?.max ?? 5;
        const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        const count = values.length;
        const btnSize = count > 7 ? 32 : 36;
        const btnRadius = btnSize / 2;
        const fontSize = count > 7 ? 13 : 15;
        return (
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {values.map((value) => {
                    const selected = Number(answer?.value) === value;
                    return (
                        <Pressable
                            key={value}
                            onPress={() =>
                                !disabled &&
                                onChangeAnswer(question.id, { type: "scale", value })
                            }
                            style={{
                                width: btnSize,
                                height: btnSize,
                                borderRadius: btnRadius,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor: selected ? "#7c3aed" : "#e2e8f0",
                                backgroundColor: selected ? "#f5f3ff" : "#f8fafc",
                                opacity: disabled ? 0.6 : 1,
                            }}
                        >
                            <Text style={{ color: "#0f172a", fontWeight: "700", fontSize }}>
                                {value}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        );
    }

    // ── Photo ──
    if (question.type === "photo") {
        // When onPickImage is provided → full mode (can upload)
        if (onPickImage) {
            const file = answer?.files?.[0];
            return (
                <View style={{ marginTop: 8 }}>
                    <Pressable
                        onPress={() => !disabled && onPickImage(question.id)}
                        disabled={disabled}
                        style={{
                            backgroundColor: "rgba(124, 58, 237, 0.05)",
                            borderRadius: 12,
                            padding: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            borderWidth: 1,
                            borderColor: "rgba(124, 58, 237, 0.1)",
                            opacity: disabled ? 0.6 : 1,
                        }}
                    >
                        <Upload size={16} color="#7c3aed" />
                        <Text style={{ color: "#7c3aed", fontWeight: "600", fontSize: 13 }}>
                            {file ? "Trocar foto" : "Selecionar foto"}
                        </Text>
                    </Pressable>

                    {!!file?.url && (
                        <Image
                            source={{ uri: file.url }}
                            style={{ width: "100%", height: 180, borderRadius: 12, marginTop: 12 }}
                            resizeMode="cover"
                        />
                    )}
                </View>
            );
        }

        // Inline mode — no photo upload
        return (
            <View
                style={{
                    marginTop: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "#e2e8f0",
                    backgroundColor: "#f8fafc",
                }}
            >
                <Camera size={18} color="#94a3b8" />
                <Text style={{ color: "#94a3b8", fontSize: 13 }}>
                    Foto não disponível neste contexto
                </Text>
            </View>
        );
    }

    return null;
}

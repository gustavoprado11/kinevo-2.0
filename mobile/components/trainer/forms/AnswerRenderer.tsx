import React from "react";
import { View, Text, Image } from "react-native";
import type { SchemaQuestion } from "../../../hooks/useTrainerFormSubmissionDetail";

interface Props {
    question: SchemaQuestion;
    answer: any; // { value: string | number } or { files: string[] }
}

export function AnswerRenderer({ question, answer }: Props) {
    const value = answer?.value;
    const files = answer?.files;

    return (
        <View style={{ marginBottom: 20 }}>
            {/* Question label */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 }}>
                {question.label}
                {question.required && <Text style={{ color: "#ef4444" }}> *</Text>}
            </Text>

            {/* Answer */}
            {renderAnswer(question, value, files)}
        </View>
    );
}

function renderAnswer(question: SchemaQuestion, value: any, files: any) {
    switch (question.type) {
        case "short_text":
        case "long_text":
            return (
                <View style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontSize: 15, color: "#1a1a2e", lineHeight: 22 }}>
                        {value || "—"}
                    </Text>
                </View>
            );

        case "single_choice":
            return (
                <View>
                    {(question.options || []).map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <View
                                key={opt.value}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    marginBottom: 4,
                                    backgroundColor: isSelected ? "#f3f0ff" : "#f8fafc",
                                    borderRadius: 10,
                                    borderWidth: isSelected ? 1.5 : 0,
                                    borderColor: isSelected ? "#7c3aed" : "transparent",
                                }}
                            >
                                <View
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        borderWidth: 2,
                                        borderColor: isSelected ? "#7c3aed" : "#cbd5e1",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 10,
                                    }}
                                >
                                    {isSelected && (
                                        <View
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                backgroundColor: "#7c3aed",
                                            }}
                                        />
                                    )}
                                </View>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: isSelected ? "#7c3aed" : "#475569",
                                        fontWeight: isSelected ? "600" : "400",
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            );

        case "scale": {
            const min = question.scale?.min ?? 1;
            const max = question.scale?.max ?? 5;
            const selected = typeof value === "number" ? value : parseInt(value, 10);
            const items = [];
            for (let i = min; i <= max; i++) {
                items.push(i);
            }
            return (
                <View>
                    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
                        {items.map((num) => {
                            const isSelected = num === selected;
                            return (
                                <View
                                    key={num}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        backgroundColor: isSelected ? "#7c3aed" : "#f1f5f9",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: isSelected ? "#ffffff" : "#64748b",
                                        }}
                                    >
                                        {num}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                    {(question.scale?.minLabel || question.scale?.maxLabel) && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: "#94a3b8" }}>
                                {question.scale?.minLabel || ""}
                            </Text>
                            <Text style={{ fontSize: 11, color: "#94a3b8" }}>
                                {question.scale?.maxLabel || ""}
                            </Text>
                        </View>
                    )}
                </View>
            );
        }

        case "photo":
            return (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {(files || []).map((uri: string, idx: number) => (
                        <Image
                            key={idx}
                            source={{ uri }}
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 10,
                                backgroundColor: "#e2e8f0",
                            }}
                        />
                    ))}
                    {(!files || files.length === 0) && (
                        <Text style={{ fontSize: 14, color: "#94a3b8" }}>Nenhuma foto</Text>
                    )}
                </View>
            );

        default:
            return (
                <View style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontSize: 15, color: "#1a1a2e" }}>
                        {typeof value === "string" || typeof value === "number" ? String(value) : "—"}
                    </Text>
                </View>
            );
    }
}

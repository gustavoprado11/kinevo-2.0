import React from "react";
import { View, Text, Image } from "react-native";
import type { SchemaQuestion } from "../../../hooks/useTrainerFormSubmissionDetail";
import { useV2Colors } from "../../../hooks/useV2Colors";

interface Props {
    question: SchemaQuestion;
    answer: any; // { value: string | number } or { files: string[] }
}

export function AnswerRenderer({ question: rawQuestion, answer }: Props) {
    const colors = useV2Colors();
    // Normalize options: plain strings → { value, label } objects
    const question = {
        ...rawQuestion,
        options: rawQuestion.options
            ? rawQuestion.options.map((opt: any, i: number) =>
                typeof opt === "string" ? { value: `opt_${i + 1}`, label: opt } : opt
            )
            : undefined,
    };
    const value = answer?.value;
    const files = answer?.files;

    return (
        <View style={{ marginBottom: 20 }}>
            {/* Question label */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.secondary, marginBottom: 6 }}>
                {question.label}
                {question.required && <Text style={{ color: colors.semantic.danger.default }}> *</Text>}
            </Text>

            {/* Answer */}
            {renderAnswer(question, value, files, colors)}
        </View>
    );
}

type V2Palette = ReturnType<typeof useV2Colors>;

function renderAnswer(question: SchemaQuestion, value: any, files: any, colors: V2Palette) {
    switch (question.type) {
        case "short_text":
        case "long_text":
            return (
                <View style={{ backgroundColor: colors.surface.card2, borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontSize: 15, color: colors.text.primary, lineHeight: 22 }}>
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
                                    backgroundColor: isSelected ? colors.purple[100] : colors.surface.card2,
                                    borderRadius: 10,
                                    borderWidth: isSelected ? 1.5 : 0,
                                    borderColor: isSelected ? colors.purple[600] : "transparent",
                                }}
                            >
                                <View
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        borderWidth: 2,
                                        borderColor: isSelected ? colors.purple[600] : colors.border.default,
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
                                                backgroundColor: colors.purple[600],
                                            }}
                                        />
                                    )}
                                </View>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: isSelected ? colors.purple[600] : colors.text.secondary,
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
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                        {items.map((num) => {
                            const isSelected = num === selected;
                            const btnSize = items.length > 7 ? 30 : 36;
                            return (
                                <View
                                    key={num}
                                    style={{
                                        width: btnSize,
                                        height: btnSize,
                                        borderRadius: btnSize / 2,
                                        backgroundColor: isSelected ? colors.purple[600] : colors.surface.card2,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: items.length > 7 ? 12 : 14,
                                            fontWeight: "600",
                                            color: isSelected ? "#FFFFFF" : colors.text.secondary,
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
                            <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                {question.scale?.minLabel || ""}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
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
                                backgroundColor: colors.border.default,
                            }}
                        />
                    ))}
                    {(!files || files.length === 0) && (
                        <Text style={{ fontSize: 14, color: colors.text.tertiary }}>Nenhuma foto</Text>
                    )}
                </View>
            );

        default:
            return (
                <View style={{ backgroundColor: colors.surface.card2, borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontSize: 15, color: colors.text.primary }}>
                        {typeof value === "string" || typeof value === "number" ? String(value) : "—"}
                    </Text>
                </View>
            );
    }
}

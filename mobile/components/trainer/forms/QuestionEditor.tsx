import React, { useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import {
    AlignLeft,
    FileText,
    ListChecks,
    SlidersHorizontal,
    Camera,
    Trash2,
    ChevronUp,
    ChevronDown,
    Plus,
    X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { Question, QuestionType } from "../../../hooks/useFormTemplateCrud";
import { useV2Colors } from "../../../hooks/useV2Colors";

const QUESTION_TYPE_CONFIG: Record<QuestionType, { icon: typeof AlignLeft; label: string; color: string }> = {
    short_text: { icon: AlignLeft, label: "Texto curto", color: "#3b82f6" },
    long_text: { icon: FileText, label: "Texto longo", color: "#8b5cf6" },
    single_choice: { icon: ListChecks, label: "Escolha única", color: "#f59e0b" },
    scale: { icon: SlidersHorizontal, label: "Escala", color: "#10b981" },
    photo: { icon: Camera, label: "Foto", color: "#ef4444" },
};

interface Props {
    question: Question;
    index: number;
    totalQuestions: number;
    onChange: (updated: Question) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

export function QuestionEditor({
    question,
    index,
    totalQuestions,
    onChange,
    onDelete,
    onMoveUp,
    onMoveDown,
}: Props) {
    const colors = useV2Colors();
    const config = QUESTION_TYPE_CONFIG[question.type];
    const IconComponent = config.icon;

    const handleLabelChange = useCallback(
        (text: string) => onChange({ ...question, label: text }),
        [question, onChange],
    );

    const handleRequiredToggle = useCallback(() => {
        Haptics.selectionAsync();
        onChange({ ...question, required: !question.required });
    }, [question, onChange]);

    const handlePlaceholderChange = useCallback(
        (text: string) => onChange({ ...question, placeholder: text }),
        [question, onChange],
    );

    const handleOptionChange = useCallback(
        (optIndex: number, label: string) => {
            const options = [...(question.options || [])];
            options[optIndex] = { ...options[optIndex], label, value: label.toLowerCase().replace(/\s+/g, "_") };
            onChange({ ...question, options });
        },
        [question, onChange],
    );

    const handleAddOption = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const options = [...(question.options || [])];
        options.push({ value: `option_${options.length + 1}`, label: "" });
        onChange({ ...question, options });
    }, [question, onChange]);

    const handleRemoveOption = useCallback(
        (optIndex: number) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const options = (question.options || []).filter((_, i) => i !== optIndex);
            onChange({ ...question, options });
        },
        [question, onChange],
    );

    const handleScaleChange = useCallback(
        (field: string, value: string | number) => {
            const scale = { min: 1, max: 10, ...question.scale };
            onChange({ ...question, scale: { ...scale, [field]: value } });
        },
        [question, onChange],
    );

    return (
        <View
            style={{
                backgroundColor: colors.surface.card,
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.05)",
            }}
        >
            {/* Header: type badge + reorder + delete */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: config.color + "15",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                    }}
                >
                    <IconComponent size={14} color={config.color} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: config.color }}>{config.label}</Text>
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    onPress={() => {
                        Haptics.selectionAsync();
                        onMoveUp();
                    }}
                    disabled={index === 0}
                    style={{ padding: 6, opacity: index === 0 ? 0.3 : 1 }}
                    accessibilityLabel="Mover para cima"
                >
                    <ChevronUp size={18} color={colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        Haptics.selectionAsync();
                        onMoveDown();
                    }}
                    disabled={index === totalQuestions - 1}
                    style={{ padding: 6, opacity: index === totalQuestions - 1 ? 0.3 : 1 }}
                    accessibilityLabel="Mover para baixo"
                >
                    <ChevronDown size={18} color={colors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onDelete();
                    }}
                    style={{ padding: 6 }}
                    accessibilityLabel="Excluir pergunta"
                >
                    <Trash2 size={16} color={colors.semantic.danger.default} />
                </TouchableOpacity>
            </View>

            {/* Question label */}
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text.tertiary, marginBottom: 4 }}>
                Pergunta {index + 1}
            </Text>
            <TextInput
                value={question.label}
                onChangeText={handleLabelChange}
                placeholder="Digite o texto da pergunta..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                style={{
                    backgroundColor: colors.surface.card2,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: colors.text.primary,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.04)",
                    minHeight: 44,
                }}
            />

            {/* Required toggle */}
            <TouchableOpacity
                onPress={handleRequiredToggle}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}
                accessibilityLabel={question.required ? "Tornar opcional" : "Tornar obrigatória"}
            >
                <View
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: question.required ? colors.purple[600] : colors.border.default,
                        backgroundColor: question.required ? colors.purple[600] : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {question.required && (
                        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>✓</Text>
                    )}
                </View>
                <Text style={{ fontSize: 13, color: colors.text.secondary }}>Obrigatória</Text>
            </TouchableOpacity>

            {/* Placeholder for text types */}
            {(question.type === "short_text" || question.type === "long_text") && (
                <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary, marginBottom: 4 }}>
                        Placeholder (opcional)
                    </Text>
                    <TextInput
                        value={question.placeholder || ""}
                        onChangeText={handlePlaceholderChange}
                        placeholder="Texto de exemplo..."
                        placeholderTextColor={colors.text.quaternary}
                        style={{
                            backgroundColor: colors.surface.card2,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 13,
                            color: colors.text.primary,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                        }}
                    />
                </View>
            )}

            {/* Options for single_choice */}
            {question.type === "single_choice" && (
                <View style={{ marginTop: 12, gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary }}>Opções</Text>
                    {(question.options || []).map((opt, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    borderWidth: 2,
                                    borderColor: colors.border.default,
                                }}
                            />
                            <TextInput
                                value={opt.label}
                                onChangeText={(t) => handleOptionChange(i, t)}
                                placeholder={`Opção ${i + 1}`}
                                placeholderTextColor={colors.text.quaternary}
                                style={{
                                    flex: 1,
                                    backgroundColor: colors.surface.card2,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 13,
                                    color: colors.text.primary,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            />
                            {(question.options || []).length > 2 && (
                                <TouchableOpacity onPress={() => handleRemoveOption(i)} style={{ padding: 4 }}>
                                    <X size={16} color={colors.text.tertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                    <TouchableOpacity
                        onPress={handleAddOption}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
                    >
                        <Plus size={14} color={colors.purple[600]} />
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.purple[600] }}>Adicionar opção</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Scale config */}
            {question.type === "scale" && (
                <View style={{ marginTop: 12, gap: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.text.tertiary }}>Configuração da escala</Text>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginBottom: 4 }}>Mínimo</Text>
                            <TextInput
                                value={String(question.scale?.min ?? 1)}
                                onChangeText={(t) => handleScaleChange("min", parseInt(t) || 0)}
                                keyboardType="number-pad"
                                style={{
                                    backgroundColor: colors.surface.card2,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 14,
                                    color: colors.text.primary,
                                    textAlign: "center",
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginBottom: 4 }}>Máximo</Text>
                            <TextInput
                                value={String(question.scale?.max ?? 10)}
                                onChangeText={(t) => handleScaleChange("max", parseInt(t) || 10)}
                                keyboardType="number-pad"
                                style={{
                                    backgroundColor: colors.surface.card2,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 14,
                                    color: colors.text.primary,
                                    textAlign: "center",
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            />
                        </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginBottom: 4 }}>Label mínimo</Text>
                            <TextInput
                                value={question.scale?.min_label || ""}
                                onChangeText={(t) => handleScaleChange("min_label", t)}
                                placeholder="Ex: Péssimo"
                                placeholderTextColor={colors.text.quaternary}
                                style={{
                                    backgroundColor: colors.surface.card2,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 13,
                                    color: colors.text.primary,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginBottom: 4 }}>Label máximo</Text>
                            <TextInput
                                value={question.scale?.max_label || ""}
                                onChangeText={(t) => handleScaleChange("max_label", t)}
                                placeholder="Ex: Excelente"
                                placeholderTextColor={colors.text.quaternary}
                                style={{
                                    backgroundColor: colors.surface.card2,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 13,
                                    color: colors.text.primary,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.04)",
                                }}
                            />
                        </View>
                    </View>
                </View>
            )}

            {/* Photo type info */}
            {question.type === "photo" && (
                <View
                    style={{
                        marginTop: 12,
                        backgroundColor: "#fef2f2",
                        borderRadius: 8,
                        padding: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <Camera size={14} color={colors.semantic.danger.default} />
                    <Text style={{ fontSize: 12, color: colors.text.secondary, flex: 1 }}>
                        O aluno poderá enviar uma foto da câmera ou galeria
                    </Text>
                </View>
            )}
        </View>
    );
}

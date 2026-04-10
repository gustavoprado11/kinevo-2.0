import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from "react-native";
import { X, Plus, AlignLeft, FileText, ListChecks, SlidersHorizontal, Camera } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { QuestionEditor } from "./QuestionEditor";
import type {
    Question,
    QuestionType,
    FormSchema,
    FormCategory,
    CreateFormTemplateData,
} from "../../../hooks/useFormTemplateCrud";

function generateId(): string {
    return "q_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export interface EditingTemplate {
    id: string;
    title: string;
    description: string | null;
    category: FormCategory;
    schema_json: FormSchema;
    trainer_id: string | null;
}

interface Props {
    visible: boolean;
    template?: EditingTemplate | null;
    onClose: () => void;
    onSave: (data: CreateFormTemplateData & { templateId?: string }) => Promise<void>;
    isSaving: boolean;
}

const CATEGORY_OPTIONS: { key: FormCategory; label: string; icon: typeof AlignLeft; color: string }[] = [
    { key: "anamnese", label: "Anamnese", icon: FileText, color: "#3b82f6" },
    { key: "checkin", label: "Check-in", icon: ListChecks, color: "#10b981" },
    { key: "survey", label: "Pesquisa", icon: SlidersHorizontal, color: "#f59e0b" },
];

const QUESTION_TYPES: { type: QuestionType; icon: typeof AlignLeft; label: string; desc: string }[] = [
    { type: "short_text", icon: AlignLeft, label: "Texto curto", desc: "Resposta de uma linha" },
    { type: "long_text", icon: FileText, label: "Texto longo", desc: "Resposta em parágrafo" },
    { type: "single_choice", icon: ListChecks, label: "Escolha única", desc: "Seleção entre opções" },
    { type: "scale", icon: SlidersHorizontal, label: "Escala", desc: "Nota de 1 a 10" },
    { type: "photo", icon: Camera, label: "Foto", desc: "Upload de imagem" },
];

function createDefaultQuestion(type: QuestionType): Question {
    const base: Question = { id: generateId(), type, label: "", required: false };
    switch (type) {
        case "short_text":
        case "long_text":
            return { ...base, placeholder: "" };
        case "single_choice":
            return {
                ...base,
                options: [
                    { value: "option_1", label: "" },
                    { value: "option_2", label: "" },
                ],
            };
        case "scale":
            return { ...base, scale: { min: 1, max: 10, min_label: "", max_label: "" } };
        case "photo":
        default:
            return base;
    }
}

export function FormBuilderModal({ visible, template, onClose, onSave, isSaving }: Props) {
    const insets = useSafeAreaInsets();
    const isEditing = !!template;

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<FormCategory>("anamnese");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [showAddMenu, setShowAddMenu] = useState(false);

    useEffect(() => {
        if (visible) {
            if (template) {
                setTitle(template.title);
                setDescription(template.description || "");
                setCategory(template.category);
                setQuestions(template.schema_json.questions || []);
            } else {
                setTitle("");
                setDescription("");
                setCategory("anamnese");
                setQuestions([]);
            }
            setShowAddMenu(false);
        }
    }, [visible, template]);

    const handleAddQuestion = useCallback((type: QuestionType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setQuestions((prev) => [...prev, createDefaultQuestion(type)]);
        setShowAddMenu(false);
    }, []);

    const handleUpdateQuestion = useCallback((index: number, updated: Question) => {
        setQuestions((prev) => prev.map((q, i) => (i === index ? updated : q)));
    }, []);

    const handleDeleteQuestion = useCallback((index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert("Excluir pergunta", `Deseja excluir a pergunta ${index + 1}?`, [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Excluir",
                style: "destructive",
                onPress: () => setQuestions((prev) => prev.filter((_, i) => i !== index)),
            },
        ]);
    }, []);

    const handleMoveUp = useCallback((index: number) => {
        if (index === 0) return;
        setQuestions((prev) => {
            const arr = [...prev];
            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
            return arr;
        });
    }, []);

    const handleMoveDown = useCallback((index: number) => {
        setQuestions((prev) => {
            if (index >= prev.length - 1) return prev;
            const arr = [...prev];
            [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
            return arr;
        });
    }, []);

    const canSave = title.trim().length > 0 && questions.length > 0;

    const handleSave = useCallback(async () => {
        if (!canSave || isSaving) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const schema: FormSchema = {
            schema_version: "1.0",
            layout: {
                estimated_minutes: Math.max(1, Math.ceil(questions.length * 0.5)),
                progress_mode: "per_question",
            },
            questions,
        };

        await onSave({
            title: title.trim(),
            description: description.trim() || null,
            category,
            schema,
            ...(template ? { templateId: template.id } : {}),
        });
    }, [canSave, isSaving, title, description, category, questions, template, onSave]);

    const handleClose = useCallback(() => {
        const hasChanges = title.trim() || questions.length > 0;
        if (hasChanges && !isSaving) {
            Alert.alert("Descartar alterações?", "Você tem alterações não salvas. Deseja sair mesmo assim?", [
                { text: "Continuar editando", style: "cancel" },
                { text: "Descartar", style: "destructive", onPress: onClose },
            ]);
        } else {
            onClose();
        }
    }, [title, questions, isSaving, onClose]);

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
                        borderBottomWidth: 0.5,
                        borderBottomColor: "rgba(0,0,0,0.08)",
                        backgroundColor: "#ffffff",
                    }}
                >
                    <TouchableOpacity onPress={handleClose} hitSlop={10} accessibilityLabel="Fechar">
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a2e" }}>
                        {isEditing ? "Editar template" : "Novo template"}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Title */}
                    <Text style={labelStyle}>Título *</Text>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Ex: Check-in Semanal"
                        placeholderTextColor="#94a3b8"
                        style={inputStyle}
                    />

                    {/* Description */}
                    <Text style={[labelStyle, { marginTop: 16 }]}>Descrição (opcional)</Text>
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Instruções para o aluno..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        style={[inputStyle, { minHeight: 60, textAlignVertical: "top" }]}
                    />

                    {/* Category */}
                    <Text style={[labelStyle, { marginTop: 16 }]}>Categoria *</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {CATEGORY_OPTIONS.map((opt) => {
                            const CatIcon = opt.icon;
                            const isActive = category === opt.key;
                            return (
                                <TouchableOpacity
                                    key={opt.key}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setCategory(opt.key);
                                    }}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        backgroundColor: isActive ? "#7c3aed" : "#ffffff",
                                        borderWidth: 1,
                                        borderColor: isActive ? "#7c3aed" : "rgba(0,0,0,0.08)",
                                        alignItems: "center",
                                        gap: 4,
                                    }}
                                >
                                    <CatIcon size={18} color={isActive ? "#ffffff" : opt.color} />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "600",
                                            color: isActive ? "#ffffff" : "#64748b",
                                        }}
                                    >
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginVertical: 24 }} />

                    {/* Questions header */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#0f172a", flex: 1 }}>
                            Perguntas ({questions.length})
                        </Text>
                    </View>

                    {/* Question list */}
                    {questions.map((q, index) => (
                        <QuestionEditor
                            key={q.id}
                            question={q}
                            index={index}
                            totalQuestions={questions.length}
                            onChange={(updated) => handleUpdateQuestion(index, updated)}
                            onDelete={() => handleDeleteQuestion(index)}
                            onMoveUp={() => handleMoveUp(index)}
                            onMoveDown={() => handleMoveDown(index)}
                        />
                    ))}

                    {/* Empty state */}
                    {questions.length === 0 && (
                        <View
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: 14,
                                padding: 32,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.05)",
                                borderStyle: "dashed",
                            }}
                        >
                            <Text style={{ fontSize: 14, color: "#94a3b8", textAlign: "center" }}>
                                Nenhuma pergunta adicionada ainda.{"\n"}Toque no botão abaixo para começar.
                            </Text>
                        </View>
                    )}

                    {/* Add question button */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowAddMenu(!showAddMenu);
                        }}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: "#f5f3ff",
                            borderRadius: 12,
                            paddingVertical: 14,
                            marginTop: 12,
                            borderWidth: 1,
                            borderColor: "#ede9fe",
                            borderStyle: "dashed",
                        }}
                    >
                        <Plus size={18} color="#7c3aed" strokeWidth={2.5} />
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#7c3aed" }}>
                            Adicionar pergunta
                        </Text>
                    </TouchableOpacity>

                    {/* Question type picker */}
                    {showAddMenu && (
                        <View
                            style={{
                                backgroundColor: "#ffffff",
                                borderRadius: 14,
                                marginTop: 8,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.05)",
                            }}
                        >
                            {QUESTION_TYPES.map((qt, i) => {
                                const Icon = qt.icon;
                                return (
                                    <TouchableOpacity
                                        key={qt.type}
                                        onPress={() => handleAddQuestion(qt.type)}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 12,
                                            paddingVertical: 14,
                                            paddingHorizontal: 16,
                                            borderBottomWidth: i < QUESTION_TYPES.length - 1 ? 0.5 : 0,
                                            borderBottomColor: "rgba(0,0,0,0.06)",
                                        }}
                                    >
                                        <Icon size={20} color="#7c3aed" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#0f172a" }}>
                                                {qt.label}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: "#94a3b8" }}>{qt.desc}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Footer */}
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
                    {questions.length > 0 && (
                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "center",
                                marginBottom: 10,
                                gap: 16,
                            }}
                        >
                            <Text style={{ fontSize: 12, color: "#64748b" }}>
                                {questions.length} {questions.length === 1 ? "pergunta" : "perguntas"}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#64748b" }}>
                                ~{Math.max(1, Math.ceil(questions.length * 0.5))} min
                            </Text>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!canSave || isSaving}
                        activeOpacity={0.7}
                        style={{
                            backgroundColor: canSave ? "#7c3aed" : "#d1d5db",
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                        }}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                {isEditing
                                    ? template?.trainer_id === null
                                        ? "Salvar como cópia"
                                        : "Salvar alterações"
                                    : "Criar template"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const labelStyle = {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 8,
};

const inputStyle = {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#1a1a2e",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
};

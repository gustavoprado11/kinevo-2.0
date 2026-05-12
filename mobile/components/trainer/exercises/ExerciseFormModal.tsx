import React, { useState, useEffect } from "react";
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
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MuscleGroupPicker } from "./MuscleGroupPicker";
import { VideoUploadField } from "./VideoUploadField";
import type { Exercise } from "../../../hooks/useExerciseLibrary";
import type { ExerciseFormData } from "../../../hooks/useExerciseCrud";
import { useV2Colors } from "../../../hooks/useV2Colors";

interface MuscleGroup {
    id: string;
    name: string;
}

interface Props {
    visible: boolean;
    exercise?: Exercise | null;
    muscleGroups: MuscleGroup[];
    onClose: () => void;
    onSave: (data: ExerciseFormData) => Promise<void>;
    isSaving: boolean;
    onCreateMuscleGroup?: (name: string) => Promise<{ id: string; name: string } | null>;
    /** Nome pré-preenchido quando o modal abre em modo "criar". Usado pelo
     *  picker do builder pra repassar a busca do trainer ("não achou
     *  Puxada Aberta Pegada Neutra → cria com esse nome já digitado").
     *  Ignorado em modo edição (sobrescrito pelo `exercise.name`). */
    initialName?: string;
}

const DIFFICULTY_OPTIONS = [
    { key: "beginner", label: "Iniciante" },
    { key: "intermediate", label: "Intermediário" },
    { key: "advanced", label: "Avançado" },
];

export function ExerciseFormModal({ visible, exercise, muscleGroups, onClose, onSave, isSaving, onCreateMuscleGroup, initialName }: Props) {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const isEditing = !!exercise;

    const labelStyle = {
        fontSize: 12,
        fontWeight: "600" as const,
        color: colors.text.tertiary,
        textTransform: "uppercase" as const,
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 16,
    };
    const inputStyle = {
        backgroundColor: colors.surface.card,
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    };

    const [name, setName] = useState("");
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);
    const [equipment, setEquipment] = useState("");
    const [difficulty, setDifficulty] = useState<string | null>(null);
    const [instructions, setInstructions] = useState("");
    const [videoFile, setVideoFile] = useState<{ uri: string; name: string; type: string } | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            if (exercise) {
                setName(exercise.name);
                setSelectedMuscleGroups(exercise.muscle_groups.map((mg) => mg.id));
                setEquipment(exercise.equipment || "");
                setDifficulty(exercise.difficulty_level);
                setInstructions(exercise.instructions || "");
                setVideoFile(null);
                setVideoUrl(exercise.video_url);
            } else {
                setName(initialName ?? "");
                setSelectedMuscleGroups([]);
                setEquipment("");
                setDifficulty(null);
                setInstructions("");
                setVideoFile(null);
                setVideoUrl(null);
            }
        }
    }, [visible, exercise, initialName]);

    const canSave = name.trim().length > 0 && selectedMuscleGroups.length > 0;

    const handleSave = async () => {
        if (!canSave || isSaving) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await onSave({
            name: name.trim(),
            muscle_group_ids: selectedMuscleGroups,
            equipment: equipment.trim() || null,
            instructions: instructions.trim() || null,
            difficulty_level: difficulty,
            video_file: videoFile,
            video_url: videoUrl,
        });
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1, backgroundColor: colors.surface.canvas }}
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
                        borderBottomColor: colors.border.default,
                        backgroundColor: colors.surface.card,
                    }}
                >
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Fechar"
                        accessibilityRole="button"
                    >
                        <X size={24} color={colors.text.tertiary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary }}>
                        {isEditing ? "Editar exercício" : "Novo exercício"}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Nome */}
                    <Text style={labelStyle}>Nome *</Text>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Ex: Supino reto com barra"
                        placeholderTextColor={colors.text.quaternary}
                        style={inputStyle}
                        accessibilityLabel="Nome do exercício"
                    />

                    {/* Muscle Groups */}
                    <Text style={labelStyle}>Grupos musculares *</Text>
                    <MuscleGroupPicker
                        muscleGroups={muscleGroups}
                        selectedIds={selectedMuscleGroups}
                        onChange={setSelectedMuscleGroups}
                        onCreateGroup={onCreateMuscleGroup}
                    />

                    {/* Equipment */}
                    <Text style={[labelStyle, { marginTop: 20 }]}>Equipamento</Text>
                    <TextInput
                        value={equipment}
                        onChangeText={setEquipment}
                        placeholder="Ex: Barra, Halteres, Máquina"
                        placeholderTextColor={colors.text.quaternary}
                        style={inputStyle}
                        accessibilityLabel="Equipamento"
                    />

                    {/* Difficulty */}
                    <Text style={labelStyle}>Dificuldade</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {DIFFICULTY_OPTIONS.map((opt) => (
                            <TouchableOpacity
                                key={opt.key}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setDifficulty(difficulty === opt.key ? null : opt.key);
                                }}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: difficulty === opt.key ? "#7c3aed" : colors.surface.card,
                                    borderWidth: 1,
                                    borderColor: difficulty === opt.key ? "#7c3aed" : colors.border.default,
                                }}
                                accessibilityLabel={opt.label}
                                accessibilityRole="button"
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: difficulty === opt.key ? "#ffffff" : colors.text.tertiary,
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Instructions */}
                    <Text style={[labelStyle, { marginTop: 20 }]}>Instruções</Text>
                    <TextInput
                        value={instructions}
                        onChangeText={setInstructions}
                        placeholder="Descreva como executar o exercício..."
                        placeholderTextColor={colors.text.quaternary}
                        multiline
                        style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
                        accessibilityLabel="Instruções do exercício"
                    />

                    {/* Video */}
                    <Text style={labelStyle}>Vídeo demonstrativo</Text>
                    <VideoUploadField
                        videoFile={videoFile}
                        currentVideoUrl={videoUrl}
                        onSelectVideo={setVideoFile}
                        onRemoveCurrentVideo={() => setVideoUrl(null)}
                    />
                </ScrollView>

                {/* Footer */}
                <View
                    style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        paddingBottom: insets.bottom + 12,
                        backgroundColor: colors.surface.card,
                        borderTopWidth: 0.5,
                        borderTopColor: colors.border.default,
                    }}
                >
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!canSave || isSaving}
                        activeOpacity={0.7}
                        accessibilityLabel={isEditing ? "Salvar alterações" : "Criar exercício"}
                        accessibilityRole="button"
                        style={{
                            backgroundColor: canSave ? "#7c3aed" : colors.surface.card2,
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                        }}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                                {isEditing ? "Salvar alterações" : "Criar exercício"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}


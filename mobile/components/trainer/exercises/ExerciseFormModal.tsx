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
}

const DIFFICULTY_OPTIONS = [
    { key: "beginner", label: "Iniciante" },
    { key: "intermediate", label: "Intermediário" },
    { key: "advanced", label: "Avançado" },
];

export function ExerciseFormModal({ visible, exercise, muscleGroups, onClose, onSave, isSaving, onCreateMuscleGroup }: Props) {
    const insets = useSafeAreaInsets();
    const isEditing = !!exercise;

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
                setName("");
                setSelectedMuscleGroups([]);
                setEquipment("");
                setDifficulty(null);
                setInstructions("");
                setVideoFile(null);
                setVideoUrl(null);
            }
        }
    }, [visible, exercise]);

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
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel="Fechar"
                        accessibilityRole="button"
                    >
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a2e" }}>
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
                    <Text style={styles.label}>Nome *</Text>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Ex: Supino reto com barra"
                        placeholderTextColor="#94a3b8"
                        style={styles.input}
                        accessibilityLabel="Nome do exercício"
                    />

                    {/* Muscle Groups */}
                    <Text style={styles.label}>Grupos musculares *</Text>
                    <MuscleGroupPicker
                        muscleGroups={muscleGroups}
                        selectedIds={selectedMuscleGroups}
                        onChange={setSelectedMuscleGroups}
                        onCreateGroup={onCreateMuscleGroup}
                    />

                    {/* Equipment */}
                    <Text style={[styles.label, { marginTop: 20 }]}>Equipamento</Text>
                    <TextInput
                        value={equipment}
                        onChangeText={setEquipment}
                        placeholder="Ex: Barra, Halteres, Máquina"
                        placeholderTextColor="#94a3b8"
                        style={styles.input}
                        accessibilityLabel="Equipamento"
                    />

                    {/* Difficulty */}
                    <Text style={styles.label}>Dificuldade</Text>
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
                                    backgroundColor: difficulty === opt.key ? "#7c3aed" : "#ffffff",
                                    borderWidth: 1,
                                    borderColor: difficulty === opt.key ? "#7c3aed" : "rgba(0,0,0,0.08)",
                                }}
                                accessibilityLabel={opt.label}
                                accessibilityRole="button"
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: difficulty === opt.key ? "#ffffff" : "#64748b",
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Instructions */}
                    <Text style={[styles.label, { marginTop: 20 }]}>Instruções</Text>
                    <TextInput
                        value={instructions}
                        onChangeText={setInstructions}
                        placeholder="Descreva como executar o exercício..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                        accessibilityLabel="Instruções do exercício"
                    />

                    {/* Video */}
                    <Text style={styles.label}>Vídeo demonstrativo</Text>
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
                        backgroundColor: "#ffffff",
                        borderTopWidth: 0.5,
                        borderTopColor: "rgba(0,0,0,0.08)",
                    }}
                >
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!canSave || isSaving}
                        activeOpacity={0.7}
                        accessibilityLabel={isEditing ? "Salvar alterações" : "Criar exercício"}
                        accessibilityRole="button"
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
                                {isEditing ? "Salvar alterações" : "Criar exercício"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = {
    label: {
        fontSize: 12,
        fontWeight: "600" as const,
        color: "#64748b",
        textTransform: "uppercase" as const,
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: "#1a1a2e",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.04)",
    },
};

import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Plus, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "../../../hooks/useV2Colors";

interface MuscleGroup {
    id: string;
    name: string;
}

interface Props {
    muscleGroups: MuscleGroup[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    onCreateGroup?: (name: string) => Promise<MuscleGroup | null>;
}

export function MuscleGroupPicker({ muscleGroups, selectedIds, onChange, onCreateGroup }: Props) {
    const colors = useV2Colors();
    const [showInput, setShowInput] = useState(false);
    const [newName, setNewName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const toggle = (id: string) => {
        Haptics.selectionAsync();
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((s) => s !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const handleCreate = useCallback(async () => {
        if (!newName.trim() || !onCreateGroup || isCreating) return;
        setIsCreating(true);
        const result = await onCreateGroup(newName.trim());
        if (result) {
            // Auto-select the newly created group
            onChange([...selectedIds, result.id]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setNewName("");
        setShowInput(false);
        setIsCreating(false);
    }, [newName, onCreateGroup, isCreating, selectedIds, onChange]);

    return (
        <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {muscleGroups.map((mg) => {
                    const selected = selectedIds.includes(mg.id);
                    return (
                        <TouchableOpacity
                            key={mg.id}
                            onPress={() => toggle(mg.id)}
                            activeOpacity={0.7}
                            accessibilityLabel={`${mg.name}${selected ? ", selecionado" : ""}`}
                            accessibilityRole="button"
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: selected ? "#7c3aed" : colors.surface.card,
                                borderWidth: 1,
                                borderColor: selected ? "#7c3aed" : colors.border.default,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: selected ? "#ffffff" : colors.text.tertiary,
                                }}
                            >
                                {mg.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {/* Add button — only show if onCreateGroup is provided */}
                {onCreateGroup && !showInput && (
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowInput(true);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Criar novo grupo muscular"
                        accessibilityRole="button"
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: "rgba(124,58,237,0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(124,58,237,0.30)",
                            borderStyle: "dashed",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        <Plus size={14} color="#7c3aed" strokeWidth={2.5} />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#7c3aed" }}>
                            Novo
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Inline create input */}
            {showInput && (
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}>
                    <View style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.surface.card,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: "#7c3aed",
                    }}>
                        <TextInput
                            autoFocus
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Nome do grupo"
                            placeholderTextColor={colors.text.quaternary}
                            returnKeyType="done"
                            onSubmitEditing={handleCreate}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                fontSize: 14,
                                color: colors.text.primary,
                            }}
                        />
                    </View>
                    {isCreating ? (
                        <ActivityIndicator size="small" color="#7c3aed" />
                    ) : (
                        <View style={{ flexDirection: "row", gap: 4 }}>
                            <TouchableOpacity
                                onPress={handleCreate}
                                disabled={!newName.trim()}
                                style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    backgroundColor: newName.trim() ? "#7c3aed" : colors.surface.card2,
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Plus size={16} color="#ffffff" strokeWidth={2.5} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => { setShowInput(false); setNewName(""); }}
                                style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    backgroundColor: colors.surface.card2,
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <X size={16} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

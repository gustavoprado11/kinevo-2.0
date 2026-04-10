import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";

interface SetRepsInputProps {
    sets: number;
    reps: string;
    restSeconds: number;
    onUpdate: (updates: { sets?: number; reps?: string; rest_seconds?: number }) => void;
    compact?: boolean;
}

export function SetRepsInput({ sets, reps, restSeconds, onUpdate, compact }: SetRepsInputProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editSets, setEditSets] = useState(String(sets));
    const [editReps, setEditReps] = useState(reps);
    const [editRest, setEditRest] = useState(String(restSeconds));

    const handleStartEdit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditSets(String(sets));
        setEditReps(reps);
        setEditRest(String(restSeconds));
        setIsEditing(true);
    };

    const handleDone = () => {
        const newSets = Math.max(1, Math.min(20, parseInt(editSets) || sets));
        const newReps = editReps.trim() || reps;
        const newRest = Math.max(0, Math.min(600, parseInt(editRest) || restSeconds));
        onUpdate({ sets: newSets, reps: newReps, rest_seconds: newRest });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 9, color: colors.text.tertiary, marginBottom: 2 }}>Séries</Text>
                    <TextInput
                        value={editSets}
                        onChangeText={setEditSets}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        style={{
                            width: 40,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: colors.background.inset,
                            textAlign: "center",
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.text.primary,
                        }}
                        accessibilityLabel="Séries"
                    />
                </View>
                <Text style={{ fontSize: 14, color: colors.text.tertiary, marginTop: 12 }}>×</Text>
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 9, color: colors.text.tertiary, marginBottom: 2 }}>Reps</Text>
                    <TextInput
                        value={editReps}
                        onChangeText={setEditReps}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        style={{
                            width: 44,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: colors.background.inset,
                            textAlign: "center",
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.text.primary,
                        }}
                        accessibilityLabel="Repetições"
                    />
                </View>
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 9, color: colors.text.tertiary, marginBottom: 2 }}>Rest</Text>
                    <TextInput
                        value={editRest}
                        onChangeText={setEditRest}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        onSubmitEditing={handleDone}
                        style={{
                            width: 44,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: colors.background.inset,
                            textAlign: "center",
                            fontSize: 14,
                            fontWeight: "600",
                            color: colors.text.primary,
                        }}
                        accessibilityLabel="Descanso em segundos"
                    />
                </View>
                <TouchableOpacity
                    onPress={handleDone}
                    accessibilityRole="button"
                    accessibilityLabel="Confirmar"
                    style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: colors.brand.primary,
                        marginTop: 12,
                    }}
                >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text.inverse }}>OK</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (compact) {
        return (
            <TouchableOpacity
                onPress={handleStartEdit}
                accessibilityRole="button"
                accessibilityLabel={`${sets} séries de ${reps}, descanso ${restSeconds} segundos`}
                accessibilityHint="Toque para editar"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand.primary }}>
                    {sets}×{reps}
                </Text>
                <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                    {restSeconds}s
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={handleStartEdit}
            accessibilityRole="button"
            accessibilityLabel={`${sets} séries de ${reps}, descanso ${restSeconds} segundos`}
            accessibilityHint="Toque para editar"
        >
            <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                {sets} × {reps}
                <Text style={{ color: colors.text.tertiary }}> · {restSeconds}s</Text>
            </Text>
        </TouchableOpacity>
    );
}

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { GripVertical, Trash2, Dumbbell } from "lucide-react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { SetRepsInput } from "./SetRepsInput";
import type { WorkoutItem } from "@/stores/program-builder-store";

interface WorkoutItemRowProps {
    item: WorkoutItem;
    index: number;
    workoutId: string;
    onUpdate: (updates: Partial<Pick<WorkoutItem, 'sets' | 'reps' | 'rest_seconds' | 'notes'>>) => void;
    onDelete: () => void;
    drag?: () => void;
    isActive?: boolean;
}

export function WorkoutItemRow({
    item,
    index,
    workoutId,
    onUpdate,
    onDelete,
    drag,
    isActive,
}: WorkoutItemRowProps) {
    const { isTablet } = useResponsive();
    const padding = isTablet ? 14 : 10;

    return (
        <Animated.View
            entering={FadeInRight.delay(index * 30).duration(200)}
            style={{
                backgroundColor: isActive ? "#f3f0ff" : colors.background.card,
                borderRadius: 14,
                padding,
                marginBottom: 6,
                borderWidth: 1,
                borderColor: isActive ? colors.brand.primary : colors.border.primary,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isActive ? 0.08 : 0.03,
                shadowRadius: isActive ? 8 : 4,
                elevation: isActive ? 4 : 1,
            }}
        >
            {/* Row 1: drag + icon + name + sets/reps + delete */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {/* Drag handle */}
                <TouchableOpacity
                    onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        drag?.();
                    }}
                    delayLongPress={150}
                    accessibilityLabel="Arrastar para reordenar"
                    style={{ padding: 3, marginRight: 6 }}
                >
                    <GripVertical size={14} color={colors.text.quaternary} />
                </TouchableOpacity>

                {/* Exercise icon */}
                <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    backgroundColor: colors.brand.primaryLight,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                }}>
                    <Dumbbell size={10} color={colors.brand.primary} />
                </View>

                {/* Exercise name (flex) */}
                <Text
                    style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary, flex: 1 }}
                    numberOfLines={1}
                >
                    {item.exercise_name}
                </Text>

                {/* Sets × Reps · Rest (inline) */}
                <View style={{ marginLeft: 8 }}>
                    <SetRepsInput
                        sets={item.sets}
                        reps={item.reps}
                        restSeconds={item.rest_seconds}
                        onUpdate={(updates) => onUpdate(updates)}
                        compact
                    />
                </View>

                {/* Delete */}
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onDelete();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Remover exercício"
                    style={{ padding: 6, marginLeft: 4 }}
                >
                    <Trash2 size={14} color={colors.error.default} />
                </TouchableOpacity>
            </View>

            {/* Row 2: muscle groups */}
            {item.exercise_muscle_groups.length > 0 && (
                <Text style={{
                    fontSize: 10,
                    color: colors.text.tertiary,
                    marginTop: 3,
                    marginLeft: 37,
                }}
                    numberOfLines={1}
                >
                    {item.exercise_muscle_groups.join(", ")}
                </Text>
            )}
        </Animated.View>
    );
}

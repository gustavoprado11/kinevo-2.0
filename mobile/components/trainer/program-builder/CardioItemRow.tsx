/**
 * CardioItemRow — render row for a 'cardio' block in the program builder.
 *
 * Visual mirror do WarmupItemRow, mas accent green e label "CARDIO".
 * Preview: "Esteira · 20min" quando `modality + target + objective` populados;
 * "Bike · 5km" quando objective === 'distance'; fallback "Cardio livre".
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { Heart, Pencil, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";
import type { WorkoutItem } from "@/stores/program-builder-store";

const ACCENT = "#22C55E";

export interface CardioItemRowProps {
    item: WorkoutItem;
    onEdit: () => void;
    onDelete: () => void;
    /** Long-press handler vindo do DraggableFlatList (RenderItemParams). */
    drag?: () => void;
}

export function formatCardioPreview(cfg: Record<string, unknown>): string {
    const modality = typeof cfg?.modality === "string" ? cfg.modality.trim() : "";
    const objective = cfg?.objective;
    const target =
        typeof cfg?.target === "number" && Number.isFinite(cfg.target)
            ? cfg.target
            : null;

    if (!modality && target === null) return "Cardio livre";

    const parts: string[] = [];
    if (modality) parts.push(modality);
    if (target !== null) {
        if (objective === "distance") parts.push(`${target}km`);
        else parts.push(`${target}min`);
    }

    return parts.length > 0 ? parts.join(" · ") : "Cardio livre";
}

export function CardioItemRow({ item, onEdit, onDelete, drag }: CardioItemRowProps) {
    const colors = useV2Colors();
    const preview = formatCardioPreview(item.item_config ?? {});
    const isFree = preview === "Cardio livre";

    return (
        <Animated.View entering={FadeInRight.duration(180)} style={{ marginBottom: 8 }}>
            <PressableScale
                onPress={() => {
                    Haptics.selectionAsync().catch(() => { });
                    onEdit();
                }}
                onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    drag?.();
                }}
                delayLongPress={150}
                accessibilityRole="button"
                accessibilityLabel="Editar cardio"
                accessibilityHint="Mantenha pressionado pra reordenar"
                haptic={false}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 12,
                        backgroundColor: colors.surface.card,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border.subtle,
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                    }}
                >
                    <View
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: "rgba(34,197,94,0.10)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Heart size={18} color={ACCENT} strokeWidth={2.2} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            style={{
                                fontSize: 9,
                                fontWeight: "800",
                                color: ACCENT,
                                letterSpacing: 1.5,
                                textTransform: "uppercase",
                                marginBottom: 4,
                            }}
                        >
                            Cardio
                        </Text>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{
                                fontSize: 13,
                                fontWeight: "500",
                                color: isFree ? colors.text.tertiary : colors.text.primary,
                                lineHeight: 18,
                            }}
                        >
                            {preview}
                        </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => { });
                                onEdit();
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Editar cardio"
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Pencil size={16} color={colors.text.secondary} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                                onDelete();
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel="Excluir cardio"
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Trash2
                                size={16}
                                color={colors.semantic.danger.default}
                                strokeWidth={2}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </PressableScale>
        </Animated.View>
    );
}

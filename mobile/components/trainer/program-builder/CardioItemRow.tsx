/**
 * CardioItemRow — render row for a 'cardio' block in the program builder.
 *
 * Pattern V2: color strip lateral 3pt verde, borderRadius 16, shadow sutil,
 * tipografia escalonada (label 10pt + preview 14pt 600). Ícone squircle 10pt.
 *
 * Preview: "Esteira · 20min · Zona 2" (schema canônico, com fallback pro
 * legado mobile e resumo de protocolo intervalado) — ver cardio-config.ts.
 *
 * Drag: long-press em qualquer área do card via PressableScale (delay 150ms).
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { Heart, Pencil, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";
import type { WorkoutItem } from "@/stores/program-builder-store";
import { formatCardioPreview } from "./cardio-config";

const ACCENT = "#22C55E";
const ACCENT_TINT = "rgba(34,197,94,0.10)";

export interface CardioItemRowProps {
    item: WorkoutItem;
    onEdit: () => void;
    onDelete: () => void;
    /** Long-press handler vindo do DraggableFlatList (RenderItemParams). */
    drag?: () => void;
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
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: colors.surface.card,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.border.default,
                        borderLeftWidth: 3,
                        borderLeftColor: ACCENT,
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        overflow: "hidden",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.03,
                        shadowRadius: 4,
                        elevation: 1,
                    }}
                >
                    <View
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: ACCENT_TINT,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Heart size={18} color={ACCENT} strokeWidth={2.2} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: "800",
                                color: ACCENT,
                                letterSpacing: 1.5,
                                textTransform: "uppercase",
                                marginBottom: 3,
                            }}
                        >
                            Cardio
                        </Text>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: isFree ? colors.text.tertiary : colors.text.primary,
                                lineHeight: 18,
                                letterSpacing: -0.1,
                            }}
                        >
                            {preview}
                        </Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 2 }}>
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
                            <Pencil size={15} color={colors.text.tertiary} strokeWidth={2} />
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
                                size={15}
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

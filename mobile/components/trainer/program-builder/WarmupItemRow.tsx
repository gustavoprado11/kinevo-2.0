/**
 * WarmupItemRow — render row for a 'warmup' block in the program builder.
 *
 * Visual mirror do NoteItemRow, mas accent orange e label "AQUECIMENTO".
 * Preview lê `item_config.description`; fallback "Aquecimento livre".
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { Flame, Pencil, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";
import type { WorkoutItem } from "@/stores/program-builder-store";

const ACCENT = "#F97316";

export interface WarmupItemRowProps {
    item: WorkoutItem;
    onEdit: () => void;
    onDelete: () => void;
    /** Long-press handler vindo do DraggableFlatList (RenderItemParams). */
    drag?: () => void;
}

function readDescription(cfg: Record<string, unknown>): string | null {
    const raw = cfg?.description;
    if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
    return null;
}

export function WarmupItemRow({ item, onEdit, onDelete, drag }: WarmupItemRowProps) {
    const colors = useV2Colors();
    const desc = readDescription(item.item_config ?? {});
    const preview = desc ?? "Aquecimento livre";
    const hasDesc = !!desc;

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
                accessibilityLabel="Editar aquecimento"
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
                            backgroundColor: "rgba(249,115,22,0.10)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Flame size={18} color={ACCENT} strokeWidth={2.2} />
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
                            Aquecimento
                        </Text>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{
                                fontSize: 13,
                                fontWeight: "500",
                                color: hasDesc ? colors.text.primary : colors.text.tertiary,
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
                            accessibilityLabel="Editar aquecimento"
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
                            accessibilityLabel="Excluir aquecimento"
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

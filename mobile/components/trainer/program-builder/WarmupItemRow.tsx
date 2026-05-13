/**
 * WarmupItemRow — render row for a 'warmup' block in the program builder.
 *
 * Pattern V2: color strip lateral 3pt laranja, borderRadius 16, shadow sutil,
 * tipografia escalonada (label 10pt + preview 14pt 600). Ícone squircle 10pt.
 *
 * Drag: long-press em qualquer área do card via PressableScale (delay 150ms).
 * Pattern coerente com NoteItemRow e CardioItemRow e bem mais fácil de pegar
 * do que o GripVertical do WorkoutItemRow (decisão UX do Gustavo).
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
const ACCENT_TINT = "rgba(249,115,22,0.10)";

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
                    {/* Ícone squircle tinted (V2) — substitui o círculo legacy. */}
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
                        <Flame size={18} color={ACCENT} strokeWidth={2.2} />
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
                            Aquecimento
                        </Text>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: hasDesc ? colors.text.primary : colors.text.tertiary,
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
                            accessibilityLabel="Editar aquecimento"
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

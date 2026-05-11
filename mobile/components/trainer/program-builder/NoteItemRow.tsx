/**
 * NoteItemRow — render row for a 'note' block in the program builder.
 *
 * Visual: card horizontal com ícone StickyNote azul, label "NOTA TÉCNICA" e
 * preview do texto. Edit/Delete à direita. Tap no card inteiro dispara onEdit.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { StickyNote, Pencil, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors } from "@/hooks/useV2Colors";
import type { WorkoutItem } from "@/stores/program-builder-store";

const ACCENT = "#3B82F6";

export interface NoteItemRowProps {
    item: WorkoutItem;
    onEdit: () => void;
    onDelete: () => void;
    /** Long-press handler vindo do DraggableFlatList (RenderItemParams). */
    drag?: () => void;
}

export function NoteItemRow({ item, onEdit, onDelete, drag }: NoteItemRowProps) {
    const colors = useV2Colors();
    const text = item.notes?.trim() || "Toque para escrever a nota…";
    const hasText = !!item.notes?.trim();

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
                accessibilityLabel="Editar nota técnica"
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
                            backgroundColor: "rgba(59,130,246,0.10)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <StickyNote size={18} color={ACCENT} strokeWidth={2.2} />
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
                            Nota técnica
                        </Text>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{
                                fontSize: 13,
                                fontWeight: "500",
                                color: hasText ? colors.text.primary : colors.text.tertiary,
                                lineHeight: 18,
                            }}
                        >
                            {text}
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
                            accessibilityLabel="Editar nota"
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
                            accessibilityLabel="Excluir nota"
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

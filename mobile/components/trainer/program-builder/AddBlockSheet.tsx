/**
 * AddBlockSheet — bottom sheet com 4 opções de bloco pro program builder.
 *
 * Apresentacional. Caller decide o que fazer ao tocar em cada opção:
 *  - Exercise → tipicamente abrir ExercisePickerModal.
 *  - Warmup / Cardio / Note → tipicamente chamar action da store.
 *
 * Visual: ícone colorido circular + título + subtítulo + chevron right.
 * Light/dark adaptativo via useV2Colors + useIsDark.
 */
import React from "react";
import {
    Modal,
    Pressable,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    ChevronRight,
    Dumbbell,
    Flame,
    Heart,
    StickyNote,
    X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { useV2Colors, useIsDark } from "../../../hooks/useV2Colors";
import { toRgba } from "../../../lib/brandColor";

export interface AddBlockSheetProps {
    visible: boolean;
    onClose: () => void;
    onAddExercise: () => void;
    onAddWarmup: () => void;
    onAddCardio: () => void;
    onAddNote: () => void;
}

interface BlockOption {
    key: "exercise" | "warmup" | "cardio" | "note";
    title: string;
    subtitle: string;
    icon: typeof Dumbbell;
    iconColor: string;
    iconBg: string;
    accessibilityLabel: string;
    onPress: () => void;
}

export function AddBlockSheet({
    visible,
    onClose,
    onAddExercise,
    onAddWarmup,
    onAddCardio,
    onAddNote,
}: AddBlockSheetProps) {
    const colors = useV2Colors();
    const isDark = useIsDark();

    const handleSelect = (cb: () => void) => {
        Haptics.selectionAsync().catch(() => { });
        cb();
    };

    const options: BlockOption[] = [
        {
            key: "exercise",
            title: "Exercício",
            subtitle: "Movimento com séries, reps e carga",
            icon: Dumbbell,
            iconColor: colors.purple[600],
            iconBg: isDark ? toRgba(colors.purple[600], 0.18) : toRgba(colors.purple[600], 0.10),
            accessibilityLabel: "Adicionar exercício",
            onPress: () => handleSelect(onAddExercise),
        },
        {
            key: "warmup",
            title: "Aquecimento",
            subtitle: "Bloco inicial pra preparar o corpo",
            icon: Flame,
            iconColor: "#F97316",
            iconBg: isDark ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.10)",
            accessibilityLabel: "Adicionar aquecimento",
            onPress: () => handleSelect(onAddWarmup),
        },
        {
            key: "cardio",
            title: "Cardio",
            subtitle: "Esteira, bike ou aeróbio livre",
            icon: Heart,
            iconColor: "#22C55E",
            iconBg: isDark ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.10)",
            accessibilityLabel: "Adicionar cardio",
            onPress: () => handleSelect(onAddCardio),
        },
        {
            key: "note",
            title: "Nota",
            subtitle: "Instrução em texto pro aluno ler",
            icon: StickyNote,
            iconColor: "#3B82F6",
            iconBg: isDark ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.10)",
            accessibilityLabel: "Adicionar nota",
            onPress: () => handleSelect(onAddNote),
        },
    ];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            {/* Backdrop */}
            <Pressable
                onPress={onClose}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.45)",
                    justifyContent: "flex-end",
                }}
            >
                {/* Sheet container — stop propagation by wrapping inner Pressable */}
                <Pressable
                    onPress={() => { }}
                    style={{
                        backgroundColor: colors.surface.canvas,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingTop: 8,
                        paddingHorizontal: 16,
                        paddingBottom: 8,
                    }}
                >
                    <SafeAreaView>
                        {/* Drag handle */}
                        <View style={{ alignItems: "center", marginBottom: 8 }}>
                            <View
                                style={{
                                    width: 36,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: colors.border.default,
                                }}
                            />
                        </View>

                        {/* Header */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingVertical: 8,
                                marginBottom: 8,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "700",
                                    color: colors.text.primary,
                                }}
                            >
                                Adicionar bloco
                            </Text>
                            <TouchableOpacity
                                onPress={onClose}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel="Fechar"
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: colors.surface.card2,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <X size={16} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Options */}
                        <View style={{ gap: 12, paddingBottom: 8 }}>
                            {options.map((opt) => {
                                const Icon = opt.icon;
                                return (
                                    <PressableScale
                                        key={opt.key}
                                        onPress={opt.onPress}
                                        accessibilityRole="button"
                                        accessibilityLabel={opt.accessibilityLabel}
                                        haptic={false}
                                    >
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                backgroundColor: colors.surface.card,
                                                borderRadius: 16,
                                                borderWidth: 1,
                                                borderColor: colors.border.subtle,
                                                paddingHorizontal: 16,
                                                paddingVertical: 14,
                                                gap: 14,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: opt.iconBg,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <Icon
                                                    size={20}
                                                    color={opt.iconColor}
                                                    strokeWidth={2.2}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: "700",
                                                        color: colors.text.primary,
                                                        marginBottom: 2,
                                                    }}
                                                >
                                                    {opt.title}
                                                </Text>
                                                <Text
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: "500",
                                                        color: colors.text.tertiary,
                                                    }}
                                                >
                                                    {opt.subtitle}
                                                </Text>
                                            </View>
                                            <ChevronRight
                                                size={18}
                                                color={colors.text.quaternary}
                                                strokeWidth={2}
                                            />
                                        </View>
                                    </PressableScale>
                                );
                            })}
                        </View>
                    </SafeAreaView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

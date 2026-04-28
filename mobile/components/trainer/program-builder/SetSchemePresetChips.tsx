import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

import type { MethodKey } from "@kinevo/shared/types/prescription";
import { SYSTEM_PRESETS } from "@kinevo/shared/lib/prescription/set-scheme-presets";

import { colors } from "@/theme";

interface SetSchemePresetChipsProps {
    activeKey: MethodKey | null;
    /** Aplica um preset (sobrescreve scheme + rounds) ou marca como Customizado
     *  (`'custom'` — preserva scheme + rounds, só rotula). Fase 4.5d §1+§7. */
    onApply: (key: Exclude<MethodKey, "standard">) => void;
}

const PRESET_ORDER: Array<Exclude<MethodKey, "standard" | "custom">> = [
    "pyramid_down",
    "pyramid_up",
    "drop_set",
    "top_backoff",
    "5x5",
    "cluster",
];

/** Segmented control unificado (Fase 4.5d §1):
 *  - 6 chips de preset + 1 chip "Customizado" sempre visível no fim.
 *  - Container cinza escuro (NativeWind kinevo-surface), chips ativos em
 *    violeta sólido com texto branco; inativos transparentes.
 *  - Customizado é manualmente clicável e preserva `set_scheme`/`rounds`
 *    — só rotula a intenção do trainer. */
export function SetSchemePresetChips({ activeKey, onApply }: SetSchemePresetChipsProps) {
    const renderChip = (
        key: Exclude<MethodKey, "standard">,
        label: string,
        accessibilityHint?: string,
    ) => {
        const active = activeKey === key;
        return (
            <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                accessibilityHint={accessibilityHint}
                onPress={() => {
                    Haptics.selectionAsync();
                    onApply(key);
                }}
                style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: active ? colors.brand.primary : "transparent",
                }}
            >
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: active ? "700" : "600",
                        color: active ? colors.text.inverse : colors.text.secondary,
                    }}
                >
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 2,
                    backgroundColor: colors.background.inset,
                    borderRadius: 10,
                    padding: 2,
                }}
            >
                {PRESET_ORDER.map((key) => {
                    const preset = SYSTEM_PRESETS[key];
                    return renderChip(key, preset.name, preset.description);
                })}
                {renderChip(
                    "custom",
                    "Customizado",
                    "Mantém a estrutura atual e rotula como Customizado",
                )}
            </View>
        </ScrollView>
    );
}

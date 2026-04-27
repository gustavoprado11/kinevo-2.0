import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

import type { MethodKey } from "@kinevo/shared/types/prescription";
import { SYSTEM_PRESETS } from "@kinevo/shared/lib/prescription/set-scheme-presets";

import { colors } from "@/theme";

interface SetSchemePresetChipsProps {
    activeKey: MethodKey | null;
    onApply: (key: Exclude<MethodKey, "standard" | "custom">) => void;
}

const PRESET_ORDER: Array<Exclude<MethodKey, "standard" | "custom">> = [
    "pyramid_down",
    "pyramid_up",
    "drop_set",
    "top_backoff",
    "5x5",
    "cluster",
];

export function SetSchemePresetChips({ activeKey, onApply }: SetSchemePresetChipsProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}
        >
            {PRESET_ORDER.map((key) => {
                const preset = SYSTEM_PRESETS[key];
                const active = activeKey === key;
                return (
                    <TouchableOpacity
                        key={key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={preset.description}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onApply(key);
                        }}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: active ? colors.brand.primary : "transparent",
                            borderWidth: 1,
                            borderColor: active ? colors.brand.primary : colors.border.secondary,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: active ? colors.text.inverse : colors.text.secondary,
                            }}
                        >
                            {preset.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

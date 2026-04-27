import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Plus, X } from "lucide-react-native";

import type { MethodKey, WorkoutSet } from "@kinevo/shared/types/prescription";
import {
    applyPreset,
    expandToSetScheme,
    inferMethodKeyFromScheme,
    summarizeSetScheme,
} from "@kinevo/shared/lib/prescription/set-scheme";
import { SYSTEM_PRESETS } from "@kinevo/shared/lib/prescription/set-scheme-presets";

import { colors } from "@/theme";
import { SetSchemeCard } from "./SetSchemeCard";
import { SetSchemePresetChips } from "./SetSchemePresetChips";

export interface SetSchemeEditorResult {
    scheme: WorkoutSet[] | null;
    methodKey: MethodKey | null;
    /** When true, also overwrite the parent aggregates with the summary. */
    aggregates: { sets: number; reps: string; rest_seconds: number } | null;
}

interface SetSchemeEditorProps {
    visible: boolean;
    /** Initial scheme (null = trainer is opening "advanced" for the first time). */
    initialScheme: WorkoutSet[] | null;
    initialMethodKey: MethodKey | null;
    /** Aggregates from the parent item — used by `expandToSetScheme` on first open. */
    fallbackAggregates: { sets: number | null; reps: string | null; rest_seconds: number | null };
    exerciseName: string;
    onSave: (result: SetSchemeEditorResult) => void;
    onClose: () => void;
}

const methodLabel = (key: MethodKey | null): string => {
    if (!key || key === "standard" || key === "custom") return "Customizado";
    return SYSTEM_PRESETS[key]?.name ?? "Customizado";
};

const renumber = (sets: WorkoutSet[]): WorkoutSet[] =>
    sets.map((s, i) => ({ ...s, set_number: i + 1 }));

export function SetSchemeEditor({
    visible,
    initialScheme,
    initialMethodKey,
    fallbackAggregates,
    exerciseName,
    onSave,
    onClose,
}: SetSchemeEditorProps) {
    const insets = useSafeAreaInsets();

    const [scheme, setScheme] = useState<WorkoutSet[]>(() =>
        initialScheme && initialScheme.length > 0
            ? initialScheme
            : expandToSetScheme(
                fallbackAggregates.sets,
                fallbackAggregates.reps,
                fallbackAggregates.rest_seconds,
            ),
    );
    const [methodKey, setMethodKey] = useState<MethodKey | null>(initialMethodKey);

    // Reset when visible toggles to true with new initial values.
    useEffect(() => {
        if (!visible) return;
        const next = initialScheme && initialScheme.length > 0
            ? initialScheme
            : expandToSetScheme(
                fallbackAggregates.sets,
                fallbackAggregates.reps,
                fallbackAggregates.rest_seconds,
            );
        setScheme(next);
        setMethodKey(initialMethodKey);
    }, [visible, initialScheme, initialMethodKey, fallbackAggregates.sets, fallbackAggregates.reps, fallbackAggregates.rest_seconds]);

    const displayKey: MethodKey = methodKey ?? inferMethodKeyFromScheme(scheme);

    const updateSet = (index: number, patch: Partial<WorkoutSet>) => {
        setScheme((prev) => renumber(prev.map((s, i) => (i === index ? { ...s, ...patch } : s))));
        setMethodKey("custom");
    };

    const addSet = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setScheme((prev) => {
            const last = prev[prev.length - 1];
            const newSet: WorkoutSet = last
                ? { ...last, set_number: prev.length + 1 }
                : {
                    set_number: 1,
                    set_type: "normal",
                    reps: "10",
                    rest_seconds: 60,
                    weight_target_kg: null,
                    weight_target_pct1rm: null,
                    rir: null,
                    tempo: null,
                    notes: null,
                };
            return [...prev, newSet];
        });
        setMethodKey("custom");
    };

    const duplicateSet = (index: number) => {
        setScheme((prev) => {
            const dup = { ...prev[index] };
            return renumber([...prev.slice(0, index + 1), dup, ...prev.slice(index + 1)]);
        });
        setMethodKey("custom");
    };

    const removeSet = (index: number) => {
        setScheme((prev) => {
            if (prev.length <= 1) return prev;
            return renumber(prev.filter((_, i) => i !== index));
        });
        setMethodKey("custom");
    };

    const applyPresetKey = (key: Exclude<MethodKey, "standard" | "custom">) => {
        const next = applyPreset(key);
        setScheme(next);
        setMethodKey(key);
    };

    const handleExitAdvanced = () => {
        Alert.alert(
            "Voltar para modo simples?",
            "Você perderá as configurações específicas de cada série.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Continuar",
                    style: "destructive",
                    onPress: () => {
                        const summary = scheme.length > 0
                            ? summarizeSetScheme(scheme)
                            : { sets: 3, reps: "10", rest_seconds: 60 };
                        onSave({ scheme: null, methodKey: null, aggregates: summary });
                    },
                },
            ],
        );
    };

    const handleSave = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const summary = summarizeSetScheme(scheme);
        onSave({
            scheme,
            methodKey: methodKey ?? inferMethodKeyFromScheme(scheme),
            aggregates: summary,
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.background.primary }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={{ flex: 1, paddingTop: insets.top || 12 }}>
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: colors.background.card,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border.primary,
                        }}
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar"
                            style={{ padding: 6 }}
                        >
                            <X size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: "center" }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }} numberOfLines={1}>
                                {exerciseName}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 2 }}>
                                Método: {methodLabel(displayKey)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleSave}
                            accessibilityRole="button"
                            accessibilityLabel="Salvar"
                            style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.brand.primary }}>
                                Salvar
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Preset chips */}
                    <View style={{ paddingVertical: 8, backgroundColor: colors.background.card, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
                        <SetSchemePresetChips activeKey={displayKey} onApply={applyPresetKey} />
                    </View>

                    {/* Lista de cards de série */}
                    <ScrollView
                        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {scheme.map((s, idx) => (
                            <SetSchemeCard
                                key={`set-${idx}`}
                                set={s}
                                index={idx}
                                canRemove={scheme.length > 1}
                                onUpdate={(patch) => updateSet(idx, patch)}
                                onDuplicate={() => duplicateSet(idx)}
                                onRemove={() => removeSet(idx)}
                            />
                        ))}

                        <TouchableOpacity
                            onPress={addSet}
                            accessibilityRole="button"
                            accessibilityLabel="Adicionar série"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                paddingVertical: 12,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderStyle: "dashed",
                                borderColor: colors.brand.primary,
                                backgroundColor: colors.brand.primaryLight,
                                gap: 6,
                                marginTop: 4,
                            }}
                        >
                            <Plus size={16} color={colors.brand.primary} />
                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.brand.primary }}>
                                Adicionar série
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleExitAdvanced}
                            accessibilityRole="button"
                            accessibilityLabel="Voltar para modo simples"
                            style={{ alignItems: "center", paddingVertical: 16, marginTop: 8 }}
                        >
                            <Text style={{ fontSize: 13, color: colors.text.secondary, textDecorationLine: "underline" }}>
                                Voltar para modo simples
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

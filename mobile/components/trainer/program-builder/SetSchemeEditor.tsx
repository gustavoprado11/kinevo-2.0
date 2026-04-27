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
import { ChevronDown, ChevronUp, Plus, Repeat, Undo2, X } from "lucide-react-native";

import type { MethodKey, WorkoutSet } from "@kinevo/shared/types/prescription";
import {
    applyPreset,
    expandToSetScheme,
    inferMethodKeyFromScheme,
    summarizeSetScheme,
    summarizeWithRounds,
} from "@kinevo/shared/lib/prescription/set-scheme";
import {
    SYSTEM_PRESETS,
    isCompoundMethod,
} from "@kinevo/shared/lib/prescription/set-scheme-presets";
import { Minus } from "lucide-react-native";

import { colors } from "@/theme";
import { SetSchemeCard } from "./SetSchemeCard";
import { SetSchemePresetChips } from "./SetSchemePresetChips";

// ---------------------------------------------------------------------------
// "Mais campos" preference — persisted in MMKV with in-memory fallback.
// ---------------------------------------------------------------------------

const ADVANCED_FIELDS_MMKV_ID = "kinevo-setscheme-prefs";
const ADVANCED_FIELDS_KEY = "advanced_fields_mobile";

const advancedFieldsStorage: { read: () => boolean; write: (v: boolean) => void } = (() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createMMKV } = require("react-native-mmkv");
        const mmkv = createMMKV({ id: ADVANCED_FIELDS_MMKV_ID });
        return {
            read: () => mmkv.getBoolean(ADVANCED_FIELDS_KEY) === true,
            write: (v: boolean) => { mmkv.set(ADVANCED_FIELDS_KEY, v); },
        };
    } catch {
        // Expo Go / Jest / unavailable native module — toggle still works in
        // memory, preference just isn't persisted across app restarts.
        let value = false;
        return {
            read: () => value,
            write: (v: boolean) => { value = v; },
        };
    }
})();

export interface SetSchemeEditorResult {
    scheme: WorkoutSet[] | null;
    methodKey: MethodKey | null;
    /** Rodadas (Fase 4.3). 1 para métodos lineares, 2..20 para compostos. */
    rounds: number;
    /** When true, also overwrite the parent aggregates with the summary. */
    aggregates: { sets: number; reps: string; rest_seconds: number } | null;
}

interface SetSchemeEditorProps {
    visible: boolean;
    /** Initial scheme (null = trainer is opening "advanced" for the first time). */
    initialScheme: WorkoutSet[] | null;
    initialMethodKey: MethodKey | null;
    /** Initial rounds (Fase 4.3). Defaults to 1 when omitted. */
    initialRounds?: number;
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
    initialRounds,
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
    const [rounds, setRounds] = useState<number>(() => Math.max(1, initialRounds ?? 1));
    // "+ Mais campos" toggle (Fase 4.5b) — persists per device via MMKV.
    const [showAdvancedFields, setShowAdvancedFields] = useState<boolean>(() => advancedFieldsStorage.read());
    const toggleAdvancedFields = () => {
        Haptics.selectionAsync();
        setShowAdvancedFields((prev) => {
            const next = !prev;
            advancedFieldsStorage.write(next);
            return next;
        });
    };

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
        setRounds(Math.max(1, initialRounds ?? 1));
    }, [visible, initialScheme, initialMethodKey, initialRounds, fallbackAggregates.sets, fallbackAggregates.reps, fallbackAggregates.rest_seconds]);

    const displayKey: MethodKey = methodKey ?? inferMethodKeyFromScheme(scheme);
    const isCompound = isCompoundMethod(displayKey);
    const effectiveRounds = isCompound ? rounds : 1;

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
        const presetDefault = SYSTEM_PRESETS[key]?.defaultRounds ?? 1;
        setRounds(Math.max(1, presetDefault));
    };

    const incrementRounds = () => {
        Haptics.selectionAsync();
        setRounds((r) => Math.min(20, r + 1));
    };
    const decrementRounds = () => {
        Haptics.selectionAsync();
        setRounds((r) => Math.max(1, r - 1));
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
                        onSave({ scheme: null, methodKey: null, rounds: 1, aggregates: summary });
                    },
                },
            ],
        );
    };

    const handleSave = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const summary = isCompound
            ? summarizeWithRounds(scheme, effectiveRounds)
            : summarizeSetScheme(scheme);
        onSave({
            scheme,
            methodKey: methodKey ?? inferMethodKeyFromScheme(scheme),
            rounds: effectiveRounds,
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

                    {/* Rodadas (compound methods only) */}
                    {isCompound ? (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                backgroundColor: colors.background.card,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border.primary,
                                gap: 12,
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text.primary }}>
                                    Rodadas
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 2 }}>
                                    Quantas vezes a estrutura abaixo se repete.
                                </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <TouchableOpacity
                                    onPress={decrementRounds}
                                    disabled={rounds <= 1}
                                    accessibilityRole="button"
                                    accessibilityLabel="Diminuir rodadas"
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        backgroundColor: rounds <= 1 ? colors.background.primary : colors.brand.primaryLight,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        opacity: rounds <= 1 ? 0.4 : 1,
                                    }}
                                >
                                    <Minus size={16} color={colors.brand.primary} />
                                </TouchableOpacity>
                                <Text
                                    style={{
                                        minWidth: 28,
                                        textAlign: "center",
                                        fontSize: 17,
                                        fontWeight: "800",
                                        color: colors.brand.primary,
                                        fontVariant: ["tabular-nums"],
                                    }}
                                >
                                    {rounds}
                                </Text>
                                <TouchableOpacity
                                    onPress={incrementRounds}
                                    disabled={rounds >= 20}
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar rodadas"
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        backgroundColor: rounds >= 20 ? colors.background.primary : colors.brand.primaryLight,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        opacity: rounds >= 20 ? 0.4 : 1,
                                    }}
                                >
                                    <Plus size={16} color={colors.brand.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null}

                    {/* Banner explicativo de rodadas (Fase 4.5b). Só aparece em
                     *  métodos compostos com mais de uma rodada. */}
                    {isCompound && rounds > 1 && scheme.length > 0 ? (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 8,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                backgroundColor: "rgba(59, 130, 246, 0.10)",
                                borderBottomWidth: 1,
                                borderBottomColor: "rgba(59, 130, 246, 0.20)",
                            }}
                        >
                            <Repeat size={14} color="#1d4ed8" style={{ marginTop: 2 }} />
                            <Text
                                style={{
                                    flex: 1,
                                    fontSize: 11,
                                    lineHeight: 15,
                                    color: "#1e3a8a",
                                }}
                            >
                                <Text style={{ fontWeight: "700" }}>
                                    Esta estrutura de {scheme.length} {scheme.length === 1 ? "fase" : "fases"} será repetida {rounds} vezes.
                                </Text>{" "}
                                Cada rodada inteira conta como 1 série efetiva no volume semanal.
                            </Text>
                        </View>
                    ) : null}

                    {/* Lista de cards de série */}
                    <ScrollView
                        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Linha 1 (Fase 4.5c §3): "Voltar para modo simples"
                         *  à esquerda como botão secundário discreto, separado
                         *  visualmente do toggle "Mais campos" à direita. */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 8,
                            }}
                        >
                            <TouchableOpacity
                                onPress={handleExitAdvanced}
                                accessibilityRole="button"
                                accessibilityLabel="Voltar para modo simples"
                                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6, marginLeft: -6 }}
                            >
                                <Undo2 size={12} color={colors.text.secondary} />
                                <Text style={{ fontSize: 11, fontWeight: "500", color: colors.text.secondary }}>
                                    Voltar para modo simples
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={toggleAdvancedFields}
                                accessibilityRole="button"
                                accessibilityLabel={showAdvancedFields ? "Esconder campos avançados" : "Mostrar campos avançados"}
                                accessibilityState={{ expanded: showAdvancedFields }}
                                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
                            >
                                {showAdvancedFields ? (
                                    <ChevronUp size={12} color={colors.brand.primary} />
                                ) : (
                                    <ChevronDown size={12} color={colors.brand.primary} />
                                )}
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.brand.primary }}>
                                    {showAdvancedFields ? "Menos campos" : "Mais campos"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Linha 2: título condicional (compound only). */}
                        {isCompound ? (
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: colors.text.tertiary,
                                    letterSpacing: 0.6,
                                    textTransform: "uppercase",
                                    marginBottom: 8,
                                }}
                            >
                                Estrutura de uma rodada
                            </Text>
                        ) : null}
                        {scheme.map((s, idx) => (
                            <SetSchemeCard
                                key={`set-${idx}`}
                                set={s}
                                index={idx}
                                canRemove={scheme.length > 1}
                                showAdvancedFields={showAdvancedFields}
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
                                {isCompound ? "Adicionar fase" : "Adicionar série"}
                            </Text>
                        </TouchableOpacity>

                        {/* "Voltar para modo simples" foi movido pro topo da
                         *  lista (Fase 4.5c §3), separado visualmente do
                         *  toggle "Mais campos". */}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

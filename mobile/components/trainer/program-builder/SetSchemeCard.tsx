import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Copy, Minus, Plus, Trash2 } from "lucide-react-native";

import type { SetType, WorkoutSet } from "@kinevo/shared/types/prescription";
import { SET_TYPE_OPTIONS } from "@kinevo/shared/types/prescription";

import { colors } from "@/theme";

/** Cor da borda esquerda por tipo (Fase 4.5c §4). Mantém o card sem borda
 *  colorida quando o tipo é `normal` — comportamento atual byte-a-byte. */
const SET_TYPE_BORDER_COLOR: Record<SetType, string | null> = {
    normal: null,
    warmup: "#a1a1aa",   // zinc-400
    top: "#fb923c",      // orange-400
    backoff: "#38bdf8",  // sky-400
    drop: "#f43f5e",     // rose-500
    failure: "#dc2626",  // red-600
    cluster: "#8b5cf6",  // violet-500
    amrap: "#3b82f6",    // blue-500
};

interface SetSchemeCardProps {
    set: WorkoutSet;
    index: number;
    canRemove: boolean;
    /** Fase 4.5b — when false (default in the editor), RIR and Tempo rows are
     *  hidden to reduce visual density. The trainer reveals them via
     *  "+ Mais campos" in the editor header. */
    showAdvancedFields?: boolean;
    onUpdate: (patch: Partial<WorkoutSet>) => void;
    onDuplicate: () => void;
    onRemove: () => void;
}

const SET_TYPE_LABELS: Record<SetType, string> = {
    warmup: "Aquecimento",
    normal: "Normal",
    top: "Top",
    backoff: "Backoff",
    drop: "Drop",
    failure: "Falha",
    cluster: "Cluster",
    amrap: "AMRAP",
};

export function SetSchemeCard({
    set,
    index,
    canRemove,
    showAdvancedFields = false,
    onUpdate,
    onDuplicate,
    onRemove,
}: SetSchemeCardProps) {
    const usePct = set.weight_target_pct1rm !== null;
    const weightValue = usePct ? set.weight_target_pct1rm : set.weight_target_kg;

    const stepRest = (delta: number) => {
        Haptics.selectionAsync();
        const next = Math.max(0, set.rest_seconds + delta);
        onUpdate({ rest_seconds: next });
    };

    const stepRir = (delta: number) => {
        Haptics.selectionAsync();
        const current = set.rir ?? 0;
        const next = Math.max(0, current + delta);
        onUpdate({ rir: next });
    };

    const stepWeight = (delta: number) => {
        Haptics.selectionAsync();
        const current = weightValue ?? 0;
        const next = Math.max(0, current + delta);
        onUpdate(
            usePct
                ? { weight_target_pct1rm: next, weight_target_kg: null }
                : { weight_target_kg: next, weight_target_pct1rm: null },
        );
    };

    const toggleWeightUnit = () => {
        Haptics.selectionAsync();
        onUpdate(
            usePct
                ? { weight_target_pct1rm: null, weight_target_kg: weightValue }
                : { weight_target_kg: null, weight_target_pct1rm: weightValue },
        );
    };

    const leftBorderColor = SET_TYPE_BORDER_COLOR[set.set_type];

    return (
        <View
            style={{
                backgroundColor: colors.background.card,
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border.primary,
                // Borda esquerda colorida pra tipos != normal (Fase 4.5c §4).
                ...(leftBorderColor
                    ? { borderLeftWidth: 3, borderLeftColor: leftBorderColor }
                    : {}),
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
            }}
        >
            {/* Header: # + Tipo chips + ações */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: colors.brand.primaryLight,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                    }}
                >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.brand.primary }}>
                        {set.set_number}
                    </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary, flex: 1 }}>
                    Série {index + 1}
                </Text>
                {/* Ações com hit area mínima 44×44 (Apple HIG — Fase 4.5c §6).
                 *  Ícones aumentados pra 16px com fundo translúcido sutil. */}
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onDuplicate();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Duplicar linha ${index + 1}`}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 2,
                    }}
                >
                    <Copy size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        if (!canRemove) return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onRemove();
                    }}
                    disabled={!canRemove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover linha ${index + 1}`}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: canRemove ? 1 : 0.3,
                    }}
                >
                    <Trash2 size={16} color={colors.error.default} />
                </TouchableOpacity>
            </View>

            {/* Tipo (chips horizontais) */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {SET_TYPE_OPTIONS.map((t) => {
                    const active = set.set_type === t;
                    return (
                        <TouchableOpacity
                            key={t}
                            onPress={() => {
                                Haptics.selectionAsync();
                                onUpdate({ set_type: t });
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: active ? colors.brand.primary : "transparent",
                                borderWidth: 1,
                                borderColor: active ? colors.brand.primary : colors.border.secondary,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: "600",
                                    color: active ? colors.text.inverse : colors.text.secondary,
                                }}
                            >
                                {SET_TYPE_LABELS[t]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Reps (free text) */}
            <FieldRow label="Reps">
                <TextInput
                    value={set.reps}
                    onChangeText={(text) => onUpdate({ reps: text })}
                    placeholder="10"
                    placeholderTextColor={colors.text.quaternary}
                    accessibilityLabel={`Reps da série ${index + 1}`}
                    style={inputStyle}
                />
            </FieldRow>

            {/* Carga (stepper + toggle kg/%1RM) */}
            <FieldRow label="Carga">
                <Stepper
                    value={weightValue ?? 0}
                    suffix={usePct ? "%1RM" : "kg"}
                    onDec={() => stepWeight(usePct ? -5 : -2.5)}
                    onInc={() => stepWeight(usePct ? 5 : 2.5)}
                />
                <TouchableOpacity
                    onPress={toggleWeightUnit}
                    accessibilityRole="button"
                    accessibilityLabel="Alternar entre kg e % de 1RM"
                    style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        marginLeft: 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: colors.border.secondary,
                    }}
                >
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.text.tertiary }}>
                        {usePct ? "%1RM" : "kg"}
                    </Text>
                </TouchableOpacity>
            </FieldRow>

            {/* RIR (stepper) — escondido por default (Fase 4.5b) */}
            {showAdvancedFields ? (
                <FieldRow label="RIR">
                    <Stepper
                        value={set.rir ?? 0}
                        suffix=""
                        onDec={() => stepRir(-1)}
                        onInc={() => stepRir(1)}
                    />
                </FieldRow>
            ) : null}

            {/* Descanso (stepper) */}
            <FieldRow label="Descanso">
                <Stepper
                    value={set.rest_seconds}
                    suffix="s"
                    onDec={() => stepRest(-15)}
                    onInc={() => stepRest(15)}
                />
            </FieldRow>

            {/* Tempo (free text) — escondido por default (Fase 4.5b) */}
            {showAdvancedFields ? (
                <FieldRow label="Tempo">
                    <TextInput
                        value={set.tempo ?? ""}
                        onChangeText={(text) => onUpdate({ tempo: text || null })}
                        placeholder="3-1-1-0"
                        placeholderTextColor={colors.text.quaternary}
                        accessibilityLabel={`Tempo da série ${index + 1}`}
                        style={inputStyle}
                    />
                </FieldRow>
            ) : null}
        </View>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: colors.border.primary,
            }}
        >
            <Text
                style={{
                    width: 86,
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.text.tertiary,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                }}
            >
                {label}
            </Text>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>{children}</View>
        </View>
    );
}

function Stepper({
    value,
    suffix,
    onDec,
    onInc,
}: {
    value: number;
    suffix: string;
    onDec: () => void;
    onInc: () => void;
}) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
                onPress={onDec}
                accessibilityRole="button"
                accessibilityLabel="Diminuir"
                style={stepperButtonStyle}
            >
                <Minus size={14} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text
                style={{
                    minWidth: 56,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.text.primary,
                }}
            >
                {formatNumber(value)}
                {suffix ? ` ${suffix}` : ""}
            </Text>
            <TouchableOpacity
                onPress={onInc}
                accessibilityRole="button"
                accessibilityLabel="Aumentar"
                style={stepperButtonStyle}
            >
                <Plus size={14} color={colors.text.secondary} />
            </TouchableOpacity>
        </View>
    );
}

function formatNumber(n: number): string {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
}

const inputStyle = {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    paddingVertical: 4,
    paddingHorizontal: 0,
} as const;

const stepperButtonStyle = {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.background.inset,
    alignItems: "center" as const,
    justifyContent: "center" as const,
};

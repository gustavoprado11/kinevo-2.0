/**
 * EditCardioSheet — modal pra editar um bloco de cardio.
 *
 * V1: só mode 'continuous' (sem dropdown). Campos editáveis:
 *  - modality (string custom: "Esteira", "Bike", "Elíptico"…)
 *  - objective: 'time' | 'distance' (chips toggle)
 *  - target: number (label muda baseado no objective)
 *  - notes: optional multiline
 *
 * Save dispara onSave(cfg) com:
 *   { mode: 'continuous', modality, objective, target, notes }
 */
import React, { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";

const ACCENT = "#22C55E";

export type CardioObjective = "time" | "distance";

export interface CardioConfig {
    mode: "continuous";
    modality: string;
    objective: CardioObjective;
    target: number | null;
    notes: string;
}

export interface EditCardioSheetProps {
    visible: boolean;
    initialConfig: Partial<CardioConfig>;
    onSave: (cfg: CardioConfig) => void;
    onClose: () => void;
}

function coerceObjective(raw: unknown): CardioObjective {
    return raw === "distance" ? "distance" : "time";
}

function coerceTarget(raw: unknown): string {
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    return "";
}

export function EditCardioSheet({
    visible,
    initialConfig,
    onSave,
    onClose,
}: EditCardioSheetProps) {
    const colors = useV2Colors();
    const [modality, setModality] = useState(
        typeof initialConfig.modality === "string" ? initialConfig.modality : "",
    );
    const [objective, setObjective] = useState<CardioObjective>(
        coerceObjective(initialConfig.objective),
    );
    const [targetText, setTargetText] = useState(coerceTarget(initialConfig.target));
    const [notes, setNotes] = useState(
        typeof initialConfig.notes === "string" ? initialConfig.notes : "",
    );

    useEffect(() => {
        if (visible) {
            setModality(typeof initialConfig.modality === "string" ? initialConfig.modality : "");
            setObjective(coerceObjective(initialConfig.objective));
            setTargetText(coerceTarget(initialConfig.target));
            setNotes(typeof initialConfig.notes === "string" ? initialConfig.notes : "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        const parsed = parseFloat(targetText.replace(",", "."));
        const targetNum = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        onSave({
            mode: "continuous",
            modality: modality.trim(),
            objective,
            target: targetNum,
            notes: notes.trim(),
        });
    };

    const targetLabel = objective === "distance" ? "Distância (km)" : "Duração (min)";
    const targetPlaceholder = objective === "distance" ? "Ex: 5" : "Ex: 20";

    const renderChip = (label: string, value: CardioObjective) => {
        const active = objective === value;
        return (
            <TouchableOpacity
                key={value}
                onPress={() => {
                    Haptics.selectionAsync().catch(() => { });
                    setObjective(value);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Objetivo: ${label}`}
                accessibilityState={{ selected: active }}
                activeOpacity={0.85}
                style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? ACCENT : colors.border.default,
                    backgroundColor: active ? "rgba(34,197,94,0.10)" : colors.surface.card,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: active ? "700" : "500",
                        color: active ? ACCENT : colors.text.secondary,
                    }}
                >
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
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
                    <Pressable
                        onPress={() => { }}
                        style={{
                            backgroundColor: colors.surface.canvas,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            paddingBottom: 8,
                            maxHeight: "90%",
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
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Heart size={18} color={ACCENT} strokeWidth={2.2} />
                                    <Text
                                        style={{
                                            fontSize: 18,
                                            fontWeight: "700",
                                            color: colors.text.primary,
                                        }}
                                    >
                                        Editar cardio
                                    </Text>
                                </View>
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

                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                style={{ marginTop: 8 }}
                            >
                                {/* Modalidade */}
                                <View style={{ marginBottom: 14 }}>
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: colors.text.secondary,
                                            textTransform: "uppercase",
                                            letterSpacing: 0.8,
                                            marginBottom: 6,
                                        }}
                                    >
                                        Modalidade
                                    </Text>
                                    <TextInput
                                        value={modality}
                                        onChangeText={setModality}
                                        autoFocus
                                        placeholder="Ex: Esteira, Bike, Elíptico"
                                        placeholderTextColor={colors.text.tertiary}
                                        style={{
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            paddingHorizontal: 12,
                                            paddingVertical: 12,
                                            fontSize: 15,
                                            color: colors.text.primary,
                                        }}
                                    />
                                </View>

                                {/* Objetivo */}
                                <View style={{ marginBottom: 14 }}>
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: colors.text.secondary,
                                            textTransform: "uppercase",
                                            letterSpacing: 0.8,
                                            marginBottom: 6,
                                        }}
                                    >
                                        Objetivo
                                    </Text>
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                        {renderChip("Tempo", "time")}
                                        {renderChip("Distância", "distance")}
                                    </View>
                                </View>

                                {/* Target */}
                                <View style={{ marginBottom: 14 }}>
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: colors.text.secondary,
                                            textTransform: "uppercase",
                                            letterSpacing: 0.8,
                                            marginBottom: 6,
                                        }}
                                    >
                                        {targetLabel}
                                    </Text>
                                    <TextInput
                                        value={targetText}
                                        onChangeText={setTargetText}
                                        placeholder={targetPlaceholder}
                                        placeholderTextColor={colors.text.tertiary}
                                        keyboardType="decimal-pad"
                                        style={{
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            paddingHorizontal: 12,
                                            paddingVertical: 12,
                                            fontSize: 15,
                                            color: colors.text.primary,
                                        }}
                                    />
                                </View>

                                {/* Notes */}
                                <View style={{ marginBottom: 16 }}>
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: colors.text.secondary,
                                            textTransform: "uppercase",
                                            letterSpacing: 0.8,
                                            marginBottom: 6,
                                        }}
                                    >
                                        Observações (opcional)
                                    </Text>
                                    <TextInput
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        placeholder="Ex: Inclinação 5%, FC alvo 130-150bpm"
                                        placeholderTextColor={colors.text.tertiary}
                                        textAlignVertical="top"
                                        style={{
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            padding: 12,
                                            minHeight: 70,
                                            fontSize: 15,
                                            lineHeight: 20,
                                            color: colors.text.primary,
                                        }}
                                    />
                                </View>
                            </ScrollView>

                            {/* Footer */}
                            <View style={{ flexDirection: "row", gap: 12, paddingBottom: 8 }}>
                                <TouchableOpacity
                                    onPress={onClose}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancelar"
                                    style={{
                                        flex: 1,
                                        height: 48,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: 14,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: "600",
                                            color: colors.text.secondary,
                                        }}
                                    >
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSave}
                                    accessibilityRole="button"
                                    accessibilityLabel="Salvar cardio"
                                    activeOpacity={0.85}
                                    style={{ flex: 2, borderRadius: 14, overflow: "hidden" }}
                                >
                                    <LinearGradient
                                        colors={[colors.purple[500], colors.purple[700]]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{
                                            height: 48,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 15,
                                                fontWeight: "700",
                                                color: "#FFFFFF",
                                            }}
                                        >
                                            Salvar
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

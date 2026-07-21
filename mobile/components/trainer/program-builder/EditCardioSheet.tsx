/**
 * EditCardioSheet — modal pra editar um bloco de cardio.
 *
 * Grava o schema CANÔNICO de shared/types/workout-items.ts (o mesmo do web e
 * do player do aluno): equipment (enum), objective time/distance →
 * duration_minutes/distance_km, intensity e notes. Lê também o legado mobile
 * (modality/target) e o migra no save (helpers em cardio-config.ts).
 *
 * Protocolo INTERVALADO (criado no web) não é editável aqui: o sheet mostra o
 * resumo e preserva mode/intervals no merge — edita só equipment/intensity/notes.
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
import { Heart, X, Zap } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";
import {
    CARDIO_EQUIPMENT_LABELS,
    CARDIO_EQUIPMENT_OPTIONS,
    type CardioEquipment,
    type CardioObjective,
} from "@kinevo/shared/types/workout-items";
import { buildCardioConfig, parseCardioConfig } from "./cardio-config";

const ACCENT = "#22C55E";

export interface EditCardioSheetProps {
    visible: boolean;
    /** item_config cru do item (canônico ou legado mobile). */
    initialConfig: Record<string, unknown>;
    /** Recebe o item_config completo já mesclado/migrado, pronto pro updateItem. */
    onSave: (cfg: Record<string, unknown>) => void;
    onClose: () => void;
}

export function EditCardioSheet({
    visible,
    initialConfig,
    onSave,
    onClose,
}: EditCardioSheetProps) {
    const colors = useV2Colors();
    const parsed = parseCardioConfig(initialConfig);
    const [equipment, setEquipment] = useState<CardioEquipment | null>(parsed.equipment);
    const [objective, setObjective] = useState<CardioObjective>(parsed.objective);
    const [targetText, setTargetText] = useState(parsed.target !== null ? String(parsed.target) : "");
    const [intensity, setIntensity] = useState(parsed.intensity);
    const [notes, setNotes] = useState(parsed.notes);
    const isInterval = parsed.isInterval;
    const isPhased = parsed.isPhased;

    useEffect(() => {
        if (visible) {
            const p = parseCardioConfig(initialConfig);
            setEquipment(p.equipment);
            setObjective(p.objective);
            setTargetText(p.target !== null ? String(p.target) : "");
            setIntensity(p.intensity);
            setNotes(p.notes);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        const parsedTarget = parseFloat(targetText.replace(",", "."));
        const targetNum = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null;
        onSave(buildCardioConfig(initialConfig, {
            equipment,
            objective,
            target: targetNum,
            intensity,
            notes,
        }));
    };

    const targetLabel = objective === "distance" ? "Distância (km)" : "Duração (min)";
    const targetPlaceholder = objective === "distance" ? "Ex: 5" : "Ex: 20";

    const fieldLabelStyle = {
        fontSize: 11,
        fontWeight: "700" as const,
        color: colors.text.secondary,
        textTransform: "uppercase" as const,
        letterSpacing: 0.8,
        marginBottom: 6,
    };

    const inputStyle = {
        backgroundColor: colors.surface.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.text.primary,
    };

    const renderObjectiveChip = (label: string, value: CardioObjective) => {
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

    const renderEquipmentChip = (value: CardioEquipment) => {
        const active = equipment === value;
        return (
            <TouchableOpacity
                key={value}
                onPress={() => {
                    Haptics.selectionAsync().catch(() => { });
                    setEquipment(active ? null : value);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Equipamento: ${CARDIO_EQUIPMENT_LABELS[value]}`}
                accessibilityState={{ selected: active }}
                activeOpacity={0.85}
                style={{
                    height: 36,
                    paddingHorizontal: 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: active ? ACCENT : colors.border.default,
                    backgroundColor: active ? "rgba(34,197,94,0.10)" : colors.surface.card,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                }}
            >
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: active ? "700" : "500",
                        color: active ? ACCENT : colors.text.secondary,
                    }}
                >
                    {CARDIO_EQUIPMENT_LABELS[value]}
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
                behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                                {/* Equipamento */}
                                <View style={{ marginBottom: 14 }}>
                                    <Text style={fieldLabelStyle}>Equipamento</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        <View style={{ flexDirection: "row" }}>
                                            {CARDIO_EQUIPMENT_OPTIONS.map(renderEquipmentChip)}
                                        </View>
                                    </ScrollView>
                                </View>

                                {isInterval || isPhased ? (
                                    /* Estrutura definida no web: preservada, não editável aqui */
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 8,
                                            backgroundColor: colors.surface.card,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: colors.border.default,
                                            padding: 12,
                                            marginBottom: 14,
                                        }}
                                    >
                                        <Zap size={16} color={ACCENT} strokeWidth={2.2} />
                                        <Text
                                            style={{
                                                flex: 1,
                                                fontSize: 13,
                                                lineHeight: 18,
                                                color: colors.text.secondary,
                                            }}
                                        >
                                            {isPhased
                                                ? "Treino por fases definido no painel web — as fases e intensidades são preservadas. Aqui você edita equipamento e observações."
                                                : "Protocolo intervalado definido no painel web — os intervalos são preservados. Aqui você edita equipamento, intensidade e observações."}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {/* Objetivo */}
                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={fieldLabelStyle}>Objetivo</Text>
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                {renderObjectiveChip("Tempo", "time")}
                                                {renderObjectiveChip("Distância", "distance")}
                                            </View>
                                        </View>

                                        {/* Target */}
                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={fieldLabelStyle}>{targetLabel}</Text>
                                            <TextInput
                                                value={targetText}
                                                onChangeText={setTargetText}
                                                placeholder={targetPlaceholder}
                                                placeholderTextColor={colors.text.tertiary}
                                                keyboardType="decimal-pad"
                                                style={inputStyle}
                                            />
                                        </View>
                                    </>
                                )}

                                {/* Intensidade — no phased ela é derivada das fases (web) */}
                                {!isPhased ? (
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={fieldLabelStyle}>Intensidade (opcional)</Text>
                                        <TextInput
                                            value={intensity}
                                            onChangeText={setIntensity}
                                            placeholder="Ex: Zona 2, RPE 6, 130-150bpm"
                                            placeholderTextColor={colors.text.tertiary}
                                            style={inputStyle}
                                        />
                                    </View>
                                ) : null}

                                {/* Notes */}
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={fieldLabelStyle}>Observações (opcional)</Text>
                                    <TextInput
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        placeholder="Ex: Inclinação 5%, aquecer 3min antes"
                                        placeholderTextColor={colors.text.tertiary}
                                        textAlignVertical="top"
                                        style={{
                                            ...inputStyle,
                                            padding: 12,
                                            minHeight: 70,
                                            lineHeight: 20,
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

/**
 * EditCardioSheet — modal pra editar um bloco de cardio.
 *
 * Grava o schema CANÔNICO de shared/types/workout-items.ts (o mesmo do web e
 * do player do aluno). Paridade de prescrição com o web builder: modo
 * Contínuo|Intervalado (protocolos nomeados preenchem work/rest/rounds +
 * alvo sugerido) e intensidade estruturada Livre|Zona|FC|RPE|Pace — a string
 * `intensity` é derivada do alvo no save (FCmáx do aluno quando conhecida).
 * Lê também o legado mobile (modality/target) e o migra no save (helpers em
 * cardio-config.ts).
 *
 * Treino POR FASES (autorado no web) não é editável aqui: o sheet mostra o
 * aviso e preserva mode/segments/derivados — edita só equipment/notes.
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
    type CardioIntensityTarget,
    type CardioIntervalConfig,
    type CardioObjective,
} from "@kinevo/shared/types/workout-items";
import { HR_ZONES, resolveZoneBpm, zonePctLabel } from "@kinevo/shared/lib/cardio/zones";
import { CARDIO_PROTOCOLS, protocolMatchesIntervals } from "@kinevo/shared/lib/cardio/interval-protocols";
import { buildCardioConfig, hasWeeklyProgression, parseCardioConfig, type CardioSheetMode } from "./cardio-config";

const ACCENT = "#22C55E";

type IntensityType = "" | "zone" | "hr" | "rpe" | "pace";

export interface EditCardioSheetProps {
    visible: boolean;
    /** item_config cru do item (canônico ou legado mobile). */
    initialConfig: Record<string, unknown>;
    /** FCmáx do aluno (programa atribuído) — resolve zonas em bpm na string derivada. */
    maxHrBpm?: number | null;
    /** Recebe o item_config completo já mesclado/migrado, pronto pro updateItem. */
    onSave: (cfg: Record<string, unknown>) => void;
    onClose: () => void;
}

function targetToState(target: CardioIntensityTarget | null) {
    if (!target) return { type: "" as IntensityType, zone: null as number | null, hrMin: "", hrMax: "", rpe: "", pace: "" };
    return {
        type: target.type as IntensityType,
        zone: target.type === "zone" ? (target.zone ?? null) : null,
        hrMin: target.type === "hr" && target.hr_min_bpm != null ? String(target.hr_min_bpm) : "",
        hrMax: target.type === "hr" && target.hr_max_bpm != null ? String(target.hr_max_bpm) : "",
        rpe: target.type === "rpe" && target.rpe != null ? String(target.rpe) : "",
        pace: target.type === "pace" ? (target.pace_min_per_km ?? "") : "",
    };
}

export function EditCardioSheet({
    visible,
    initialConfig,
    maxHrBpm = null,
    onSave,
    onClose,
}: EditCardioSheetProps) {
    const colors = useV2Colors();
    const parsed = parseCardioConfig(initialConfig);
    const [mode, setMode] = useState<CardioSheetMode>(parsed.mode);
    const [equipment, setEquipment] = useState<CardioEquipment | null>(parsed.equipment);
    const [objective, setObjective] = useState<CardioObjective>(parsed.objective);
    const [targetText, setTargetText] = useState(parsed.target !== null ? String(parsed.target) : "");
    const [workText, setWorkText] = useState(parsed.intervals ? String(parsed.intervals.work_seconds) : "30");
    const [restText, setRestText] = useState(parsed.intervals ? String(parsed.intervals.rest_seconds) : "30");
    const [roundsText, setRoundsText] = useState(parsed.intervals ? String(parsed.intervals.rounds) : "8");
    const initialTarget = targetToState(parsed.intensityTarget);
    const [intensityType, setIntensityType] = useState<IntensityType>(initialTarget.type);
    const [zone, setZone] = useState<number | null>(initialTarget.zone);
    const [hrMinText, setHrMinText] = useState(initialTarget.hrMin);
    const [hrMaxText, setHrMaxText] = useState(initialTarget.hrMax);
    const [rpeText, setRpeText] = useState(initialTarget.rpe);
    const [paceText, setPaceText] = useState(initialTarget.pace);
    const [intensity, setIntensity] = useState(parsed.intensity);
    const [notes, setNotes] = useState(parsed.notes);
    const isPhased = parsed.isPhased;

    useEffect(() => {
        if (visible) {
            const p = parseCardioConfig(initialConfig);
            setMode(p.mode);
            setEquipment(p.equipment);
            setObjective(p.objective);
            setTargetText(p.target !== null ? String(p.target) : "");
            setWorkText(p.intervals ? String(p.intervals.work_seconds) : "30");
            setRestText(p.intervals ? String(p.intervals.rest_seconds) : "30");
            setRoundsText(p.intervals ? String(p.intervals.rounds) : "8");
            const t = targetToState(p.intensityTarget);
            setIntensityType(t.type);
            setZone(t.zone);
            setHrMinText(t.hrMin);
            setHrMaxText(t.hrMax);
            setRpeText(t.rpe);
            setPaceText(t.pace);
            setIntensity(p.intensity);
            setNotes(p.notes);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const parseIntPositive = (raw: string): number | null => {
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    };

    const currentIntervals = (): CardioIntervalConfig => ({
        work_seconds: parseIntPositive(workText) ?? 30,
        rest_seconds: Math.max(0, parseInt(restText, 10) || 0),
        rounds: parseIntPositive(roundsText) ?? 8,
    });

    // Selo visual: o chip acende quando os números atuais batem com o protocolo.
    const matchedProtocolKey = mode === "interval"
        ? (CARDIO_PROTOCOLS.find((p) => protocolMatchesIntervals(p.key, currentIntervals()))?.key ?? null)
        : null;

    const applyProtocol = (key: string) => {
        const p = CARDIO_PROTOCOLS.find((x) => x.key === key);
        if (!p) return;
        Haptics.selectionAsync().catch(() => { });
        setWorkText(String(p.intervals.work_seconds));
        setRestText(String(p.intervals.rest_seconds));
        setRoundsText(String(p.intervals.rounds));
        // Alvo sugerido acompanha o protocolo (editável depois).
        const t = targetToState(p.suggested_target);
        setIntensityType(t.type);
        setZone(t.zone);
        setHrMinText(t.hrMin);
        setHrMaxText(t.hrMax);
        setRpeText(t.rpe);
        setPaceText(t.pace);
    };

    const buildIntensityTarget = (): CardioIntensityTarget | null => {
        if (intensityType === "zone" && zone != null) {
            return { type: "zone", zone: zone as 1 | 2 | 3 | 4 | 5 };
        }
        if (intensityType === "hr") {
            const min = parseIntPositive(hrMinText);
            const max = parseIntPositive(hrMaxText);
            if (min != null && max != null && min <= max) return { type: "hr", hr_min_bpm: min, hr_max_bpm: max };
            return null;
        }
        if (intensityType === "rpe") {
            const r = parseIntPositive(rpeText);
            if (r != null && r >= 1 && r <= 10) return { type: "rpe", rpe: r };
            return null;
        }
        if (intensityType === "pace" && paceText.trim()) {
            return { type: "pace", pace_min_per_km: paceText.trim() };
        }
        return null;
    };

    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        const parsedTarget = parseFloat(targetText.replace(",", "."));
        const targetNum = Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null;
        const structured = buildIntensityTarget();
        onSave(buildCardioConfig(initialConfig, {
            mode,
            equipment,
            objective,
            target: targetNum,
            intervals: mode === "interval" ? currentIntervals() : null,
            protocolKey: matchedProtocolKey,
            intensityTarget: structured,
            // Texto livre só vale quando não há alvo estruturado.
            intensity: intensityType === "" ? intensity : "",
            notes,
        }, maxHrBpm));
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

    const smallInputStyle = {
        ...inputStyle,
        flex: 1,
        textAlign: "center" as const,
        paddingHorizontal: 8,
    };

    const chip = (label: string, active: boolean, onPress: () => void, key?: string, accessibility?: string) => (
        <TouchableOpacity
            key={key ?? label}
            onPress={() => {
                Haptics.selectionAsync().catch(() => { });
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={accessibility ?? label}
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
                {label}
            </Text>
        </TouchableOpacity>
    );

    const segmentChip = (label: string, active: boolean, onPress: () => void, key?: string) => (
        <TouchableOpacity
            key={key ?? label}
            onPress={() => {
                Haptics.selectionAsync().catch(() => { });
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
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

    const zoneBpm = zone != null ? resolveZoneBpm(zone as 1 | 2 | 3 | 4 | 5, maxHrBpm) : null;
    const zoneHint = zone != null
        ? (zoneBpm ? `${zoneBpm.min}–${zoneBpm.max} bpm` : zonePctLabel(zone as 1 | 2 | 3 | 4 | 5))
        : null;

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
                                            {CARDIO_EQUIPMENT_OPTIONS.map((value) =>
                                                chip(
                                                    CARDIO_EQUIPMENT_LABELS[value],
                                                    equipment === value,
                                                    () => setEquipment(equipment === value ? null : value),
                                                    value,
                                                    `Equipamento: ${CARDIO_EQUIPMENT_LABELS[value]}`,
                                                ),
                                            )}
                                        </View>
                                    </ScrollView>
                                </View>

                                {hasWeeklyProgression(initialConfig) ? (
                                    /* Progressão semanal (web/IA): preservada — aqui edita-se a base */
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
                                            Este bloco tem progressão semanal definida no painel
                                            web — as semanas personalizadas são preservadas. Aqui
                                            você edita a base (semana 1).
                                        </Text>
                                    </View>
                                ) : null}

                                {isPhased ? (
                                    /* Estrutura por fases (web): preservada, não editável aqui */
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
                                            Treino por fases definido no painel web — as fases e
                                            intensidades são preservadas. Aqui você edita
                                            equipamento e observações.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {/* Modo */}
                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={fieldLabelStyle}>Modo</Text>
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                {segmentChip("Contínuo", mode === "continuous", () => setMode("continuous"), "continuous")}
                                                {segmentChip("Intervalado", mode === "interval", () => setMode("interval"), "interval")}
                                            </View>
                                        </View>

                                        {mode === "continuous" ? (
                                            <>
                                                {/* Objetivo */}
                                                <View style={{ marginBottom: 14 }}>
                                                    <Text style={fieldLabelStyle}>Objetivo</Text>
                                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                                        {segmentChip("Tempo", objective === "time", () => setObjective("time"), "time")}
                                                        {segmentChip("Distância", objective === "distance", () => setObjective("distance"), "distance")}
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
                                        ) : (
                                            <>
                                                {/* Protocolos nomeados */}
                                                <View style={{ marginBottom: 14 }}>
                                                    <Text style={fieldLabelStyle}>Protocolo</Text>
                                                    <ScrollView
                                                        horizontal
                                                        showsHorizontalScrollIndicator={false}
                                                        keyboardShouldPersistTaps="handled"
                                                    >
                                                        <View style={{ flexDirection: "row" }}>
                                                            {CARDIO_PROTOCOLS.map((p) =>
                                                                chip(
                                                                    p.label,
                                                                    matchedProtocolKey === p.key,
                                                                    () => applyProtocol(p.key),
                                                                    p.key,
                                                                    `Protocolo: ${p.label} — ${p.description}`,
                                                                ),
                                                            )}
                                                        </View>
                                                    </ScrollView>
                                                </View>

                                                {/* Work / Rest / Rounds */}
                                                <View style={{ marginBottom: 14 }}>
                                                    <Text style={fieldLabelStyle}>Estrutura</Text>
                                                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                                                        <View style={{ flex: 1 }}>
                                                            <TextInput
                                                                value={workText}
                                                                onChangeText={setWorkText}
                                                                placeholder="30"
                                                                placeholderTextColor={colors.text.tertiary}
                                                                keyboardType="number-pad"
                                                                accessibilityLabel="Trabalho (segundos)"
                                                                style={smallInputStyle}
                                                            />
                                                            <Text style={{ fontSize: 10, color: colors.text.tertiary, textAlign: "center", marginTop: 4 }}>
                                                                trabalho (s)
                                                            </Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <TextInput
                                                                value={restText}
                                                                onChangeText={setRestText}
                                                                placeholder="30"
                                                                placeholderTextColor={colors.text.tertiary}
                                                                keyboardType="number-pad"
                                                                accessibilityLabel="Descanso (segundos)"
                                                                style={smallInputStyle}
                                                            />
                                                            <Text style={{ fontSize: 10, color: colors.text.tertiary, textAlign: "center", marginTop: 4 }}>
                                                                descanso (s)
                                                            </Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <TextInput
                                                                value={roundsText}
                                                                onChangeText={setRoundsText}
                                                                placeholder="8"
                                                                placeholderTextColor={colors.text.tertiary}
                                                                keyboardType="number-pad"
                                                                accessibilityLabel="Rounds"
                                                                style={smallInputStyle}
                                                            />
                                                            <Text style={{ fontSize: 10, color: colors.text.tertiary, textAlign: "center", marginTop: 4 }}>
                                                                rounds
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* Intensidade — no phased ela é derivada das fases (web) */}
                                {!isPhased ? (
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={fieldLabelStyle}>Intensidade</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            keyboardShouldPersistTaps="handled"
                                            style={{ marginBottom: 8 }}
                                        >
                                            <View style={{ flexDirection: "row" }}>
                                                {chip("Livre", intensityType === "", () => setIntensityType(""), "free", "Intensidade: texto livre")}
                                                {chip("Zona", intensityType === "zone", () => setIntensityType("zone"), "zone", "Intensidade: zona de FC")}
                                                {chip("FC", intensityType === "hr", () => setIntensityType("hr"), "hr", "Intensidade: faixa de FC")}
                                                {chip("RPE", intensityType === "rpe", () => setIntensityType("rpe"), "rpe", "Intensidade: RPE")}
                                                {chip("Pace", intensityType === "pace", () => setIntensityType("pace"), "pace", "Intensidade: pace")}
                                            </View>
                                        </ScrollView>

                                        {intensityType === "" && (
                                            <TextInput
                                                value={intensity}
                                                onChangeText={setIntensity}
                                                placeholder="Ex: Zona 2, RPE 6, 130-150bpm"
                                                placeholderTextColor={colors.text.tertiary}
                                                style={inputStyle}
                                            />
                                        )}

                                        {intensityType === "zone" && (
                                            <View>
                                                <View style={{ flexDirection: "row" }}>
                                                    {HR_ZONES.map((z) =>
                                                        chip(
                                                            `Z${z.zone}`,
                                                            zone === z.zone,
                                                            () => setZone(z.zone),
                                                            `z${z.zone}`,
                                                            `Zona ${z.zone}: ${z.label}`,
                                                        ),
                                                    )}
                                                </View>
                                                {zoneHint ? (
                                                    <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 8 }}>
                                                        {HR_ZONES.find((z) => z.zone === zone)?.label} · {zoneHint}
                                                        {!zoneBpm ? " — cadastre a FCmáx do aluno para ver em bpm" : ""}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        )}

                                        {intensityType === "hr" && (
                                            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                                                <TextInput
                                                    value={hrMinText}
                                                    onChangeText={setHrMinText}
                                                    placeholder="130"
                                                    placeholderTextColor={colors.text.tertiary}
                                                    keyboardType="number-pad"
                                                    accessibilityLabel="FC mínima (bpm)"
                                                    style={smallInputStyle}
                                                />
                                                <Text style={{ color: colors.text.tertiary }}>–</Text>
                                                <TextInput
                                                    value={hrMaxText}
                                                    onChangeText={setHrMaxText}
                                                    placeholder="150"
                                                    placeholderTextColor={colors.text.tertiary}
                                                    keyboardType="number-pad"
                                                    accessibilityLabel="FC máxima (bpm)"
                                                    style={smallInputStyle}
                                                />
                                                <Text style={{ fontSize: 12, color: colors.text.tertiary }}>bpm</Text>
                                            </View>
                                        )}

                                        {intensityType === "rpe" && (
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                <TextInput
                                                    value={rpeText}
                                                    onChangeText={setRpeText}
                                                    placeholder="7"
                                                    placeholderTextColor={colors.text.tertiary}
                                                    keyboardType="number-pad"
                                                    accessibilityLabel="RPE (1 a 10)"
                                                    style={{ ...smallInputStyle, flex: 0, width: 72 }}
                                                />
                                                <Text style={{ fontSize: 12, color: colors.text.tertiary }}>de 1 a 10</Text>
                                            </View>
                                        )}

                                        {intensityType === "pace" && (
                                            <TextInput
                                                value={paceText}
                                                onChangeText={setPaceText}
                                                placeholder="Ex: 5:30 ou 5:30-6:00"
                                                placeholderTextColor={colors.text.tertiary}
                                                accessibilityLabel="Pace (min/km)"
                                                style={inputStyle}
                                            />
                                        )}
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

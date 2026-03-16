import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { Plus, X } from "lucide-react-native";
import type { PrescriptionProfile } from "../../../hooks/usePrescriptionData";

const TRAINING_LEVELS = [
    { value: "beginner", label: "Iniciante" },
    { value: "intermediate", label: "Intermediário" },
    { value: "advanced", label: "Avançado" },
] as const;

const GOALS = [
    { value: "hypertrophy", label: "Hipertrofia" },
    { value: "weight_loss", label: "Perda de Peso" },
    { value: "performance", label: "Performance" },
    { value: "health", label: "Saúde" },
] as const;

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EQUIPMENT_OPTIONS = [
    { value: "academia_completa", label: "Academia Completa" },
    { value: "home_gym_basico", label: "Home Gym Básico" },
    { value: "home_gym_completo", label: "Home Gym Completo" },
    { value: "ao_ar_livre", label: "Ao Ar Livre" },
    { value: "apenas_peso_corporal", label: "Peso Corporal" },
];

const AI_MODES = [
    { value: "auto", label: "Automático", desc: "IA decide o nível de autonomia" },
    { value: "copilot", label: "Copiloto", desc: "IA sugere, você edita" },
    { value: "assistant", label: "Assistente", desc: "Você compõe, IA apoia" },
] as const;

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

interface Props {
    existingProfile: PrescriptionProfile | null;
    isSaving: boolean;
    onSubmit: (data: {
        training_level: string;
        goal: string;
        available_days: number[];
        session_duration_minutes: number;
        available_equipment: string[];
        medical_restrictions: { description: string; severity?: string }[];
        ai_mode: string;
    }) => void;
}

export function PrescriptionProfileForm({ existingProfile, isSaving, onSubmit }: Props) {
    const [trainingLevel, setTrainingLevel] = useState(existingProfile?.training_level || "beginner");
    const [goal, setGoal] = useState(existingProfile?.goal || "hypertrophy");
    const [availableDays, setAvailableDays] = useState<number[]>(existingProfile?.available_days || []);
    const [sessionDuration, setSessionDuration] = useState(existingProfile?.session_duration_minutes || 60);
    const [equipment, setEquipment] = useState<string[]>(existingProfile?.available_equipment || []);
    const [restrictions, setRestrictions] = useState<{ description: string; severity?: string }[]>(
        existingProfile?.medical_restrictions || []
    );
    const [aiMode, setAiMode] = useState(existingProfile?.ai_mode || "copilot");
    const [newRestriction, setNewRestriction] = useState("");
    const [error, setError] = useState<string | null>(null);

    const toggleDay = (day: number) => {
        setAvailableDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
        );
    };

    const toggleEquipment = (eq: string) => {
        setEquipment((prev) =>
            prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
        );
    };

    const addRestriction = () => {
        const text = newRestriction.trim();
        if (!text) return;
        setRestrictions((prev) => [...prev, { description: text, severity: "moderate" }]);
        setNewRestriction("");
    };

    const removeRestriction = (idx: number) => {
        setRestrictions((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        if (availableDays.length === 0) {
            setError("Selecione pelo menos 1 dia disponível.");
            return;
        }
        if (availableDays.length > 6) {
            setError("O máximo é 6 dias por semana.");
            return;
        }
        setError(null);
        onSubmit({
            training_level: trainingLevel,
            goal,
            available_days: availableDays,
            session_duration_minutes: sessionDuration,
            available_equipment: equipment,
            medical_restrictions: restrictions,
            ai_mode: aiMode,
        });
    };

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {/* Training Level */}
            <SectionLabel>Nível de Treino</SectionLabel>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
                {TRAINING_LEVELS.map((lvl) => (
                    <TouchableOpacity
                        key={lvl.value}
                        onPress={() => setTrainingLevel(lvl.value)}
                        style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: 12,
                            alignItems: "center",
                            backgroundColor: trainingLevel === lvl.value ? "#7c3aed" : "#ffffff",
                            borderWidth: trainingLevel === lvl.value ? 0 : 1,
                            borderColor: "#e2e8f0",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: trainingLevel === lvl.value ? "#ffffff" : "#475569",
                            }}
                        >
                            {lvl.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Goal */}
            <SectionLabel>Objetivo</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {GOALS.map((g) => (
                    <TouchableOpacity
                        key={g.value}
                        onPress={() => setGoal(g.value)}
                        style={{
                            width: "48%",
                            paddingVertical: 12,
                            borderRadius: 12,
                            alignItems: "center",
                            backgroundColor: goal === g.value ? "#7c3aed" : "#ffffff",
                            borderWidth: goal === g.value ? 0 : 1,
                            borderColor: "#e2e8f0",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: goal === g.value ? "#ffffff" : "#475569",
                            }}
                        >
                            {g.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Available Days */}
            <SectionLabel>Dias Disponíveis</SectionLabel>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
                {DAY_NAMES.map((name, idx) => {
                    const selected = availableDays.includes(idx);
                    return (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => toggleDay(idx)}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                borderRadius: 10,
                                alignItems: "center",
                                backgroundColor: selected ? "#7c3aed" : "#ffffff",
                                borderWidth: selected ? 0 : 1,
                                borderColor: "#e2e8f0",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: "600",
                                    color: selected ? "#ffffff" : "#475569",
                                }}
                            >
                                {name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Session Duration */}
            <SectionLabel>Duração da Sessão</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {DURATION_OPTIONS.map((d) => (
                    <TouchableOpacity
                        key={d}
                        onPress={() => setSessionDuration(d)}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: sessionDuration === d ? "#7c3aed" : "#ffffff",
                            borderWidth: sessionDuration === d ? 0 : 1,
                            borderColor: "#e2e8f0",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: sessionDuration === d ? "#ffffff" : "#475569",
                            }}
                        >
                            {d}min
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Equipment */}
            <SectionLabel>Equipamentos Disponíveis</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                    const selected = equipment.includes(eq.value);
                    return (
                        <TouchableOpacity
                            key={eq.value}
                            onPress={() => toggleEquipment(eq.value)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 10,
                                backgroundColor: selected ? "#f3f0ff" : "#ffffff",
                                borderWidth: selected ? 2 : 1,
                                borderColor: selected ? "#7c3aed" : "#e2e8f0",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "500",
                                    color: selected ? "#7c3aed" : "#475569",
                                }}
                            >
                                {eq.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Medical Restrictions */}
            <SectionLabel>Restrições Médicas</SectionLabel>
            {restrictions.map((r, idx) => (
                <View
                    key={idx}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#ffffff",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                    }}
                >
                    <Text style={{ flex: 1, fontSize: 14, color: "#1a1a2e" }}>{r.description}</Text>
                    <TouchableOpacity onPress={() => removeRestriction(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ))}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#ffffff",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    marginBottom: 20,
                }}
            >
                <TextInput
                    value={newRestriction}
                    onChangeText={setNewRestriction}
                    placeholder="Ex: Dor no joelho direito"
                    placeholderTextColor="#94a3b8"
                    style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: "#1a1a2e" }}
                    returnKeyType="done"
                    onSubmitEditing={addRestriction}
                />
                <TouchableOpacity onPress={addRestriction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Plus size={20} color="#7c3aed" />
                </TouchableOpacity>
            </View>

            {/* AI Mode */}
            <SectionLabel>Modo da IA</SectionLabel>
            {AI_MODES.map((mode) => (
                <TouchableOpacity
                    key={mode.value}
                    onPress={() => setAiMode(mode.value)}
                    style={{
                        backgroundColor: aiMode === mode.value ? "#f3f0ff" : "#ffffff",
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 8,
                        borderWidth: aiMode === mode.value ? 2 : 1,
                        borderColor: aiMode === mode.value ? "#7c3aed" : "#e2e8f0",
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1a1a2e" }}>
                        {mode.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{mode.desc}</Text>
                </TouchableOpacity>
            ))}

            {/* Error */}
            {error && (
                <Text style={{ fontSize: 13, color: "#ef4444", marginTop: 12, textAlign: "center" }}>
                    {error}
                </Text>
            )}

            {/* Submit */}
            <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSaving}
                style={{
                    backgroundColor: "#7c3aed",
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    marginTop: 20,
                }}
                activeOpacity={0.7}
            >
                {isSaving ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                        Gerar Programa com IA
                    </Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            style={{
                fontSize: 12,
                fontWeight: "600",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
            }}
        >
            {children}
        </Text>
    );
}

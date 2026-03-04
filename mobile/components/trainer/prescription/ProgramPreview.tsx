import React from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { Check, X, Sparkles, AlertTriangle } from "lucide-react-native";

interface WorkoutItem {
    exercise_name: string;
    sets: number;
    reps: string;
    rest_seconds?: number;
}

interface Workout {
    name: string;
    items: WorkoutItem[];
}

interface ProgramOutput {
    program_name?: string;
    duration_weeks?: number;
    workouts: Workout[];
    reasoning?: {
        rationale?: string;
        confidence_score?: number;
    };
}

interface Props {
    output: ProgramOutput;
    source: string;
    violations?: any[];
    isApproving: boolean;
    onApprove: () => void;
    onDiscard: () => void;
}

export function ProgramPreview({ output, source, violations, isApproving, onApprove, onDiscard }: Props) {
    const hasWarnings = violations && violations.length > 0;

    return (
        <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#1a1a2e", flex: 1 }}>
                        {output.program_name || "Programa Gerado"}
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: source === "llm" ? "#f3f0ff" : "#fef3c7",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                            gap: 4,
                        }}
                    >
                        <Sparkles size={12} color={source === "llm" ? "#7c3aed" : "#d97706"} />
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: source === "llm" ? "#7c3aed" : "#d97706",
                            }}
                        >
                            {source === "llm" ? "IA" : "Heurístico"}
                        </Text>
                    </View>
                </View>

                <View style={{ flexDirection: "row", gap: 16 }}>
                    {output.duration_weeks && (
                        <Text style={{ fontSize: 13, color: "#64748b" }}>{output.duration_weeks} semanas</Text>
                    )}
                    <Text style={{ fontSize: 13, color: "#64748b" }}>{output.workouts.length} treinos</Text>
                </View>

                {output.reasoning?.rationale && (
                    <Text style={{ fontSize: 13, color: "#475569", marginTop: 10, lineHeight: 18 }}>
                        {output.reasoning.rationale}
                    </Text>
                )}
            </View>

            {/* Warnings */}
            {hasWarnings && (
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: "#fef3c7",
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 16,
                        alignItems: "center",
                    }}
                >
                    <AlertTriangle size={16} color="#d97706" />
                    <Text style={{ flex: 1, fontSize: 12, color: "#92400e", marginLeft: 8, lineHeight: 16 }}>
                        {violations!.length} aviso(s) de validação. O programa foi ajustado automaticamente.
                    </Text>
                </View>
            )}

            {/* Workouts */}
            {output.workouts.map((workout, wIdx) => (
                <View key={wIdx} style={{ backgroundColor: "#ffffff", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
                    <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.06)" }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#1a1a2e" }}>{workout.name}</Text>
                        <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {workout.items.length} exercícios
                        </Text>
                    </View>
                    {workout.items.map((item, iIdx) => (
                        <View
                            key={iIdx}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderBottomWidth: iIdx < workout.items.length - 1 ? 0.5 : 0,
                                borderBottomColor: "rgba(0,0,0,0.04)",
                            }}
                        >
                            <Text style={{ flex: 1, fontSize: 14, color: "#1a1a2e" }}>
                                {item.exercise_name}
                            </Text>
                            <Text style={{ fontSize: 13, color: "#64748b" }}>
                                {item.sets}x{item.reps}
                                {item.rest_seconds ? ` · ${item.rest_seconds}s` : ""}
                            </Text>
                        </View>
                    ))}
                </View>
            ))}

            {/* Actions */}
            <TouchableOpacity
                onPress={onApprove}
                disabled={isApproving}
                style={{
                    backgroundColor: "#7c3aed",
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 8,
                }}
                activeOpacity={0.7}
            >
                {isApproving ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <>
                        <Check size={18} color="#ffffff" />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                            Aprovar e Atribuir
                        </Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onDiscard}
                disabled={isApproving}
                style={{ alignItems: "center", marginTop: 14, flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
                <X size={16} color="#ef4444" />
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#ef4444" }}>Descartar</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

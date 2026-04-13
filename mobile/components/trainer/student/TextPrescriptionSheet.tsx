import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
    X,
    FileText,
    Sparkles,
    Check,
    AlertTriangle,
    RotateCcw,
    ChevronRight,
    Link,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";
import { toast } from "@/lib/toast";
import { colors } from "@/theme";

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrored from web)
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedExercise {
    matched: boolean;
    exercise_id: string | null;
    catalog_name: string | null;
    original_text: string;
    sets: number;
    reps: string;
    rest_seconds: number | null;
    notes: string | null;
    superset_group: string | null;
}

interface ParsedWorkout {
    name: string;
    exercises: ParsedExercise[];
}

interface ParseTextResponse {
    workouts: ParsedWorkout[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    visible: boolean;
    studentId: string;
    studentName: string;
    onClose: () => void;
    /** Called with parsed result so the parent can open the program builder pre-filled */
    onParsed: (result: ParseTextResponse) => void;
}

type SheetState = "input" | "loading" | "result" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TextPrescriptionSheet({
    visible,
    studentId,
    studentName,
    onClose,
    onParsed,
}: Props) {
    const insets = useSafeAreaInsets();
    const [text, setText] = useState("");
    const [state, setState] = useState<SheetState>("input");
    const [errorMessage, setErrorMessage] = useState("");
    const [result, setResult] = useState<ParseTextResponse | null>(null);
    const [stats, setStats] = useState({ matched: 0, unmatched: 0 });

    const handleClose = useCallback(() => {
        setState("input");
        setText("");
        setResult(null);
        setErrorMessage("");
        setStats({ matched: 0, unmatched: 0 });
        onClose();
    }, [onClose]);

    const handleGenerate = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed) return;

        setState("loading");
        setErrorMessage("");
        setResult(null);

        try {
            const { data, error } = await supabase.functions.invoke(
                "parse-workout-text",
                { body: { text: trimmed } }
            );

            if (error) {
                throw new Error(error.message || "Erro ao chamar função");
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            const response = data as ParseTextResponse;
            setResult(response);

            // Count matched vs unmatched
            let matched = 0;
            let unmatched = 0;
            for (const workout of response.workouts) {
                for (const ex of workout.exercises) {
                    if (ex.matched) matched++;
                    else unmatched++;
                }
            }
            setStats({ matched, unmatched });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setState("result");
        } catch (err: any) {
            console.error("[TextPrescription] Error:", err);
            setErrorMessage(
                err?.message || "Erro ao processar prescrição"
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setState("error");
        }
    }, [text]);

    const handleReset = useCallback(() => {
        setState("input");
        setText("");
        setResult(null);
        setErrorMessage("");
        setStats({ matched: 0, unmatched: 0 });
    }, []);

    const handleUseParsed = useCallback(() => {
        if (!result) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onParsed(result);
        handleClose();
    }, [result, onParsed, handleClose]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: colors.background.primary,
                        paddingTop: insets.top || 12,
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: colors.background.card,
                            borderBottomWidth: 0.5,
                            borderBottomColor: colors.border.primary,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <FileText size={18} color={colors.brand.primary} />
                            <Text
                                style={{
                                    fontSize: 17,
                                    fontWeight: "700",
                                    color: colors.text.primary,
                                }}
                            >
                                Prescrição por Texto
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: colors.background.primary,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <X size={16} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Student name badge */}
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor: colors.background.card,
                        }}
                    >
                        <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                            Prescrevendo para{" "}
                            <Text style={{ fontWeight: "600", color: colors.text.primary }}>
                                {studentName}
                            </Text>
                        </Text>
                    </View>

                    {/* Body */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {state === "input" && (
                            <>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.text.secondary,
                                        lineHeight: 20,
                                        marginBottom: 12,
                                    }}
                                >
                                    Cole ou digite a prescrição em texto livre. A IA vai
                                    interpretar os exercícios, séries, repetições e descanso
                                    automaticamente.
                                </Text>

                                <TextInput
                                    value={text}
                                    onChangeText={setText}
                                    placeholder={
                                        "Cole ou digite seu treino aqui...\n\nExemplo:\nTreino A\nSupino Inclinado Halter 3x8-10\nPuxada Aberta 3x10-12\nRemada Serrote 3x10\n\nTreino B\nAgachamento Livre 4x6-8\nLeg Press 45 3x12\nCadeira Extensora 3x15"
                                    }
                                    placeholderTextColor={colors.text.tertiary}
                                    multiline
                                    textAlignVertical="top"
                                    style={{
                                        minHeight: 240,
                                        backgroundColor: colors.background.card,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: colors.border.secondary,
                                        padding: 14,
                                        fontSize: 14,
                                        lineHeight: 22,
                                        color: colors.text.primary,
                                    }}
                                    autoFocus
                                />
                            </>
                        )}

                        {state === "loading" && (
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 80,
                                }}
                            >
                                <ActivityIndicator
                                    size="large"
                                    color={colors.brand.primary}
                                />
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: "600",
                                        color: colors.text.primary,
                                        marginTop: 20,
                                    }}
                                >
                                    Analisando prescrição...
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.text.secondary,
                                        marginTop: 6,
                                    }}
                                >
                                    Identificando exercícios e parâmetros
                                </Text>
                            </View>
                        )}

                        {state === "result" && result && (
                            <>
                                {/* Summary banner */}
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: 12,
                                        borderRadius: 12,
                                        backgroundColor: colors.success.light,
                                        borderWidth: 1,
                                        borderColor: "rgba(22,163,74,0.2)",
                                        marginBottom: 16,
                                    }}
                                >
                                    <Check size={16} color={colors.success.default} />
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            color: colors.success.default,
                                            flex: 1,
                                        }}
                                    >
                                        <Text style={{ fontWeight: "700" }}>
                                            {stats.matched} exercício
                                            {stats.matched !== 1 ? "s" : ""}
                                        </Text>{" "}
                                        identificado{stats.matched !== 1 ? "s" : ""}
                                        {stats.unmatched > 0 && (
                                            <Text style={{ color: colors.warning.default }}>
                                                {" · "}
                                                {stats.unmatched} não encontrado
                                                {stats.unmatched !== 1 ? "s" : ""}
                                            </Text>
                                        )}
                                    </Text>
                                </View>

                                {/* Parsed workouts */}
                                {result.workouts.map((workout, wi) => (
                                    <View key={wi} style={{ marginBottom: 16 }}>
                                        {result.workouts.length > 1 && (
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: "700",
                                                    color: colors.text.secondary,
                                                    textTransform: "uppercase",
                                                    letterSpacing: 0.5,
                                                    marginBottom: 8,
                                                }}
                                            >
                                                {workout.name}
                                            </Text>
                                        )}

                                        <View
                                            style={{
                                                backgroundColor: colors.background.card,
                                                borderRadius: 12,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <GroupedExerciseList
                                                exercises={workout.exercises}
                                                workoutIndex={wi}
                                            />
                                        </View>
                                    </View>
                                ))}

                                {/* Unmatched warning */}
                                {stats.unmatched > 0 && (
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "flex-start",
                                            gap: 8,
                                            padding: 12,
                                            borderRadius: 12,
                                            backgroundColor: colors.warning.light,
                                            borderWidth: 1,
                                            borderColor: "rgba(245,158,11,0.2)",
                                            marginBottom: 16,
                                        }}
                                    >
                                        <AlertTriangle
                                            size={16}
                                            color={colors.warning.default}
                                            style={{ marginTop: 1 }}
                                        />
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                color: "#92400e",
                                                flex: 1,
                                                lineHeight: 18,
                                            }}
                                        >
                                            Exercícios não encontrados no catálogo serão ignorados.
                                            Você poderá adicioná-los manualmente no editor de
                                            programa.
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}

                        {state === "error" && (
                            <View
                                style={{
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 60,
                                }}
                            >
                                <View
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 24,
                                        backgroundColor: colors.error.light,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginBottom: 16,
                                    }}
                                >
                                    <AlertTriangle size={24} color={colors.error.default} />
                                </View>
                                <Text
                                    style={{
                                        fontSize: 16,
                                        fontWeight: "600",
                                        color: colors.text.primary,
                                        marginBottom: 6,
                                    }}
                                >
                                    Erro ao processar
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: colors.text.secondary,
                                        textAlign: "center",
                                        paddingHorizontal: 24,
                                        marginBottom: 24,
                                    }}
                                >
                                    {errorMessage}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setState("input")}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 6,
                                        paddingHorizontal: 20,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        backgroundColor: colors.brand.primaryLight,
                                    }}
                                >
                                    <RotateCcw size={14} color={colors.brand.primary} />
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: colors.brand.primary,
                                        }}
                                    >
                                        Tentar novamente
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom action bar */}
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingTop: 12,
                            paddingBottom: insets.bottom + 12,
                            backgroundColor: colors.background.card,
                            borderTopWidth: 0.5,
                            borderTopColor: colors.border.primary,
                        }}
                    >
                        {state === "input" && (
                            <TouchableOpacity
                                onPress={handleGenerate}
                                disabled={text.trim().length === 0}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    paddingVertical: 14,
                                    borderRadius: 12,
                                    backgroundColor:
                                        text.trim().length > 0
                                            ? colors.brand.primary
                                            : colors.text.tertiary,
                                    opacity: text.trim().length > 0 ? 1 : 0.4,
                                }}
                            >
                                <Sparkles size={16} color={colors.text.inverse} />
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontWeight: "700",
                                        color: colors.text.inverse,
                                    }}
                                >
                                    Gerar Treino
                                </Text>
                            </TouchableOpacity>
                        )}

                        {state === "result" && (
                            <View style={{ gap: 10 }}>
                                <TouchableOpacity
                                    onPress={handleUseParsed}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        backgroundColor: colors.brand.primary,
                                    }}
                                >
                                    <ChevronRight size={16} color={colors.text.inverse} />
                                    <Text
                                        style={{
                                            fontSize: 15,
                                            fontWeight: "700",
                                            color: colors.text.inverse,
                                        }}
                                    >
                                        Criar Programa com estes Exercícios
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleReset}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        paddingVertical: 10,
                                    }}
                                >
                                    <RotateCcw size={14} color={colors.brand.primary} />
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "600",
                                            color: colors.brand.primary,
                                        }}
                                    >
                                        Nova prescrição
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouped Exercise List (handles supersets)
// ─────────────────────────────────────────────────────────────────────────────

type ExerciseGroup =
    | { type: "single"; exercise: ParsedExercise }
    | { type: "superset"; groupId: string; exercises: ParsedExercise[] };

function GroupedExerciseList({
    exercises,
    workoutIndex,
}: {
    exercises: ParsedExercise[];
    workoutIndex: number;
}) {
    // Build groups: consecutive exercises with same superset_group are grouped
    const groups: ExerciseGroup[] = [];
    const processedGroups = new Set<string>();

    for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        if (!ex.superset_group) {
            groups.push({ type: "single", exercise: ex });
        } else if (!processedGroups.has(ex.superset_group)) {
            processedGroups.add(ex.superset_group);
            const groupExercises = exercises.filter(
                (e) => e.superset_group === ex.superset_group
            );
            groups.push({
                type: "superset",
                groupId: ex.superset_group,
                exercises: groupExercises,
            });
        }
    }

    return (
        <>
            {groups.map((group, gi) => {
                const isLastGroup = gi === groups.length - 1;

                if (group.type === "single") {
                    return (
                        <ExerciseRow
                            key={`${workoutIndex}-${gi}`}
                            exercise={group.exercise}
                            isLast={isLastGroup}
                        />
                    );
                }

                // Superset group
                return (
                    <View
                        key={`${workoutIndex}-ss-${group.groupId}`}
                        style={{
                            borderBottomWidth: isLastGroup ? 0 : 0.5,
                            borderBottomColor: colors.border.primary,
                        }}
                    >
                        {/* Superset header */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                paddingHorizontal: 14,
                                paddingTop: 10,
                                paddingBottom: 4,
                                backgroundColor: "rgba(124,58,237,0.04)",
                            }}
                        >
                            <Link size={12} color={colors.brand.primary} />
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: colors.brand.primary,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.3,
                                }}
                            >
                                {group.exercises.length === 2
                                    ? "Bi-set"
                                    : group.exercises.length === 3
                                    ? "Tri-set"
                                    : `Superset (${group.exercises.length})`}
                            </Text>
                        </View>
                        {/* Superset exercises */}
                        {group.exercises.map((ex, sei) => (
                            <ExerciseRow
                                key={`${workoutIndex}-ss-${group.groupId}-${sei}`}
                                exercise={ex}
                                isLast={false}
                                inSuperset
                            />
                        ))}
                    </View>
                );
            })}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise Row
// ─────────────────────────────────────────────────────────────────────────────

function ExerciseRow({
    exercise,
    isLast,
    inSuperset,
}: {
    exercise: ParsedExercise;
    isLast: boolean;
    inSuperset?: boolean;
}) {
    if (exercise.matched) {
        return (
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    paddingLeft: inSuperset ? 32 : 14,
                    paddingVertical: 10,
                    gap: 10,
                    borderBottomWidth: isLast ? 0 : 0.5,
                    borderBottomColor: colors.border.primary,
                    backgroundColor: inSuperset
                        ? "rgba(124,58,237,0.04)"
                        : undefined,
                }}
            >
                <Check size={14} color={colors.success.default} />
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "500",
                            color: colors.text.primary,
                        }}
                        numberOfLines={1}
                    >
                        {exercise.catalog_name}
                    </Text>
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.text.secondary,
                            marginTop: 2,
                        }}
                    >
                        {exercise.sets}x{exercise.reps}
                        {exercise.rest_seconds
                            ? ` · ${exercise.rest_seconds}s descanso`
                            : ""}
                        {exercise.notes ? ` · ${exercise.notes}` : ""}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingLeft: inSuperset ? 32 : 14,
                paddingVertical: 10,
                gap: 10,
                backgroundColor: colors.warning.light,
                borderBottomWidth: isLast ? 0 : 0.5,
                borderBottomColor: "rgba(245,158,11,0.15)",
            }}
        >
            <AlertTriangle size={14} color={colors.warning.default} />
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: "#92400e",
                    }}
                    numberOfLines={1}
                >
                    {exercise.original_text}
                </Text>
                <Text style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                    Não encontrado no catálogo · {exercise.sets}x{exercise.reps}
                </Text>
            </View>
        </View>
    );
}

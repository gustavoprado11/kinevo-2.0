import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Calendar, CalendarDays, Eye, Layers, Timer } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useV2Colors } from "@/hooks/useV2Colors";
import { VolumeSummary } from "./VolumeSummary";
import { WorkoutSelectorCard, WorkoutSelectorAddCard } from "./WorkoutSelectorCard";
import { WorkoutDetailHeader } from "./WorkoutDetailHeader";
import { ProgramDatePickerModal } from "./ProgramDatePickerModal";
import type { Workout } from "@/stores/program-builder-store";

/** end = start + (weeks * 7) - 1 day, as YYYY-MM-DD. Mirrors the web edit
 *  flow's calculateEndDate so duration ↔ end stay in sync across platforms. */
function calculateEndDate(start: string | null, weeks: number | null): string | null {
    if (!start || !weeks || weeks <= 0) return null;
    const startObj = new Date(start);
    if (isNaN(startObj.getTime())) return null;
    const endObj = new Date(startObj);
    endObj.setUTCDate(endObj.getUTCDate() + weeks * 7 - 1);
    return endObj.toISOString().split("T")[0];
}

/** Whole weeks between start and end (inclusive of both ends). Mirrors web. */
function calculateWeeks(start: string, end: string): number {
    const startObj = new Date(start);
    const endObj = new Date(end);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return 0;
    const diffDays = Math.max(0, Math.ceil((endObj.getTime() - startObj.getTime()) / 86400000) + 1);
    return Math.max(1, Math.round(diffDays / 7));
}

/** YYYY-MM-DD → DD/MM/AAAA (string-only, no timezone drift). */
function formatBrDate(iso: string | null): string | null {
    if (!iso) return null;
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return null;
    return `${d}/${m}/${y}`;
}

export interface ProgramBuilderListHeaderProps {
    /** Conteúdo do programa. */
    name: string;
    description: string;
    durationWeeks: number | null;
    /** Data de início (YYYY-MM-DD) do programa atribuído; null fora de edição. */
    startDate: string | null;
    /** Modo de ativação (preserva o campo gravado no save). */
    assignmentType: 'immediate' | 'scheduled' | null;
    /** Só programas atribuídos têm agenda; templates/novos não mostram datas. */
    showSchedule: boolean;
    workouts: Workout[];
    currentWorkout: Workout | null;
    currentWorkoutId: string | null;

    /** Modo edit liga placeholder diferente no input de nome. */
    isEditMode: boolean;

    /** Estado de foco dos inputs (controlado pelo parent pra evitar re-mount). */
    nameFocused: boolean;
    descriptionFocused: boolean;
    onNameFocus: () => void;
    onNameBlur: () => void;
    onDescriptionFocus: () => void;
    onDescriptionBlur: () => void;

    /** Handlers do programa. */
    onUpdateName: (name: string) => void;
    onUpdateDescription: (description: string) => void;
    onUpdateDurationWeeks: (weeks: number | null) => void;
    onUpdateStartDate: (date: string) => void;

    /** Handlers dos treinos. */
    onAddWorkout: (workoutType?: 'strength' | 'cardio') => void;
    onSelectWorkout: (workoutId: string) => void;
    onRenameWorkout: (workoutId: string, name: string) => void;
    onUpdateWorkoutFrequency: (workoutId: string, days: string[]) => void;
    onDeleteWorkout: (workoutId: string, name: string) => void;
    onChangeWorkoutType?: (workoutId: string, type: 'strength' | 'cardio') => void;

    /** Action: visualizar preview como aluno (Eye icon). */
    onPreview: () => void;
}

/**
 * Header full do program-builder, usado como `ListHeaderComponent` da
 * DraggableFlatList. Rola junto com os cards de exercício pra liberar
 * espaço de tela.
 *
 * Diferenças vs versão inline anterior (cirurgia mínima):
 *  - Linha 1 NÃO tem mais botão Voltar (agora vive na ProgramBuilderCompactBar).
 *    Mantém somente o chip de Duração à direita.
 *  - Linha 3 NÃO tem mais botão Salvar (idem). Mantém stats + Eye.
 *
 * O resto (nome, descrição, stats chips, VolumeSummary, workout selector,
 * WorkoutDetailHeader, hint de drag) é mantido idêntico à versão inline.
 */
export function ProgramBuilderListHeader({
    name,
    description,
    durationWeeks,
    startDate,
    showSchedule,
    workouts,
    currentWorkout,
    currentWorkoutId,
    isEditMode,
    nameFocused,
    descriptionFocused,
    onNameFocus,
    onNameBlur,
    onDescriptionFocus,
    onDescriptionBlur,
    onUpdateName,
    onUpdateDescription,
    onUpdateDurationWeeks,
    onUpdateStartDate,
    onAddWorkout,
    onSelectWorkout,
    onRenameWorkout,
    onUpdateWorkoutFrequency,
    onDeleteWorkout,
    onChangeWorkoutType,
    onPreview,
}: ProgramBuilderListHeaderProps) {
    const colors = useV2Colors();
    const [datePicker, setDatePicker] = useState<"start" | "end" | null>(null);

    const endDate = calculateEndDate(startDate, durationWeeks);
    const startLabel = formatBrDate(startDate);
    const endLabel = formatBrDate(endDate);

    // Meta chips: cada um só aparece quando há dado real para mostrar.
    // Métricas derivadas do conteúdo do programa.
    const metaChips = useMemo(() => {
        const populatedWorkouts = workouts.filter((w) =>
            w.items.some((it) => it.item_type === "exercise"),
        );
        const exerciseCount = populatedWorkouts.reduce(
            (acc, w) => acc + w.items.filter((it) => it.item_type === "exercise").length,
            0,
        );

        let avgWorkoutMinutes: number | null = null;
        if (populatedWorkouts.length > 0) {
            const totals = populatedWorkouts.map((w) => {
                const exerciseItems = w.items.filter((it) => it.item_type === "exercise");
                const seconds = exerciseItems.reduce((acc, it) => {
                    const repsMatch = String(it.reps ?? "").match(/\d+/);
                    const reps = repsMatch ? parseInt(repsMatch[0], 10) : 10;
                    const rest = it.rest_seconds ?? 60;
                    const sets = it.sets ?? 3;
                    return acc + sets * (reps * 3 + rest);
                }, 0);
                return seconds / 60;
            });
            const sum = totals.reduce((a, b) => a + b, 0);
            avgWorkoutMinutes = Math.round(sum / totals.length);
        }

        return {
            exerciseCount: exerciseCount > 0 ? exerciseCount : null,
            avgWorkoutMinutes,
        };
    }, [workouts]);

    const hasExercises = workouts.some((w) => w.items.length > 0);

    return (
        <View>
            {/* === Bloco 1: Nome / Descrição / Stats / Duração ============== */}
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12 }}>
                {/* Linha 1 — Início / Fim + Duração, tudo no topo */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "stretch",
                        justifyContent: "flex-end",
                        gap: 8,
                    }}
                >
                    {showSchedule && ([
                        { key: "start" as const, label: "Início", value: startLabel },
                        { key: "end" as const, label: "Fim", value: endLabel },
                    ]).map(({ key, label, value }) => (
                        <TouchableOpacity
                            key={key}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setDatePicker(key);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${label}: ${value ?? "definir"}`}
                            style={{
                                flex: 1,
                                justifyContent: "center",
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: colors.surface.card,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                            }}
                        >
                            <Text style={{ fontSize: 10.5, color: colors.text.tertiary, fontWeight: "500" }}>
                                {label}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                                <CalendarDays size={13} color={colors.purple[600]} />
                                <Text
                                    adjustsFontSizeToFit
                                    numberOfLines={1}
                                    style={{
                                        flex: 1,
                                        fontSize: 14,
                                        fontWeight: "700",
                                        color: value ? colors.text.primary : colors.text.quaternary,
                                    }}
                                >
                                    {value ?? "Definir"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 10,
                            backgroundColor: colors.surface.card,
                            borderWidth: 1,
                            borderColor: colors.border.default,
                        }}
                    >
                        <Calendar size={13} color={colors.text.tertiary} />
                        <Text
                            style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: "500" }}
                        >
                            Duração
                        </Text>
                        <TextInput
                            value={durationWeeks != null ? String(durationWeeks) : ""}
                            onChangeText={(text) => {
                                const num = parseInt(text);
                                onUpdateDurationWeeks(
                                    isNaN(num) ? null : Math.max(1, Math.min(52, num)),
                                );
                            }}
                            placeholder="–"
                            placeholderTextColor={colors.text.quaternary}
                            keyboardType="number-pad"
                            accessibilityLabel="Duração em semanas"
                            style={{
                                minWidth: 22,
                                textAlign: "center",
                                fontSize: 14,
                                fontWeight: "700",
                                color: colors.purple[600],
                                padding: 0,
                            }}
                        />
                        <Text
                            style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: "500" }}
                        >
                            sem
                        </Text>
                    </View>
                </View>

                {/* Linha 2 — título hero (Nome do programa) */}
                <TextInput
                    value={name}
                    onChangeText={onUpdateName}
                    onFocus={onNameFocus}
                    onBlur={onNameBlur}
                    placeholder={isEditMode ? "Editar programa" : "Nome do programa"}
                    placeholderTextColor={colors.text.tertiary}
                    accessibilityLabel="Nome do programa"
                    style={{
                        fontSize: 26,
                        fontWeight: "800",
                        color: colors.text.primary,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        backgroundColor: colors.surface.card,
                        borderWidth: nameFocused ? 2 : 1,
                        borderColor: nameFocused ? colors.purple[500] : colors.border.default,
                        letterSpacing: -0.4,
                    }}
                />

                {/* Descrição — secondary */}
                <TextInput
                    value={description}
                    onChangeText={onUpdateDescription}
                    onFocus={onDescriptionFocus}
                    onBlur={onDescriptionBlur}
                    placeholder="Descrição (opcional)"
                    placeholderTextColor={colors.text.tertiary}
                    accessibilityLabel="Descrição do programa"
                    multiline
                    style={{
                        fontSize: 14,
                        color: colors.text.secondary,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: colors.surface.card,
                        borderWidth: descriptionFocused ? 2 : 1,
                        borderColor: descriptionFocused
                            ? colors.purple[500]
                            : colors.border.default,
                        minHeight: 48,
                    }}
                />

                {/* Linha 3 — meta chips + Eye (save vive na compact bar) */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            flex: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        {metaChips.exerciseCount != null && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 8,
                                    backgroundColor: colors.surface.card2,
                                }}
                            >
                                <Layers size={11} color={colors.text.secondary} />
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: colors.text.secondary,
                                    }}
                                >
                                    {metaChips.exerciseCount} exerc.
                                </Text>
                            </View>
                        )}
                        {metaChips.avgWorkoutMinutes != null && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    paddingHorizontal: 9,
                                    paddingVertical: 5,
                                    borderRadius: 8,
                                    backgroundColor: colors.surface.card2,
                                }}
                            >
                                <Timer size={11} color={colors.text.secondary} />
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: colors.text.secondary,
                                    }}
                                >
                                    ~{metaChips.avgWorkoutMinutes} min
                                </Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={onPreview}
                        disabled={!hasExercises}
                        accessibilityRole="button"
                        accessibilityLabel="Visualizar como aluno"
                        style={{
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.purple[100],
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            opacity: hasExercises ? 1 : 0.4,
                        }}
                    >
                        <Eye size={17} color={colors.purple[600]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* === Bloco 2: Volume Summary =================================== */}
            <VolumeSummary workouts={workouts} />

            {/* === Bloco 3: Workout selector horizontal ====================== */}
            {/* flexShrink: 0 evita o ScrollView ser comprimido a 0 quando
                o filho seguinte tem flex: 1 e disputa altura no pai column.
                minHeight: 100 reserva espaço suficiente pros cards. */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingVertical: 8,
                    gap: 10,
                    alignItems: "center",
                }}
                style={{ flexGrow: 0, flexShrink: 0, minHeight: 100 }}
            >
                {workouts.map((workout) => (
                    <WorkoutSelectorCard
                        key={workout.id}
                        workout={workout}
                        isActive={workout.id === currentWorkoutId}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onSelectWorkout(workout.id);
                        }}
                    />
                ))}
                <WorkoutSelectorAddCard
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Alert.alert('Novo treino', 'Qual o tipo do treino?', [
                            { text: 'Treino de força', onPress: () => onAddWorkout('strength') },
                            { text: 'Treino aeróbio', onPress: () => onAddWorkout('cardio') },
                            { text: 'Cancelar', style: 'cancel' },
                        ]);
                    }}
                    pulse={workouts.every((w) => w.items.length === 0)}
                />
            </ScrollView>

            {/* === Bloco 4: Workout detail header =========================== */}
            {currentWorkout && (
                <WorkoutDetailHeader
                    workout={currentWorkout}
                    allWorkouts={workouts}
                    onRename={(newName) => onRenameWorkout(currentWorkout.id, newName)}
                    onUpdateFrequency={(days) =>
                        onUpdateWorkoutFrequency(currentWorkout.id, days)
                    }
                    onDelete={() => onDeleteWorkout(currentWorkout.id, currentWorkout.name)}
                    onChangeWorkoutType={onChangeWorkoutType
                        ? (type) => onChangeWorkoutType(currentWorkout.id, type)
                        : undefined}
                />
            )}

            {/* === Bloco 5: Hint discreto de drag affordance ================= */}
            {currentWorkout && currentWorkout.items.length >= 2 && (
                <Text
                    style={{
                        fontSize: 11,
                        fontWeight: "500",
                        color: colors.text.tertiary,
                        textAlign: "center",
                        paddingHorizontal: 20,
                        marginBottom: 6,
                    }}
                >
                    Mantenha pressionado pra reordenar
                </Text>
            )}

            {/* Date picker (Início / Fim) — fim ajusta a duração em semanas */}
            <ProgramDatePickerModal
                visible={datePicker !== null}
                title={datePicker === "end" ? "Data de término" : "Data de início"}
                value={datePicker === "end" ? endDate : startDate}
                minDate={datePicker === "end" ? startDate : null}
                onClose={() => setDatePicker(null)}
                onSelect={(date) => {
                    if (datePicker === "end") {
                        // Editar o fim recalcula a duração; o início manda.
                        if (startDate) onUpdateDurationWeeks(calculateWeeks(startDate, date));
                    } else {
                        onUpdateStartDate(date);
                    }
                }}
            />
        </View>
    );
}

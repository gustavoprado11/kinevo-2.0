import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Save, Plus, Trash2, Dumbbell } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@/theme";
import { useProgramBuilder } from "@/hooks/useProgramBuilder";
import { useResponsive } from "@/hooks/useResponsive";
import { WorkoutTabBar } from "@/components/trainer/program-builder/WorkoutTabBar";
import { WorkoutItemRow } from "@/components/trainer/program-builder/WorkoutItemRow";
import { ExercisePickerModal } from "@/components/trainer/program-builder/ExercisePickerModal";
import { ExercisePanel } from "@/components/trainer/program-builder/ExercisePanel";
import { DaySelector, computeOccupiedDays } from "@/components/trainer/program-builder/DaySelector";
import { VolumeSummary } from "@/components/trainer/program-builder/VolumeSummary";
import { EmptyState } from "@/components/shared/EmptyState";
import type { WorkoutItem } from "@/stores/program-builder-store";
import type { Exercise } from "@/hooks/useExerciseLibrary";

export default function ProgramBuilderScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ studentId?: string; mode?: string }>();
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const { isTablet } = useResponsive();

    const {
        draft,
        currentWorkoutId,
        isSaving,
        isDirty,
        initNewProgram,
        updateName,
        updateDescription,
        updateDurationWeeks,
        addWorkout,
        removeWorkout,
        updateWorkoutFrequency,
        setCurrentWorkout,
        addExercise,
        updateItem,
        removeItem,
        reorderItems,
        reset,
        saveAsTemplate,
        saveAndAssign,
    } = useProgramBuilder();

    useEffect(() => {
        initNewProgram(params.studentId);
    }, []);

    const currentWorkout = draft.workouts.find(w => w.id === currentWorkoutId) ?? draft.workouts[0] ?? null;

    const occupiedDays = useMemo(
        () => computeOccupiedDays(draft.workouts, currentWorkoutId),
        [draft.workouts, currentWorkoutId]
    );

    const handleSave = useCallback(async () => {
        if (!draft.name.trim()) {
            Alert.alert("Nome obrigatório", "Dê um nome ao programa antes de salvar.");
            return;
        }

        const hasExercises = draft.workouts.some(w => w.items.length > 0);
        if (!hasExercises) {
            Alert.alert("Programa vazio", "Adicione pelo menos um exercício.");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            if (params.studentId) {
                await saveAndAssign(params.studentId);
                router.back();
            } else {
                await saveAsTemplate();
                reset();
                router.back();
            }
        } catch {
            // Error already handled by toast in the hook
        }
    }, [draft, params.studentId, saveAndAssign, saveAsTemplate, reset, router]);

    const handleBack = useCallback(() => {
        if (isDirty) {
            Alert.alert(
                "Descartar rascunho?",
                "As alterações não salvas serão perdidas.",
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Descartar", style: "destructive", onPress: () => { reset(); router.back(); } },
                ]
            );
        } else {
            router.back();
        }
    }, [isDirty, reset, router]);

    const handleDeleteWorkout = useCallback((workoutId: string, workoutName: string) => {
        if (draft.workouts.length <= 1) {
            Alert.alert("Não permitido", "O programa precisa de pelo menos um treino.");
            return;
        }
        Alert.alert(
            `Excluir ${workoutName}?`,
            "Todos os exercícios deste treino serão removidos.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        removeWorkout(workoutId);
                    },
                },
            ]
        );
    }, [draft.workouts.length, removeWorkout]);

    const handleExerciseSelected = useCallback((exercise: Exercise) => {
        if (!currentWorkout) return;
        addExercise(currentWorkout.id, exercise);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [currentWorkout, addExercise]);

    const renderWorkoutItem = useCallback(({ item, drag, isActive }: RenderItemParams<WorkoutItem>) => {
        if (!currentWorkout) return null;
        return (
            <WorkoutItemRow
                item={item}
                index={item.order_index}
                workoutId={currentWorkout.id}
                onUpdate={(updates) => updateItem(currentWorkout.id, item.id, updates)}
                onDelete={() => removeItem(currentWorkout.id, item.id)}
                drag={drag}
                isActive={isActive}
            />
        );
    }, [currentWorkout, updateItem, removeItem]);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.background.primary }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column', paddingTop: insets.top }}>
                {/* Tablet: persistent exercise panel on the left */}
                {isTablet && (
                    <ExercisePanel
                        visible={true}
                        onSelectExercise={handleExerciseSelected}
                    />
                )}
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                        }}
                    >
                        <TouchableOpacity
                            onPress={handleBack}
                            accessibilityRole="button"
                            accessibilityLabel="Voltar"
                            style={{ flexDirection: "row", alignItems: "center" }}
                        >
                            <ChevronLeft size={22} color={colors.brand.primary} />
                            <Text style={{ fontSize: 16, color: colors.brand.primary, marginLeft: 2 }}>Voltar</Text>
                        </TouchableOpacity>

                        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text.primary }}>
                            Novo programa
                        </Text>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isSaving}
                            accessibilityRole="button"
                            accessibilityLabel="Salvar programa"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: colors.brand.primary,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 10,
                                opacity: isSaving ? 0.6 : 1,
                                gap: 4,
                            }}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color={colors.text.inverse} />
                            ) : (
                                <Save size={14} color={colors.text.inverse} />
                            )}
                            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.inverse }}>
                                Salvar
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Program metadata */}
                    <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 6 }}>
                        <TextInput
                            value={draft.name}
                            onChangeText={updateName}
                            placeholder="Nome do programa"
                            placeholderTextColor="#b0b0b8"
                            accessibilityLabel="Nome do programa"
                            style={{
                                fontSize: 18,
                                fontWeight: "700",
                                color: colors.text.primary,
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                borderRadius: 12,
                                backgroundColor: '#ffffff',
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                            }}
                        />
                        {/* Description + Duration row */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                value={draft.description}
                                onChangeText={updateDescription}
                                placeholder="Descrição (opcional)"
                                placeholderTextColor="#b0b0b8"
                                accessibilityLabel="Descrição do programa"
                                multiline
                                style={{
                                    flex: 1,
                                    fontSize: 13,
                                    color: colors.text.primary,
                                    paddingVertical: 10,
                                    paddingHorizontal: 14,
                                    borderRadius: 12,
                                    backgroundColor: '#ffffff',
                                    borderWidth: 1,
                                    borderColor: '#e2e8f0',
                                    minHeight: 42,
                                }}
                            />
                            {/* Duration — compact pill */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 10,
                                borderRadius: 12,
                                backgroundColor: '#ffffff',
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                            }}>
                                <TextInput
                                    value={draft.duration_weeks != null ? String(draft.duration_weeks) : ''}
                                    onChangeText={(text) => {
                                        const num = parseInt(text);
                                        updateDurationWeeks(
                                            isNaN(num) ? null : Math.max(1, Math.min(52, num))
                                        );
                                    }}
                                    placeholder="–"
                                    placeholderTextColor="#c7c7cc"
                                    keyboardType="number-pad"
                                    accessibilityLabel="Duração em semanas"
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 7,
                                        backgroundColor: '#f5f3ff',
                                        textAlign: 'center',
                                        fontSize: 15,
                                        fontWeight: '700',
                                        color: colors.brand.primary,
                                    }}
                                />
                                <Text style={{ fontSize: 11, color: colors.text.tertiary, fontWeight: '500' }}>
                                    sem
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Volume Summary */}
                    <VolumeSummary workouts={draft.workouts} />

                    {/* Workout tabs */}
                    <WorkoutTabBar
                        workouts={draft.workouts}
                        currentWorkoutId={currentWorkoutId}
                        onSelectWorkout={setCurrentWorkout}
                        onAddWorkout={addWorkout}
                    />

                    {/* Current workout header — single compact row */}
                    {currentWorkout && (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingTop: 2,
                            paddingBottom: 10,
                            gap: 10,
                        }}>
                            <Text
                                style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary }}
                                numberOfLines={1}
                            >
                                {currentWorkout.name}
                            </Text>

                            <View style={{ flex: 1 }}>
                                <DaySelector
                                    frequency={currentWorkout.frequency}
                                    occupiedDays={occupiedDays}
                                    onUpdateFrequency={(days) => updateWorkoutFrequency(currentWorkout.id, days)}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={() => handleDeleteWorkout(currentWorkout.id, currentWorkout.name)}
                                accessibilityRole="button"
                                accessibilityLabel={`Excluir ${currentWorkout.name}`}
                                hitSlop={8}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    backgroundColor: '#fef2f2',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Trash2 size={14} color={colors.error.default} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Exercise list */}
                    {currentWorkout && currentWorkout.items.length > 0 ? (
                        <DraggableFlatList
                            data={currentWorkout.items}
                            keyExtractor={(item) => item.id}
                            renderItem={renderWorkoutItem}
                            onDragEnd={({ data }) => {
                                if (currentWorkout) {
                                    reorderItems(currentWorkout.id, data);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                            }}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <ScrollView
                            contentContainerStyle={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center' }}
                            showsVerticalScrollIndicator={false}
                        >
                            <Animated.View
                                entering={FadeIn.duration(400)}
                                style={{ alignItems: 'center', paddingBottom: 80 }}
                            >
                                <View style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 20,
                                    backgroundColor: '#f5f3ff',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 16,
                                }}>
                                    <Dumbbell size={28} color={colors.brand.primary} strokeWidth={1.5} />
                                </View>
                                <Text style={{
                                    fontSize: 16,
                                    fontWeight: "600",
                                    color: colors.text.secondary,
                                    textAlign: "center",
                                    marginBottom: 6,
                                }}>
                                    Nenhum exercício
                                </Text>
                                <Text style={{
                                    fontSize: 13,
                                    color: colors.text.tertiary,
                                    textAlign: "center",
                                    lineHeight: 19,
                                    maxWidth: 240,
                                }}>
                                    Toque em "Adicionar exercício" para começar a montar este treino
                                </Text>
                            </Animated.View>
                        </ScrollView>
                    )}

                    {/* FAB - Add Exercise (phone only) */}
                    {currentWorkout && !isTablet && (
                        <Animated.View
                            entering={FadeInUp.delay(200).duration(400).springify()}
                            style={{
                                position: "absolute",
                                bottom: insets.bottom + 20,
                                left: 20,
                                right: 20,
                                alignItems: 'center',
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowExercisePicker(true);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Adicionar exercício"
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: 'center',
                                    backgroundColor: colors.brand.primary,
                                    paddingHorizontal: 24,
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    gap: 8,
                                    shadowColor: colors.brand.primary,
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.35,
                                    shadowRadius: 14,
                                    elevation: 10,
                                    minWidth: 220,
                                }}
                            >
                                <Plus size={18} color={colors.text.inverse} strokeWidth={2.5} />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.inverse }}>
                                    Adicionar exercício
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Exercise Picker (phone only) */}
                    {!isTablet && (
                        <ExercisePickerModal
                            visible={showExercisePicker}
                            onClose={() => setShowExercisePicker(false)}
                            onSelect={handleExerciseSelected}
                        />
                    )}
                </View>
              </View>
            </KeyboardAvoidingView>
        </GestureHandlerRootView>
    );
}

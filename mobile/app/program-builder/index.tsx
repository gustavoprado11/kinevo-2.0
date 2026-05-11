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
import { ChevronLeft, Save, Plus, Eye, Calendar, Layers, Timer } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useProgramBuilder } from "@/hooks/useProgramBuilder";
import { useResponsive } from "@/hooks/useResponsive";
import { WorkoutSelectorCard, WorkoutSelectorAddCard } from "@/components/trainer/program-builder/WorkoutSelectorCard";
import { EmptyWorkoutState } from "@/components/trainer/program-builder/EmptyWorkoutState";
import { WorkoutItemRow } from "@/components/trainer/program-builder/WorkoutItemRow";
import { SetSchemeEditor, type SetSchemeEditorResult } from "@/components/trainer/program-builder/SetSchemeEditor";
import { ExercisePickerModal } from "@/components/trainer/program-builder/ExercisePickerModal";
import { ExercisePanel } from "@/components/trainer/program-builder/ExercisePanel";
import { VolumeSummary } from "@/components/trainer/program-builder/VolumeSummary";
import { EmptyState } from "@/components/shared/EmptyState";
import type { WorkoutItem } from "@/stores/program-builder-store";
import type { Exercise } from "@/hooks/useExerciseLibrary";
import { openAIPrescriptionMenu } from "@/components/trainer/program-builder/AIPrescriptionMenu";
import { AIPrescriptionSheet } from "@/components/trainer/program-builder/AIPrescriptionSheet";
import { TextPrescriptionSheet } from "@/components/trainer/student/TextPrescriptionSheet";
import { AssignProgramWizard } from "@/components/trainer/student/AssignProgramWizard";
import { useStudentDetail } from "@/hooks/useStudentDetail";
import { mapAiOutputToBuilderData } from "@kinevo/shared/lib/prescription/builder-mapper";
import {
    summarizeSetScheme,
    summarizeWithRounds,
} from "@kinevo/shared/lib/prescription/set-scheme";
import { isCompoundMethod } from "@kinevo/shared/lib/prescription/set-scheme-presets";
import { useProgramBuilderStore } from "@/stores/program-builder-store";
import type { AgentResult } from "@/hooks/useAIPrescriptionAgent";
import { toast } from "@/lib/toast";

export default function ProgramBuilderScreen() {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ studentId?: string; mode?: string }>();
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [showAISheet, setShowAISheet] = useState(false);
    const [showTextSheet, setShowTextSheet] = useState(false);
    const [showAssignWizard, setShowAssignWizard] = useState(false);
    const { isTablet } = useResponsive();
    const initFromAiSnapshot = useProgramBuilderStore((s) => s.initFromAiSnapshot);
    const setSetScheme = useProgramBuilderStore((s) => s.setSetScheme);
    const [setSchemeEditingItemId, setSetSchemeEditingItemId] = useState<string | null>(null);
    const [nameFocused, setNameFocused] = useState(false);
    const [descriptionFocused, setDescriptionFocused] = useState(false);
    const { data: studentDetail } = useStudentDetail(params.studentId ?? null);
    const aiEnabled = studentDetail?.aiEnabled ?? false;
    const studentName = studentDetail?.student.name ?? "";

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
        setCurrentWorkout,
        addExercise,
        updateItem,
        removeItem,
        duplicateItem,
        reorderItems,
        reset,
        saveAsTemplate,
        saveAndAssign,
        saveAsNewProgramDiscardingAi,
        saveAssignedProgramFull,
    } = useProgramBuilder();

    // Edit mode (Round 1): the route loaded an existing assigned program via
    // `initFromAssignedProgram` and the builder must skip create-flow init,
    // render the read-only viewer + metadata-only save. We rely on
    // `editingAssignedProgramId` (set by initFromAssignedProgram) rather than
    // just `params.mode` so a mid-flight nav refresh can't show a stale draft.
    const isEditMode = params.mode === "edit" && !!draft.editingAssignedProgramId;

    useEffect(() => {
        // When coming from text prescription, AI hand-off, or edit-existing,
        // the store is already pre-filled (`initFromParsedText` /
        // `initFromAiSnapshot` / `initFromAssignedProgram`); don't blow it
        // away.
        if (params.mode === "from-text" || params.mode === "from-ai" || params.mode === "edit") return;
        // mode=ai opens the AI sheet on a fresh draft, but only after we
        // make sure the draft is initialized.
        initNewProgram(params.studentId);
    }, []);

    // mode=ai: auto-open AI sheet on mount when a student is selected.
    useEffect(() => {
        if (params.mode !== "ai") return;
        if (!params.studentId) {
            toast.info("Selecione um aluno", "Para gerar com IA, abra o builder a partir de um aluno.");
            return;
        }
        setShowAISheet(true);
    }, [params.mode, params.studentId]);

    const currentWorkout = draft.workouts.find(w => w.id === currentWorkoutId) ?? draft.workouts[0] ?? null;

    // Meta chips: cada um só aparece quando há dado real para mostrar.
    // Duração é editável na linha 1 do header (com label "Duração"); aqui são
    // métricas derivadas do conteúdo:
    // - exerciseCount: total de itens entre todos os treinos (>0).
    // - avgWorkoutMinutes: estimativa simples por treino com items, com média
    //   sobre os treinos populados. Fórmula por item:
    //     sets * (reps_estimadas * 3s + rest_seconds)
    //   reps_estimadas: extrai primeiro número de strings tipo "10" / "8-12" / "AMRAP".
    const metaChips = useMemo(() => {
        const populatedWorkouts = draft.workouts.filter((w) => w.items.length > 0);
        const exerciseCount = populatedWorkouts.reduce((acc, w) => acc + w.items.length, 0);

        let avgWorkoutMinutes: number | null = null;
        if (populatedWorkouts.length > 0) {
            const totals = populatedWorkouts.map((w) => {
                const seconds = w.items.reduce((acc, it) => {
                    const repsMatch = String(it.reps ?? '').match(/\d+/);
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
    }, [draft.workouts]);

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

        // Edit mode: full save against assigned_* tables. The check above
        // already guarantees at least one exercise.
        if (isEditMode) {
            const result = await saveAssignedProgramFull();
            if (result.ok) {
                reset();
                router.back();
            }
            return;
        }

        try {
            if (params.studentId) {
                const result = await saveAndAssign(params.studentId);
                if (result.ok) {
                    router.back();
                    return;
                }
                if (result.reason === "SUPERSET_BLOCKED") {
                    Alert.alert(
                        "Supersets não suportados",
                        "O snapshot de IA não suporta supersets. Remova os supersets adicionados, ou salve como programa novo (sem vincular à geração).",
                        [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Remover supersets", style: "default" },
                            {
                                text: "Salvar como programa novo",
                                style: "destructive",
                                onPress: async () => {
                                    const r2 = await saveAsNewProgramDiscardingAi(params.studentId!);
                                    if (r2.ok) router.back();
                                },
                            },
                        ],
                    );
                    return;
                }
                // ERROR — toast already shown by the hook.
            } else {
                await saveAsTemplate();
                reset();
                router.back();
            }
        } catch {
            // Error already handled by toast in the hook
        }
    }, [draft, params.studentId, saveAndAssign, saveAsNewProgramDiscardingAi, saveAsTemplate, reset, router, isEditMode, saveAssignedProgramFull]);

    const handleAIGenerated = useCallback(
        (result: AgentResult) => {
            if (!params.studentId) return;
            const builderData = mapAiOutputToBuilderData(result.outputSnapshot);
            initFromAiSnapshot(params.studentId, builderData, result.generationId, result.outputSnapshot);
            setShowAISheet(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        },
        [params.studentId, initFromAiSnapshot],
    );

    const openAIMenu = useCallback(() => {
        if (!params.studentId) {
            toast.info("Selecione um aluno", "Para usar o menu de IA, abra o builder a partir de um aluno.");
            return;
        }
        openAIPrescriptionMenu({
            aiEnabled,
            onChoose: (choice) => {
                if (choice === "ai_full") {
                    if (draft.originatedFromAi) {
                        Alert.alert(
                            "Substituir programa gerado?",
                            "Isso descartará o programa atual e gerará um novo. Continuar?",
                            [
                                { text: "Cancelar", style: "cancel" },
                                {
                                    text: "Substituir",
                                    style: "destructive",
                                    onPress: () => {
                                        reset();
                                        // Re-init with the studentId so the empty draft keeps it.
                                        if (params.studentId) initNewProgram(params.studentId);
                                        setShowAISheet(true);
                                    },
                                },
                            ],
                        );
                    } else {
                        setShowAISheet(true);
                    }
                } else if (choice === "text_paste") {
                    setShowTextSheet(true);
                }
            },
        });
    }, [aiEnabled, params.studentId, draft.originatedFromAi, reset, initNewProgram]);

    const handleParsedText = useCallback(
        (result: {
            workouts: Array<{
                name: string;
                exercises: Array<{
                    matched: boolean;
                    exercise_id: string | null;
                    catalog_name: string | null;
                    original_text: string;
                    sets: number;
                    reps: string;
                    rest_seconds: number | null;
                    notes: string | null;
                    superset_group: string | null;
                    method_key?: import("@kinevo/shared/types/prescription").MethodKey | null;
                    set_scheme?: import("@kinevo/shared/types/prescription").WorkoutSet[] | null;
                    rounds?: number | null;
                }>;
            }>;
        }) => {
            if (!params.studentId) return;
            const workoutsForBuilder = result.workouts
                .map((w) => ({
                    name: w.name,
                    exercises: w.exercises
                        .filter((ex) => ex.matched && ex.exercise_id && ex.catalog_name)
                        .map((ex) => ({
                            exercise_id: ex.exercise_id!,
                            catalog_name: ex.catalog_name!,
                            sets: ex.sets,
                            reps: ex.reps,
                            rest_seconds: ex.rest_seconds,
                            notes: ex.notes,
                            superset_group: ex.superset_group ?? null,
                            method_key: ex.method_key ?? null,
                            set_scheme: ex.set_scheme ?? null,
                            rounds: ex.rounds ?? null,
                        })),
                }))
                .filter((w) => w.exercises.length > 0);
            useProgramBuilderStore.getState().addParsedWorkoutsToDraft(params.studentId, workoutsForBuilder);
            setShowTextSheet(false);
        },
        [params.studentId],
    );

    const handleBack = useCallback(() => {
        // Edit mode: never persist the loaded draft across navigations —
        // always reset on exit so a future "create new" flow doesn't see
        // editingAssignedProgramId leaking from the previous session.
        if (isEditMode) {
            if (isDirty) {
                Alert.alert(
                    "Descartar alterações?",
                    "As alterações de nome/descrição/duração não salvas serão perdidas.",
                    [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Descartar", style: "destructive", onPress: () => { reset(); router.back(); } },
                    ]
                );
            } else {
                reset();
                router.back();
            }
            return;
        }
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
    }, [isDirty, reset, router, isEditMode]);

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
                onDuplicate={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    duplicateItem(currentWorkout.id, item.id);
                }}
                onEditSets={() => setSetSchemeEditingItemId(item.id)}
                onExitAdvanced={() => {
                    // Toggle "Modo simples" no card: limpa set_scheme/method/rounds
                    // e re-popula agregados via summarize. Mesma lógica do web
                    // (workout-item-card.tsx). O confirm fica no row.
                    if (!item.set_scheme || item.set_scheme.length === 0) return;
                    const compound = isCompoundMethod(item.method_key ?? null);
                    const effectiveRounds = compound
                        ? Math.max(1, Math.min(20, Math.floor(item.rounds ?? 1)))
                        : 1;
                    const summary = effectiveRounds > 1
                        ? summarizeWithRounds(item.set_scheme, effectiveRounds)
                        : summarizeSetScheme(item.set_scheme);
                    setSetScheme(currentWorkout.id, item.id, null, null, 1);
                    updateItem(currentWorkout.id, item.id, {
                        sets: summary.sets,
                        reps: summary.reps,
                        rest_seconds: summary.rest_seconds,
                    });
                }}
                drag={drag}
                isActive={isActive}
            />
        );
    }, [currentWorkout, updateItem, removeItem, duplicateItem, setSetScheme]);

    const editingItem = useMemo(() => {
        if (!setSchemeEditingItemId || !currentWorkout) return null;
        return currentWorkout.items.find((it) => it.id === setSchemeEditingItemId) ?? null;
    }, [setSchemeEditingItemId, currentWorkout]);

    const handleSchemeSave = useCallback(
        (result: SetSchemeEditorResult) => {
            if (!currentWorkout || !editingItem) {
                setSetSchemeEditingItemId(null);
                return;
            }
            // Persist new scheme + method + rounds on the item.
            setSetScheme(currentWorkout.id, editingItem.id, result.scheme, result.methodKey, result.rounds);
            // When user exited advanced or saved, also re-sync aggregates so
            // the inline simple-mode inputs reflect the new summary.
            if (result.aggregates) {
                updateItem(currentWorkout.id, editingItem.id, {
                    sets: result.aggregates.sets,
                    reps: result.aggregates.reps,
                    rest_seconds: result.aggregates.rest_seconds,
                });
            }
            setSetSchemeEditingItemId(null);
        },
        [currentWorkout, editingItem, setSetScheme, updateItem],
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.surface.canvas }}
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
                    {/* Header — premium 3-line layout
                        Linha 1: back + duração inline (compact)
                        Linha 2: título grande (hero)
                        Linha 3: meta chips contextuais + actions */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12 }}>
                        {/* Linha 1 — back + duração */}
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <TouchableOpacity
                                onPress={handleBack}
                                accessibilityRole="button"
                                accessibilityLabel="Voltar"
                                hitSlop={8}
                                style={{ flexDirection: "row", alignItems: "center", marginLeft: -4 }}
                            >
                                <ChevronLeft size={22} color={colors.purple[600]} />
                                <Text style={{ fontSize: 15, color: colors.purple[600], marginLeft: 2 }}>Voltar</Text>
                            </TouchableOpacity>

                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: colors.surface.card,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                            }}>
                                <Calendar size={13} color={colors.text.tertiary} />
                                <Text style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: '500' }}>
                                    Duração
                                </Text>
                                <TextInput
                                    value={draft.duration_weeks != null ? String(draft.duration_weeks) : ''}
                                    onChangeText={(text) => {
                                        const num = parseInt(text);
                                        updateDurationWeeks(
                                            isNaN(num) ? null : Math.max(1, Math.min(52, num))
                                        );
                                    }}
                                    placeholder="–"
                                    placeholderTextColor={colors.text.quaternary}
                                    keyboardType="number-pad"
                                    accessibilityLabel="Duração em semanas"
                                    style={{
                                        minWidth: 22,
                                        textAlign: 'center',
                                        fontSize: 14,
                                        fontWeight: '700',
                                        color: colors.purple[600],
                                        padding: 0,
                                    }}
                                />
                                <Text style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: '500' }}>
                                    sem
                                </Text>
                            </View>
                        </View>

                        {/* Linha 2 — título hero (Nome do programa) */}
                        <TextInput
                            value={draft.name}
                            onChangeText={updateName}
                            onFocus={() => setNameFocused(true)}
                            onBlur={() => setNameFocused(false)}
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
                            value={draft.description}
                            onChangeText={updateDescription}
                            onFocus={() => setDescriptionFocused(true)}
                            onBlur={() => setDescriptionFocused(false)}
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
                                borderColor: descriptionFocused ? colors.purple[500] : colors.border.default,
                                minHeight: 48,
                            }}
                        />

                        {/* Linha 3 — meta chips + actions */}
                        <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                                {/* duração editável vive na linha 1 (com label "Duração"); aqui só
                                    métricas derivadas dos exercícios. */}
                                {metaChips.exerciseCount != null && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        paddingHorizontal: 9,
                                        paddingVertical: 5,
                                        borderRadius: 8,
                                        backgroundColor: colors.surface.card2,
                                    }}>
                                        <Layers size={11} color={colors.text.secondary} />
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
                                            {metaChips.exerciseCount} exerc.
                                        </Text>
                                    </View>
                                )}
                                {metaChips.avgWorkoutMinutes != null && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        paddingHorizontal: 9,
                                        paddingVertical: 5,
                                        borderRadius: 8,
                                        backgroundColor: colors.surface.card2,
                                    }}>
                                        <Timer size={11} color={colors.text.secondary} />
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
                                            ~{metaChips.avgWorkoutMinutes} min
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                {(() => {
                                    const hasExercises = draft.workouts.some((w) => w.items.length > 0);
                                    return (
                                        <TouchableOpacity
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                router.push('/program-builder/preview');
                                            }}
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
                                    );
                                })()}
                                <TouchableOpacity
                                    onPress={handleSave}
                                    disabled={isSaving}
                                    accessibilityRole="button"
                                    accessibilityLabel="Salvar programa"
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        backgroundColor: colors.purple[600],
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 10,
                                        opacity: isSaving ? 0.6 : 1,
                                        gap: 4,
                                    }}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator size="small" color={'#FFFFFF'} />
                                    ) : (
                                        <Save size={14} color={'#FFFFFF'} />
                                    )}
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: '#FFFFFF' }}>
                                        Salvar
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Volume Summary */}
                    <VolumeSummary workouts={draft.workouts} />

                    {/* Workout selector — horizontal scroll de cards premium */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                            gap: 10,
                            alignItems: 'center',
                        }}
                        style={{ flexGrow: 0 }}
                    >
                        {draft.workouts.map((workout) => (
                            <WorkoutSelectorCard
                                key={workout.id}
                                workout={workout}
                                isActive={workout.id === currentWorkoutId}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setCurrentWorkout(workout.id);
                                }}
                                onLongPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    handleDeleteWorkout(workout.id, workout.name);
                                }}
                            />
                        ))}
                        <WorkoutSelectorAddCard
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                addWorkout();
                            }}
                            pulse={draft.workouts.every((w) => w.items.length === 0)}
                        />
                    </ScrollView>


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
                    ) : currentWorkout ? (
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <EmptyWorkoutState
                                workoutName={currentWorkout.name}
                                onAddExercise={() => setShowExercisePicker(true)}
                                onUseAI={openAIMenu}
                                onUseTemplate={() => {
                                    if (!params.studentId) {
                                        toast.info("Selecione um aluno", "Para usar um programa existente, abra o builder a partir de um aluno.");
                                        return;
                                    }
                                    setShowAssignWizard(true);
                                }}
                            />
                        </ScrollView>
                    ) : null}

                    {/* FAB - Add Exercise (phone only). Esconde no empty state:
                        EmptyWorkoutState já fornece o CTA primary equivalente. */}
                    {currentWorkout && currentWorkout.items.length > 0 && !isTablet && (
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
                                    backgroundColor: colors.purple[600],
                                    paddingHorizontal: 24,
                                    paddingVertical: 14,
                                    borderRadius: 16,
                                    gap: 8,
                                    shadowColor: colors.purple[600],
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.35,
                                    shadowRadius: 14,
                                    elevation: 10,
                                    minWidth: 220,
                                }}
                            >
                                <Plus size={18} color={'#FFFFFF'} strokeWidth={2.5} />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: '#FFFFFF' }}>
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

              {/* AI / Text / Existing program sheets — anchored to the studentId path. */}
              {params.studentId && (
                <>
                    <AIPrescriptionSheet
                        visible={showAISheet}
                        studentId={params.studentId}
                        studentName={studentName}
                        onClose={() => setShowAISheet(false)}
                        onSuccess={handleAIGenerated}
                    />
                    <TextPrescriptionSheet
                        visible={showTextSheet}
                        studentId={params.studentId}
                        studentName={studentName}
                        onClose={() => setShowTextSheet(false)}
                        onParsed={handleParsedText}
                    />
                    <AssignProgramWizard
                        visible={showAssignWizard}
                        studentId={params.studentId}
                        studentName={studentName}
                        hasActiveProgram={!!studentDetail?.activeProgram}
                        onClose={() => setShowAssignWizard(false)}
                        onSuccess={() => {
                            setShowAssignWizard(false);
                            router.back();
                        }}
                    />
                    {editingItem && (
                        <SetSchemeEditor
                            visible={!!setSchemeEditingItemId}
                            initialScheme={editingItem.set_scheme ?? null}
                            initialMethodKey={editingItem.method_key ?? null}
                            initialRounds={editingItem.rounds ?? 1}
                            fallbackAggregates={{
                                sets: editingItem.sets,
                                reps: editingItem.reps,
                                rest_seconds: editingItem.rest_seconds,
                            }}
                            exerciseName={editingItem.exercise_name}
                            onSave={handleSchemeSave}
                            onClose={() => setSetSchemeEditingItemId(null)}
                        />
                    )}
                </>
              )}
            </KeyboardAvoidingView>
        </GestureHandlerRootView>
    );
}

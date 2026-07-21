import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useV2Colors } from "@/hooks/useV2Colors";
import { useProgramBuilder } from "@/hooks/useProgramBuilder";
import { useResponsive } from "@/hooks/useResponsive";
import { ProgramBuilderCompactBar } from "@/components/trainer/program-builder/ProgramBuilderCompactBar";
import { ProgramBuilderListHeader } from "@/components/trainer/program-builder/ProgramBuilderListHeader";
import { openExerciseActionsMenu } from "@/components/trainer/program-builder/ExerciseActionsMenu";
import { EmptyWorkoutState } from "@/components/trainer/program-builder/EmptyWorkoutState";
import { WorkoutItemRow } from "@/components/trainer/program-builder/WorkoutItemRow";
import { SetSchemeEditor, type SetSchemeEditorResult } from "@/components/trainer/program-builder/SetSchemeEditor";
import { ExercisePickerModal } from "@/components/trainer/program-builder/ExercisePickerModal";
import { QuickEditSheet } from "@/components/trainer/program-builder/QuickEditSheet";
import { AddBlockSheet } from "@/components/trainer/program-builder/AddBlockSheet";
import { EditNoteSheet } from "@/components/trainer/program-builder/EditNoteSheet";
import { EditWarmupSheet } from "@/components/trainer/program-builder/EditWarmupSheet";
import { EditCardioSheet } from "@/components/trainer/program-builder/EditCardioSheet";
import { ExercisePanel } from "@/components/trainer/program-builder/ExercisePanel";
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
import { supabase } from "@/lib/supabase";
import {
    saveProgramDraft,
    removeProgramDraft,
    getProgramDraft,
    isProgramDraftMeaningful,
    draftKeyFor,
    studentDraftKey,
} from "@/lib/program-drafts";

export default function ProgramBuilderScreen() {
    const colors = useV2Colors();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ studentId?: string; mode?: string; resume?: string }>();
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [showAISheet, setShowAISheet] = useState(false);
    const [showTextSheet, setShowTextSheet] = useState(false);
    const [showAssignWizard, setShowAssignWizard] = useState(false);
    const [showAddBlockSheet, setShowAddBlockSheet] = useState(false);
    const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
    const [editingWarmupItemId, setEditingWarmupItemId] = useState<string | null>(null);
    const [editingCardioItemId, setEditingCardioItemId] = useState<string | null>(null);
    const { isTablet } = useResponsive();
    const initFromAiSnapshot = useProgramBuilderStore((s) => s.initFromAiSnapshot);
    const loadDraft = useProgramBuilderStore((s) => s.loadDraft);
    const setSetScheme = useProgramBuilderStore((s) => s.setSetScheme);
    const addNote = useProgramBuilderStore((s) => s.addNote);
    const addWarmup = useProgramBuilderStore((s) => s.addWarmup);
    const addCardio = useProgramBuilderStore((s) => s.addCardio);
    const clearSupersets = useProgramBuilderStore((s) => s.clearSupersets);
    const clearAllAdvancedSchemes = useProgramBuilderStore((s) => s.clearAllAdvancedSchemes);
    const [setSchemeEditingItemId, setSetSchemeEditingItemId] = useState<string | null>(null);
    // R9: no fluxo de revisão da IA o snapshot não transporta set_scheme/método,
    // então o editor avançado seria uma armadilha (edição descartada no save).
    // Bloqueia na entrada com explicação; o save tem cinto-e-suspensório.
    const openSchemeEditor = useCallback((itemId: string) => {
        const d = useProgramBuilderStore.getState().draft;
        if (d.originatedFromAi && d.generationId) {
            Alert.alert(
                "Métodos avançados não suportados",
                "A revisão de programa gerado por IA ainda não salva métodos/séries por fase (drop-set, pirâmide…). Salve o programa primeiro e edite-o depois pelo perfil do aluno, ou salve como programa novo.",
            );
            return;
        }
        setSetSchemeEditingItemId(itemId);
    }, []);
    const [quickEditingItemId, setQuickEditingItemId] = useState<string | null>(null);
    const [swapTargetItemId, setSwapTargetItemId] = useState<string | null>(null);
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
        updateStartDate,
        addWorkout,
        removeWorkout,
        renameWorkout,
        updateWorkoutFrequency,
        setWorkoutType,
        setCurrentWorkout,
        addExercise,
        swapExercise,
        updateItem,
        removeItem,
        duplicateItem,
        reorderItems,
        reset,
        saveAsTemplate,
        saveAndAssign,
        saveAsNewProgramDiscardingAi,
        saveAssignedProgramFull,
        saveTemplateFull,
    } = useProgramBuilder();

    // Edit mode (Round 1): the route loaded an existing assigned program via
    // `initFromAssignedProgram` and the builder must skip create-flow init,
    // render the read-only viewer + metadata-only save. We rely on
    // `editingAssignedProgramId` (set by initFromAssignedProgram) rather than
    // just `params.mode` so a mid-flight nav refresh can't show a stale draft.
    const isEditMode = params.mode === "edit" && !!draft.editingAssignedProgramId;
    // Edit-existing-template mode: route loaded a `program_templates` row via
    // `initFromTemplate`. Same full-editing UI, but the save writes the
    // `*_templates` tables via `saveTemplateFull`.
    const isEditTemplateMode = params.mode === "edit-template" && !!draft.editingTemplateId;
    // Combined flag for UI affordances shared by both edit flows (placeholder,
    // header copy, reset-on-exit).
    const isEditingExisting = isEditMode || isEditTemplateMode;

    // FCmáx do aluno: resolve zonas de FC em bpm na string derivada do cardio.
    // Draft de aluno usa params.studentId; edição de programa atribuído usa o
    // studentId hidratado no draft. Template puro → null (rótulo em %FCmáx).
    const cardioStudentId = draft.studentId ?? params.studentId ?? null;
    const [studentMaxHr, setStudentMaxHr] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (!cardioStudentId) {
            setStudentMaxHr(null);
            return;
        }
        supabase
            .from("students")
            .select("max_heart_rate_bpm")
            .eq("id", cardioStudentId)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setStudentMaxHr(data?.max_heart_rate_bpm ?? null);
            });
        return () => { cancelled = true; };
    }, [cardioStudentId]);

    useEffect(() => {
        // When coming from text prescription, AI hand-off, or edit-existing,
        // the store is already pre-filled (`initFromParsedText` /
        // `initFromAiSnapshot` / `initFromAssignedProgram`); don't blow it
        // away.
        if (params.mode === "from-text" || params.mode === "from-ai" || params.mode === "edit" || params.mode === "edit-template") return;
        // Plain create flow (sem mode): se existe um rascunho guardado deste
        // contexto, "Continuar montando" (resume=1) retoma direto; abrir pelo
        // hub de criar pergunta — continuar o rascunho ou começar do zero.
        if (!params.mode) {
            const key = params.studentId ? studentDraftKey(params.studentId) : "template:new";
            const saved = getProgramDraft(key);
            if (saved && isProgramDraftMeaningful(saved)) {
                if (params.resume === "1") {
                    loadDraft(saved);
                    return;
                }
                // Começa em branco (default visível) e pergunta o que fazer.
                initNewProgram(params.studentId);
                Alert.alert(
                    "Rascunho em andamento",
                    "Você tem um rascunho não salvo deste aluno. Deseja continuar de onde parou ou começar um novo programa do zero?",
                    [
                        { text: "Cancelar", style: "cancel", onPress: () => router.back() },
                        { text: "Começar do zero", style: "destructive", onPress: () => removeProgramDraft(key) },
                        { text: "Continuar rascunho", style: "default", onPress: () => loadDraft(saved) },
                    ],
                );
                return;
            }
        }
        // mode=ai opens the AI sheet on a fresh draft, but only after we
        // make sure the draft is initialized.
        initNewProgram(params.studentId);
    }, []);

    // Autosave-to-shelf: persiste o rascunho de CRIAÇÃO na prateleira
    // (lib/program-drafts) a cada alteração relevante, para que ele apareça na
    // aba Programas do aluno e sobreviva à saída. Edição de existente é
    // ignorada (mantém o reset-on-exit). MMKV é síncrono e rápido.
    useEffect(() => {
        if (isEditingExisting) return;
        if (!isDirty) return;
        if (!isProgramDraftMeaningful(draft)) return;
        saveProgramDraft(draft);
    }, [draft, isDirty, isEditingExisting]);

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

    // Meta chips (exerc./min) e demais conteúdo estático do header foram
    // extraídos pra ProgramBuilderListHeader.tsx — esse componente vive
    // como `ListHeaderComponent` da DraggableFlatList pra rolar junto com
    // os cards de exercício e liberar espaço de tela.

    const handleSave = useCallback(async () => {
        if (!draft.name.trim()) {
            Alert.alert("Nome obrigatório", "Dê um nome ao programa antes de salvar.");
            return;
        }

        const hasBlocks = draft.workouts.some(w => w.items.length > 0);
        if (!hasBlocks) {
            Alert.alert("Programa vazio", "Adicione pelo menos um bloco ao programa.");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Edit-template mode: full save against the *_templates tables.
        if (isEditTemplateMode) {
            const result = await saveTemplateFull();
            if (result.ok) {
                reset();
                router.back();
            }
            return;
        }

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
                    removeProgramDraft(studentDraftKey(params.studentId));
                    router.back();
                    return;
                }
                if (result.reason === "SUPERSET_BLOCKED") {
                    Alert.alert(
                        "Supersets não suportados",
                        "O snapshot de IA não suporta supersets. Remova os supersets adicionados, ou salve como programa novo (sem vincular à geração).",
                        [
                            { text: "Cancelar", style: "cancel" },
                            {
                                text: "Remover supersets",
                                style: "default",
                                onPress: async () => {
                                    clearSupersets();
                                    const r2 = await saveAndAssign(params.studentId!);
                                    if (r2.ok) {
                                        removeProgramDraft(studentDraftKey(params.studentId!));
                                        reset();
                                        router.back();
                                    }
                                },
                            },
                            {
                                text: "Salvar como programa novo",
                                style: "destructive",
                                onPress: async () => {
                                    const r2 = await saveAsNewProgramDiscardingAi(params.studentId!);
                                    if (r2.ok) {
                                        removeProgramDraft(studentDraftKey(params.studentId!));
                                        router.back();
                                    }
                                },
                            },
                        ],
                    );
                    return;
                }
                if (result.reason === "ADVANCED_SCHEME_BLOCKED") {
                    // R9: snapshot de IA não transporta set_scheme/método —
                    // sem este bloqueio o save descartava a prescrição
                    // avançada em silêncio (aluno recebia só os agregados).
                    Alert.alert(
                        "Métodos avançados não suportados",
                        "A revisão de programa gerado por IA ainda não salva métodos/séries por fase (drop-set, pirâmide…). Salve como programa novo para manter os métodos (sem vincular à geração), ou remova os métodos e mantenha o fluxo de IA.",
                        [
                            { text: "Cancelar", style: "cancel" },
                            {
                                text: "Salvar como programa novo",
                                style: "default",
                                onPress: async () => {
                                    const r2 = await saveAsNewProgramDiscardingAi(params.studentId!);
                                    if (r2.ok) {
                                        removeProgramDraft(studentDraftKey(params.studentId!));
                                        router.back();
                                    }
                                },
                            },
                            {
                                text: "Remover métodos",
                                style: "destructive",
                                onPress: async () => {
                                    clearAllAdvancedSchemes();
                                    const r2 = await saveAndAssign(params.studentId!);
                                    if (r2.ok) {
                                        removeProgramDraft(studentDraftKey(params.studentId!));
                                        reset();
                                        router.back();
                                    }
                                },
                            },
                        ],
                    );
                    return;
                }
                // ERROR — toast already shown by the hook.
            } else {
                await saveAsTemplate();
                removeProgramDraft("template:new");
                reset();
                router.back();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido';
            if (__DEV__) console.error('[program-builder] save failed:', err);
            Alert.alert(
                'Erro ao salvar',
                `${message}\n\nTente novamente. Se persistir, contate o suporte.`
            );
        }
    }, [draft, params.studentId, saveAndAssign, saveAsNewProgramDiscardingAi, saveAsTemplate, reset, router, isEditMode, saveAssignedProgramFull, isEditTemplateMode, saveTemplateFull, clearSupersets, clearAllAdvancedSchemes]);

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
        if (isEditingExisting) {
            if (isDirty) {
                Alert.alert(
                    "Descartar alterações?",
                    "As alterações não salvas serão perdidas.",
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
                "Sair sem salvar?",
                "Você tem alterações não salvas neste treino. Salve como rascunho para continuar depois na aba Programas do aluno, ou descarte.",
                [
                    { text: "Continuar editando", style: "cancel" },
                    {
                        text: "Descartar",
                        style: "destructive",
                        onPress: () => {
                            const key = draftKeyFor(draft);
                            if (key) removeProgramDraft(key);
                            reset();
                            router.back();
                        },
                    },
                    {
                        text: "Salvar como rascunho",
                        style: "default",
                        onPress: () => {
                            saveProgramDraft(draft);
                            reset();
                            router.back();
                        },
                    },
                ]
            );
        } else {
            router.back();
        }
    }, [isDirty, draft, reset, router, isEditingExisting]);

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
                onEditSets={() => openSchemeEditor(item.id)}
                onQuickEdit={() => setQuickEditingItemId(item.id)}
                onEditNote={() => setEditingNoteItemId(item.id)}
                onEditWarmup={() => setEditingWarmupItemId(item.id)}
                onEditCardio={() => setEditingCardioItemId(item.id)}
                onOpenActions={() => {
                    openExerciseActionsMenu({
                        exerciseName: item.exercise_name,
                        onChoose: (choice) => {
                            if (choice === 'quick_edit') {
                                // R10: item em modo avançado edita pelo editor de
                                // séries (mesmo roteamento do tap no card) — o
                                // QuickEdit gravaria agregados que o save recomputa
                                // do scheme e descarta em silêncio.
                                if (item.set_scheme && item.set_scheme.length > 0) {
                                    openSchemeEditor(item.id);
                                } else {
                                    setQuickEditingItemId(item.id);
                                }
                            } else if (choice === 'swap_exercise') {
                                // R30: container de superset não tem exercício próprio.
                                if (item.item_type === 'superset') {
                                    Alert.alert('Superset', 'O bloco não tem exercício próprio — troque os exercícios de dentro dele.');
                                    return;
                                }
                                setSwapTargetItemId(item.id);
                            } else if (choice === 'edit_sets') {
                                // R30: scheme em container de superset é lixo gravável.
                                if (item.item_type === 'superset') {
                                    Alert.alert('Superset', 'Métodos avançados são configurados nos exercícios de dentro do bloco.');
                                    return;
                                }
                                openSchemeEditor(item.id);
                            } else if (choice === 'duplicate') {
                                duplicateItem(currentWorkout.id, item.id);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                            } else if (choice === 'delete') {
                                Alert.alert(
                                    'Excluir exercício',
                                    `Deseja excluir "${item.exercise_name}"? Esta ação não pode ser desfeita.`,
                                    [
                                        { text: 'Cancelar', style: 'cancel' },
                                        {
                                            text: 'Excluir',
                                            style: 'destructive',
                                            onPress: () => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                                removeItem(currentWorkout.id, item.id);
                                            },
                                        },
                                    ],
                                );
                            }
                        },
                    });
                }}
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

    const quickEditingItem = useMemo(() => {
        if (!quickEditingItemId || !currentWorkout) return null;
        return currentWorkout.items.find((it) => it.id === quickEditingItemId) ?? null;
    }, [quickEditingItemId, currentWorkout]);

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
                    {/* Compact bar — sempre visível no topo (Back + Nome
                     *  do programa truncado + Salvar pequeno).
                     *  O resto do header (nome/descrição/stats/workout
                     *  selector/workout detail/hint) vive como
                     *  `ListHeaderComponent` da DraggableFlatList e
                     *  rola junto com os cards. */}
                    <ProgramBuilderCompactBar
                        programName={draft.name}
                        placeholder={isEditTemplateMode ? "Editar modelo" : isEditMode ? "Editar programa" : "Sem nome"}
                        onBack={handleBack}
                        onSave={handleSave}
                        isSaving={isSaving}
                    />

                    {(() => {
                        if (!currentWorkout) return null;
                        const listHeader = (
                            <ProgramBuilderListHeader
                                name={draft.name}
                                description={draft.description}
                                durationWeeks={draft.duration_weeks}
                                startDate={draft.start_date}
                                assignmentType={draft.assignment_type}
                                showSchedule={isEditMode}
                                workouts={draft.workouts}
                                currentWorkout={currentWorkout}
                                currentWorkoutId={currentWorkoutId}
                                isEditMode={isEditingExisting}
                                nameFocused={nameFocused}
                                descriptionFocused={descriptionFocused}
                                onNameFocus={() => setNameFocused(true)}
                                onNameBlur={() => setNameFocused(false)}
                                onDescriptionFocus={() => setDescriptionFocused(true)}
                                onDescriptionBlur={() => setDescriptionFocused(false)}
                                onUpdateName={updateName}
                                onUpdateDescription={updateDescription}
                                onUpdateDurationWeeks={updateDurationWeeks}
                                onUpdateStartDate={updateStartDate}
                                onAddWorkout={addWorkout}
                                onSelectWorkout={setCurrentWorkout}
                                onRenameWorkout={renameWorkout}
                                onUpdateWorkoutFrequency={updateWorkoutFrequency}
                                onChangeWorkoutType={setWorkoutType}
                                onDeleteWorkout={handleDeleteWorkout}
                                onPreview={() => {
                                    Haptics.selectionAsync();
                                    router.push('/program-builder/preview');
                                }}
                            />
                        );

                        if (currentWorkout.items.length > 0) {
                            // Wrapper View com flex:1 dá altura pro
                            // DraggableFlatList sem precisar de
                            // containerStyle (que sobrepunha o header
                            // detail antes).
                            return (
                                <View style={{ flex: 1 }}>
                                    <DraggableFlatList
                                        data={currentWorkout.items}
                                        keyExtractor={(item) => item.id}
                                        renderItem={renderWorkoutItem}
                                        ListHeaderComponent={listHeader}
                                        onDragEnd={({ data }) => {
                                            reorderItems(currentWorkout.id, data);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        contentContainerStyle={{ paddingTop: 0, paddingBottom: 180 }}
                                        showsVerticalScrollIndicator={false}
                                    />
                                </View>
                            );
                        }

                        // Empty state: header full no topo (escrolla) +
                        // EmptyWorkoutState centralizado no espaço restante.
                        return (
                            <ScrollView
                                contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {listHeader}
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <EmptyWorkoutState
                                        workoutName={currentWorkout.name}
                                        onAddBlock={() => setShowAddBlockSheet(true)}
                                        onUseAI={openAIMenu}
                                        onUseTemplate={() => {
                                            if (!params.studentId) {
                                                toast.info("Selecione um aluno", "Para usar um programa existente, abra o builder a partir de um aluno.");
                                                return;
                                            }
                                            setShowAssignWizard(true);
                                        }}
                                    />
                                </View>
                            </ScrollView>
                        );
                    })()}

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
                                    setShowAddBlockSheet(true);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Adicionar bloco ao treino"
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
                                    Adicionar
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Exercise Picker (phone only) */}
                    {/* R11: sem gate de tablet — no iPad estes sheets eram
                        estado sem UI (botões mortos); mesmo fix do swap picker. */}
                    <ExercisePickerModal
                        visible={showExercisePicker}
                        onClose={() => setShowExercisePicker(false)}
                        onSelect={handleExerciseSelected}
                    />

                    {/* Add Block Sheet — 4 options (exercise/warmup/cardio/note) */}
                    <AddBlockSheet
                        visible={showAddBlockSheet}
                        sessionType={currentWorkout?.workout_type === 'cardio' ? 'cardio' : 'strength'}
                        onClose={() => setShowAddBlockSheet(false)}
                        onAddExercise={() => {
                            setShowAddBlockSheet(false);
                            setShowExercisePicker(true);
                        }}
                        onAddWarmup={() => {
                            if (!currentWorkout) return;
                            addWarmup(currentWorkout.id);
                            setShowAddBlockSheet(false);
                        }}
                        onAddCardio={() => {
                            if (!currentWorkout) return;
                            addCardio(currentWorkout.id);
                            setShowAddBlockSheet(false);
                        }}
                        onAddNote={() => {
                            if (!currentWorkout) return;
                            addNote(currentWorkout.id);
                            setShowAddBlockSheet(false);
                        }}
                    />

                    {/* Edit Note Sheet */}
                    {currentWorkout && (() => {
                        const editingItem = editingNoteItemId
                            ? currentWorkout.items.find((it) => it.id === editingNoteItemId)
                            : null;
                        return (
                            <EditNoteSheet
                                visible={!!editingItem}
                                initialText={editingItem?.notes ?? ""}
                                onSave={(text) => {
                                    if (editingItem) {
                                        updateItem(currentWorkout.id, editingItem.id, { notes: text });
                                    }
                                    setEditingNoteItemId(null);
                                }}
                                onClose={() => setEditingNoteItemId(null)}
                            />
                        );
                    })()}

                    {/* Edit Warmup Sheet */}
                    {currentWorkout && (() => {
                        const editingItem = editingWarmupItemId
                            ? currentWorkout.items.find((it) => it.id === editingWarmupItemId)
                            : null;
                        const initialDescription =
                            typeof editingItem?.item_config?.description === "string"
                                ? (editingItem.item_config.description as string)
                                : "";
                        return (
                            <EditWarmupSheet
                                visible={!!editingItem}
                                initialDescription={initialDescription}
                                onSave={(description) => {
                                    if (editingItem) {
                                        // Merge, não replace: preserva warmup_type e
                                        // duration_minutes de um warmup criado no web.
                                        const cfg = editingItem.item_config ?? {};
                                        updateItem(currentWorkout.id, editingItem.id, {
                                            item_config: {
                                                ...cfg,
                                                warmup_type: typeof cfg.warmup_type === "string"
                                                    ? cfg.warmup_type
                                                    : "free",
                                                description,
                                            },
                                        });
                                    }
                                    setEditingWarmupItemId(null);
                                }}
                                onClose={() => setEditingWarmupItemId(null)}
                            />
                        );
                    })()}

                    {/* Edit Cardio Sheet — recebe o item_config cru; o sheet
                     *  devolve o config canônico mesclado (preserva protocolo
                     *  intervalado do web, migra o legado mobile). */}
                    {currentWorkout && (() => {
                        const editingItem = editingCardioItemId
                            ? currentWorkout.items.find((it) => it.id === editingCardioItemId)
                            : null;
                        return (
                            <EditCardioSheet
                                visible={!!editingItem}
                                initialConfig={editingItem?.item_config ?? {}}
                                maxHrBpm={studentMaxHr}
                                onSave={(next) => {
                                    if (editingItem) {
                                        updateItem(currentWorkout.id, editingItem.id, {
                                            item_config: next,
                                        });
                                    }
                                    setEditingCardioItemId(null);
                                }}
                                onClose={() => setEditingCardioItemId(null)}
                            />
                        );
                    })()}
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
                </>
              )}

              {/* Sheets de edição de item — NÃO dependem de aluno: precisam
               *  renderizar também nos fluxos de modelo (criar/editar template,
               *  sem studentId na rota). Dentro do gate acima, todo exercício
               *  de template ficava travado em 3×10/60s (achado A3). */}
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

              {/* Quick-edit (séries/reps/descanso) — default ao tocar no
               *  card e via "..." > "Editar". */}
              {quickEditingItem && currentWorkout && (
                  <QuickEditSheet
                      visible={!!quickEditingItemId}
                      exerciseName={quickEditingItem.exercise_name}
                      initial={{
                          sets: quickEditingItem.sets ?? 3,
                          reps: quickEditingItem.reps ?? '10',
                          rest_seconds: quickEditingItem.rest_seconds ?? 60,
                      }}
                      onClose={() => setQuickEditingItemId(null)}
                      onSave={(next) => {
                          // R30: container de superset — só o DESCANSO é real
                          // (rodadas vêm dos filhos; sets/reps no pai são
                          // ignorados pela execução, e o default reps '0'
                          // corrompia o pai). Aplica o rest e espelha no
                          // último filho (a execução usa o rest POR FILHO).
                          if (quickEditingItem.item_type === 'superset') {
                              updateItem(currentWorkout.id, quickEditingItem.id, { rest_seconds: next.rest_seconds });
                              const kids = currentWorkout.items
                                  .filter(i => i.parent_item_id === quickEditingItem.id)
                                  .sort((a, b) => a.order_index - b.order_index);
                              const last = kids[kids.length - 1];
                              if (last) updateItem(currentWorkout.id, last.id, { rest_seconds: next.rest_seconds });
                              return;
                          }
                          updateItem(currentWorkout.id, quickEditingItem.id, next);
                      }}
                      // Filho de superset NÃO oferece edição avançada: o save
                      // nunca persiste scheme de filho (V1) — o editor seria
                      // uma armadilha de edição descartada (classe A2).
                      // R30: container de superset idem (scheme em pai é lixo).
                      onOpenAdvanced={quickEditingItem.parent_item_id || quickEditingItem.item_type === 'superset' ? undefined : () => {
                          openSchemeEditor(quickEditingItem.id);
                      }}
                  />
              )}

              {/* Trocar exercício — reusa o ExercisePickerModal: ao
               *  selecionar, dispara swapExercise mantendo prescrição.
               *  Também no tablet: o painel lateral só ADICIONA; sem este
               *  modal a troca ficava morta lá (achado da auditoria). */}
              <ExercisePickerModal
                  visible={!!swapTargetItemId}
                  onClose={() => setSwapTargetItemId(null)}
                  onSelect={(exercise) => {
                      if (!currentWorkout || !swapTargetItemId) return;
                      swapExercise(currentWorkout.id, swapTargetItemId, exercise);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                      setSwapTargetItemId(null);
                  }}
              />
            </KeyboardAvoidingView>
        </GestureHandlerRootView>
    );
}

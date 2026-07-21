import React, { useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    FlatList,
    TextInput,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Search, Dumbbell, Plus, Trash2, Settings, ChevronLeft } from "lucide-react-native";
import Animated, { FadeInUp, Easing, FadeIn } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { EmptyState } from "../../components/shared/EmptyState";
import { useExerciseLibrary, type Exercise } from "../../hooks/useExerciseLibrary";
import { useExerciseCrud } from "../../hooks/useExerciseCrud";
import { useRoleMode } from "../../contexts/RoleModeContext";
import { PressableScale } from "../../components/shared/PressableScale";
import { ExerciseFormModal } from "../../components/trainer/exercises/ExerciseFormModal";
import { MuscleGroupManagerModal } from "../../components/trainer/exercises/MuscleGroupManagerModal";
import { ConciergeButton } from "../../components/concierge/ConciergeButton";
import { ConciergeBottomSheet } from "../../components/concierge/ConciergeBottomSheet";
import { useMuscleGroupCrud } from "../../hooks/useMuscleGroupCrud";
import { toast } from "../../lib/toast";
import { useV2Colors } from "../../hooks/useV2Colors";



// PF8: memoizado + callbacks ESTÁVEIS por item (o card chama com o próprio
// exercise) — renderItem inline recriava as arrows a cada tecla da busca e
// re-renderizava todas as células montadas (500+ exercícios, Swipeable+sombras).
const SwipeableExerciseCard = React.memo(function SwipeableExerciseCard({
    exercise,
    onPressItem,
    isOwner,
    onDeleteItem,
}: {
    exercise: Exercise;
    onPressItem: (id: string) => void;
    isOwner: boolean;
    onDeleteItem: (exercise: Exercise) => void;
}) {
    const colors = useV2Colors();
    const swipeableRef = useRef<Swipeable>(null);

    const isSystem = exercise.owner_id === null;

    const renderRightActions = () => {
        if (!isOwner) return null;
        return (
            <TouchableOpacity
                onPress={() => {
                    swipeableRef.current?.close();
                    onDeleteItem(exercise);
                }}
                activeOpacity={0.7}
                accessibilityLabel="Excluir exercício"
                accessibilityRole="button"
                style={{
                    backgroundColor: colors.semantic.danger.default,
                    justifyContent: "center",
                    alignItems: "center",
                    width: 80,
                    borderRadius: 14,
                    marginBottom: 10,
                    marginLeft: 8,
                }}
            >
                <Trash2 size={20} color="#FFFFFF" />
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#ffffff", marginTop: 4 }}>
                    Excluir
                </Text>
            </TouchableOpacity>
        );
    };

    const card = (
        <PressableScale onPress={() => onPressItem(exercise.id)} pressScale={0.98}>
            <View
                style={{
                    backgroundColor: colors.surface.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.05)",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 3,
                    elevation: 1,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text.primary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {exercise.name}
                    </Text>
                    {isSystem ? (
                        <View style={{ backgroundColor: colors.surface.card2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: colors.text.tertiary, letterSpacing: 0.5 }}>SISTEMA</Text>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: colors.purple[100], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: colors.purple[600], letterSpacing: 0.5 }}>CUSTOM</Text>
                        </View>
                    )}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {exercise.muscle_groups.map((mg) => (
                        <View key={mg.id} style={{ backgroundColor: colors.purple[100], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.purple[600] }}>{mg.name}</Text>
                        </View>
                    ))}

                </View>
            </View>
        </PressableScale>
    );

    if (!isOwner) return card;

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            friction={2}
            rightThreshold={40}
        >
            {card}
        </Swipeable>
    );
});

export default function ExercisesListScreen() {
    const colors = useV2Colors();
    const router = useRouter();
    // A6: dono do exercício é `trainers.id` (owner_id gravado pelo useExerciseCrud),
    // não o auth.users.id — comparar com user.id deixava isOwner sempre false.
    const { trainerId } = useRoleMode();
    const {
        exercises,
        muscleGroups,
        exerciseFunctions,
        search,
        setSearch,
        muscleFilter,
        setMuscleFilter,
        functionFilter,
        setFunctionFilter,
        ownerFilter,
        setOwnerFilter,
        canFilterOwn,
        isLoading,
        refresh,
    } = useExerciseLibrary();

    const { createExercise, deleteExercise, isSaving } = useExerciseCrud(refresh);
    const muscleGroupCrud = useMuscleGroupCrud();
    const [showFormModal, setShowFormModal] = useState(false);
    const [showMuscleGroupManager, setShowMuscleGroupManager] = useState(false);
    const [showConcierge, setShowConcierge] = useState(false);

    const handleCreate = useCallback(async (data: Parameters<typeof createExercise>[0]) => {
        try {
            await createExercise(data);
            toast.success("Exercício criado!");
            setShowFormModal(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Falha ao criar exercício.";
            toast.error("Erro", message);
        }
    }, [createExercise]);

    const handleDelete = useCallback((exercise: Exercise) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            "Excluir exercício",
            `Deseja excluir "${exercise.name}"? Esta ação não pode ser desfeita.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteExercise(exercise.id);
                            toast.success("Exercício excluído!");
                        } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : "Falha ao excluir.";
                            toast.error("Erro", message);
                        }
                    },
                },
            ]
        );
    }, [deleteExercise]);

    // PF8: identidades estáveis — digitar na busca re-renderiza o parent, mas
    // com renderItem/callbacks estáveis o FlatList não re-renderiza as células
    // montadas (React Compiler está DESLIGADO no mobile; memo manual importa).
    const handlePressItem = useCallback(
        (id: string) => router.push({ pathname: "/exercises/[id]", params: { id } }),
        [router],
    );
    const renderExercise = useCallback(
        ({ item }: { item: Exercise }) => (
            <SwipeableExerciseCard
                exercise={item}
                isOwner={!!trainerId && item.owner_id === trainerId}
                onPressItem={handlePressItem}
                onDeleteItem={handleDelete}
            />
        ),
        [trainerId, handlePressItem, handleDelete],
    );

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.canvas }} edges={["top"]}>
                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingTop: 8,
                    paddingBottom: 4,
                    gap: 8,
                }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Voltar"
                        hitSlop={8}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ChevronLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 20, fontWeight: "700", color: colors.text.primary }}>
                        Exercícios
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ConciergeButton onPress={() => setShowConcierge(true)} />
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowMuscleGroupManager(true);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Gerenciar grupos musculares"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                backgroundColor: colors.purple[100],
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Settings size={18} color={colors.purple[600]} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search */}
                <Animated.View
                    entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
                    style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: colors.surface.card,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            gap: 10,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.05)",
                        }}
                    >
                        <Search size={18} color={colors.text.tertiary} />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar exercício..."
                            placeholderTextColor="#8A8681"
                            style={{ flex: 1, fontSize: 14, color: colors.text.primary }}
                            accessibilityLabel="Buscar exercício"
                        />
                    </View>
                </Animated.View>

                {/* Muscle Group Filters */}
                <View style={{ flexGrow: 0, paddingTop: 4, paddingBottom: 14 }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingLeft: 20, paddingRight: 40, gap: 8, alignItems: "center" }}
                    >
                        {canFilterOwn && (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setOwnerFilter(ownerFilter === "mine" ? "all" : "mine");
                                }}
                                style={{
                                    paddingHorizontal: 16,
                                    height: 36,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderRadius: 18,
                                    backgroundColor: ownerFilter === "mine" ? colors.purple[600] : colors.surface.card,
                                    borderWidth: 1,
                                    borderColor: ownerFilter === "mine" ? colors.purple[600] : colors.border.default,
                                }}
                                accessibilityLabel="Apenas meus exercícios"
                                accessibilityRole="button"
                                accessibilityState={{ selected: ownerFilter === "mine" }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: "600", color: ownerFilter === "mine" ? "#ffffff" : colors.text.secondary }}>
                                    Meus
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.selectionAsync();
                                setMuscleFilter(null);
                            }}
                            style={{
                                paddingHorizontal: 16,
                                height: 36,
                                justifyContent: "center",
                                alignItems: "center",
                                borderRadius: 18,
                                backgroundColor: muscleFilter === null ? colors.purple[600] : colors.surface.card,
                                borderWidth: 1,
                                borderColor: muscleFilter === null ? colors.purple[600] : colors.border.default,
                            }}
                            accessibilityLabel="Todos os grupos musculares"
                            accessibilityRole="button"
                        >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: muscleFilter === null ? "#ffffff" : colors.text.secondary }}>
                                Todos
                            </Text>
                        </TouchableOpacity>
                        {muscleGroups.map((mg) => (
                            <TouchableOpacity
                                key={mg.id}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setMuscleFilter(muscleFilter === mg.id ? null : mg.id);
                                }}
                                style={{
                                    paddingHorizontal: 16,
                                    height: 36,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    borderRadius: 18,
                                    backgroundColor: muscleFilter === mg.id ? colors.purple[600] : colors.surface.card,
                                    borderWidth: 1,
                                    borderColor: muscleFilter === mg.id ? colors.purple[600] : colors.border.default,
                                }}
                                accessibilityLabel={mg.name}
                                accessibilityRole="button"
                            >
                                <Text style={{ fontSize: 13, fontWeight: "600", color: muscleFilter === mg.id ? "#ffffff" : colors.text.secondary }}>
                                    {mg.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Funções de treino ("pra quê") — só aparece se houver exercício taggeado */}
                {exerciseFunctions.length > 0 && (
                    <View style={{ marginBottom: 4 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 8 }}
                        >
                            {exerciseFunctions.map((fn) => (
                                <TouchableOpacity
                                    key={fn.id}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setFunctionFilter(functionFilter === fn.id ? null : fn.id);
                                    }}
                                    style={{
                                        paddingHorizontal: 14,
                                        height: 30,
                                        justifyContent: "center",
                                        alignItems: "center",
                                        borderRadius: 15,
                                        backgroundColor: functionFilter === fn.id ? colors.purple[600] : colors.surface.card,
                                        borderWidth: 1,
                                        borderColor: functionFilter === fn.id ? colors.purple[600] : colors.border.default,
                                    }}
                                    accessibilityLabel={`Função: ${fn.name}`}
                                    accessibilityRole="button"
                                >
                                    <Text style={{ fontSize: 11, fontWeight: "600", color: functionFilter === fn.id ? "#ffffff" : colors.text.tertiary }}>
                                        {fn.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* List */}
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={colors.purple[600]} />
                    </View>
                ) : exercises.length === 0 ? (
                    <EmptyState
                        icon={<Dumbbell size={40} color={colors.text.quaternary} />}
                        title="Nenhum exercício encontrado"
                        description="Tente ajustar os filtros ou crie um novo exercício"
                    />
                ) : (
                    <FlatList
                        data={exercises}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                        renderItem={renderExercise}
                        onRefresh={refresh}
                        refreshing={isLoading}
                    />
                )}

                {/* FAB */}
                <Animated.View
                    entering={FadeIn.delay(400).duration(300)}
                    style={{
                        position: "absolute",
                        bottom: 32,
                        right: 20,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setShowFormModal(true);
                        }}
                        activeOpacity={0.8}
                        accessibilityLabel="Criar novo exercício"
                        accessibilityRole="button"
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: colors.purple[600],
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: colors.purple[600],
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>

            {/* Create Modal */}
            <ExerciseFormModal
                visible={showFormModal}
                muscleGroups={muscleGroupCrud.muscleGroups.length > 0 ? muscleGroupCrud.muscleGroups : muscleGroups}
                onClose={() => setShowFormModal(false)}
                onSave={handleCreate}
                isSaving={isSaving}
                onCreateMuscleGroup={muscleGroupCrud.createMuscleGroup}
            />

            {/* Muscle Group Manager */}
            <MuscleGroupManagerModal
                visible={showMuscleGroupManager}
                onClose={() => setShowMuscleGroupManager(false)}
            />

            {/* Concierge — pedido p/ a equipe montar a biblioteca em 24h */}
            <ConciergeBottomSheet
                visible={showConcierge}
                source="biblioteca_mobile_button"
                onClose={() => setShowConcierge(false)}
            />
        </>
    );
}

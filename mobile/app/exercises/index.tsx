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
import { useAuth } from "../../contexts/AuthContext";
import { PressableScale } from "../../components/shared/PressableScale";
import { ExerciseFormModal } from "../../components/trainer/exercises/ExerciseFormModal";
import { MuscleGroupManagerModal } from "../../components/trainer/exercises/MuscleGroupManagerModal";
import { useMuscleGroupCrud } from "../../hooks/useMuscleGroupCrud";
import { toast } from "../../lib/toast";

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    beginner: { label: "Iniciante", color: "#16a34a", bg: "#f0fdf4" },
    intermediate: { label: "Intermediário", color: "#f59e0b", bg: "#fffbeb" },
    advanced: { label: "Avançado", color: "#ef4444", bg: "#fef2f2" },
};

function SwipeableExerciseCard({
    exercise,
    onPress,
    isOwner,
    onDelete,
}: {
    exercise: Exercise;
    onPress: () => void;
    isOwner: boolean;
    onDelete: () => void;
}) {
    const swipeableRef = useRef<Swipeable>(null);
    const difficulty = exercise.difficulty_level ? DIFFICULTY_CONFIG[exercise.difficulty_level] : null;
    const isSystem = exercise.owner_id === null;

    const renderRightActions = () => {
        if (!isOwner) return null;
        return (
            <TouchableOpacity
                onPress={() => {
                    swipeableRef.current?.close();
                    onDelete();
                }}
                activeOpacity={0.7}
                accessibilityLabel="Excluir exercício"
                accessibilityRole="button"
                style={{
                    backgroundColor: "#ef4444",
                    justifyContent: "center",
                    alignItems: "center",
                    width: 80,
                    borderRadius: 14,
                    marginBottom: 10,
                    marginLeft: 8,
                }}
            >
                <Trash2 size={20} color="#ffffff" />
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#ffffff", marginTop: 4 }}>
                    Excluir
                </Text>
            </TouchableOpacity>
        );
    };

    const card = (
        <PressableScale onPress={onPress} pressScale={0.98}>
            <View
                style={{
                    backgroundColor: "#ffffff",
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
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {exercise.name}
                    </Text>
                    {isSystem ? (
                        <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.5 }}>SISTEMA</Text>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed", letterSpacing: 0.5 }}>CUSTOM</Text>
                        </View>
                    )}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {exercise.muscle_groups.map((mg) => (
                        <View key={mg.id} style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: "#7c3aed" }}>{mg.name}</Text>
                        </View>
                    ))}
                    {exercise.equipment && (
                        <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b" }}>{exercise.equipment}</Text>
                        </View>
                    )}
                    {difficulty && (
                        <View style={{ backgroundColor: difficulty.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: difficulty.color }}>{difficulty.label}</Text>
                        </View>
                    )}
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
}

export default function ExercisesListScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const {
        exercises,
        muscleGroups,
        search,
        setSearch,
        muscleFilter,
        setMuscleFilter,
        isLoading,
        refresh,
    } = useExerciseLibrary();

    const { createExercise, deleteExercise, isSaving } = useExerciseCrud(refresh);
    const muscleGroupCrud = useMuscleGroupCrud();
    const [showFormModal, setShowFormModal] = useState(false);
    const [showMuscleGroupManager, setShowMuscleGroupManager] = useState(false);

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

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={{ flex: 1, backgroundColor: "#F2F2F7" }} edges={["top"]}>
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
                        <ChevronLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 20, fontWeight: "700", color: "#0f172a" }}>
                        Exercícios
                    </Text>
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
                            backgroundColor: "#f5f3ff",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Settings size={18} color="#7c3aed" />
                    </TouchableOpacity>
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
                            backgroundColor: "#ffffff",
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            gap: 10,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.05)",
                        }}
                    >
                        <Search size={18} color="#94a3b8" />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar exercício..."
                            placeholderTextColor="#94a3b8"
                            style={{ flex: 1, fontSize: 14, color: "#0f172a" }}
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
                                backgroundColor: muscleFilter === null ? "#7c3aed" : "#ffffff",
                                borderWidth: 1,
                                borderColor: muscleFilter === null ? "#7c3aed" : "#e2e8f0",
                            }}
                            accessibilityLabel="Todos os grupos musculares"
                            accessibilityRole="button"
                        >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: muscleFilter === null ? "#ffffff" : "#64748b" }}>
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
                                    backgroundColor: muscleFilter === mg.id ? "#7c3aed" : "#ffffff",
                                    borderWidth: 1,
                                    borderColor: muscleFilter === mg.id ? "#7c3aed" : "#e2e8f0",
                                }}
                                accessibilityLabel={mg.name}
                                accessibilityRole="button"
                            >
                                <Text style={{ fontSize: 13, fontWeight: "600", color: muscleFilter === mg.id ? "#ffffff" : "#64748b" }}>
                                    {mg.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* List */}
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#7c3aed" />
                    </View>
                ) : exercises.length === 0 ? (
                    <EmptyState
                        icon={<Dumbbell size={40} color="#cbd5e1" />}
                        title="Nenhum exercício encontrado"
                        description="Tente ajustar os filtros ou crie um novo exercício"
                    />
                ) : (
                    <FlatList
                        data={exercises}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                        renderItem={({ item }) => (
                            <SwipeableExerciseCard
                                exercise={item}
                                isOwner={item.owner_id === user?.id}
                                onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: item.id } })}
                                onDelete={() => handleDelete(item)}
                            />
                        )}
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
                            backgroundColor: "#7c3aed",
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: "#7c3aed",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        <Plus size={24} color="#ffffff" strokeWidth={2.5} />
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
        </>
    );
}

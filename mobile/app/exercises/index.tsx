import React from "react";
import { View, Text, FlatList, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Search, Dumbbell } from "lucide-react-native";
import Animated, { FadeInUp, Easing } from "react-native-reanimated";
import { EmptyState } from "../../components/shared/EmptyState";
import { useExerciseLibrary, type Exercise } from "../../hooks/useExerciseLibrary";
import { PressableScale } from "../../components/shared/PressableScale";

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    beginner: { label: "Iniciante", color: "#16a34a", bg: "#f0fdf4" },
    intermediate: { label: "Intermediário", color: "#f59e0b", bg: "#fffbeb" },
    advanced: { label: "Avançado", color: "#ef4444", bg: "#fef2f2" },
};

function ExerciseCard({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
    const difficulty = exercise.difficulty_level
        ? DIFFICULTY_CONFIG[exercise.difficulty_level]
        : null;
    const isSystem = exercise.owner_id === null;

    return (
        <PressableScale onPress={onPress} pressScale={0.98}>
            <View
                style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.04)",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#0f172a", flex: 1 }} numberOfLines={1}>
                        {exercise.name}
                    </Text>
                    {isSystem ? (
                        <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#64748b" }}>SISTEMA</Text>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed" }}>CUSTOM</Text>
                        </View>
                    )}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {exercise.muscle_groups.map((mg) => (
                        <View key={mg.id} style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "500", color: "#7c3aed" }}>{mg.name}</Text>
                        </View>
                    ))}
                    {exercise.equipment && (
                        <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "500", color: "#64748b" }}>{exercise.equipment}</Text>
                        </View>
                    )}
                    {difficulty && (
                        <View style={{ backgroundColor: difficulty.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: "500", color: difficulty.color }}>{difficulty.label}</Text>
                        </View>
                    )}
                </View>
            </View>
        </PressableScale>
    );
}

export default function ExercisesListScreen() {
    const router = useRouter();
    const { exercises, muscleGroups, search, setSearch, muscleFilter, setMuscleFilter, isLoading, refresh } = useExerciseLibrary();

    return (
        <>
            <Stack.Screen options={{ title: "Exercícios", headerStyle: { backgroundColor: "#F2F2F7" }, headerTintColor: "#0f172a" }} />
            <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
                {/* Search */}
                <Animated.View
                    entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
                    style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#ffffff",
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            gap: 10,
                        }}
                    >
                        <Search size={18} color="#94a3b8" />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar exercício..."
                            placeholderTextColor="#94a3b8"
                            style={{ flex: 1, fontSize: 14, color: "#0f172a" }}
                        />
                    </View>
                </Animated.View>

                {/* Muscle Group Filters */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
                >
                    <TouchableOpacity
                        onPress={() => setMuscleFilter(null)}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: muscleFilter === null ? "#7c3aed" : "#ffffff",
                        }}
                    >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: muscleFilter === null ? "#ffffff" : "#64748b" }}>
                            Todos
                        </Text>
                    </TouchableOpacity>
                    {muscleGroups.map((mg) => (
                        <TouchableOpacity
                            key={mg.id}
                            onPress={() => setMuscleFilter(muscleFilter === mg.id ? null : mg.id)}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: muscleFilter === mg.id ? "#7c3aed" : "#ffffff",
                            }}
                        >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: muscleFilter === mg.id ? "#ffffff" : "#64748b" }}>
                                {mg.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* List */}
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#7c3aed" />
                    </View>
                ) : exercises.length === 0 ? (
                    <EmptyState
                        icon={<Dumbbell size={40} color="#cbd5e1" />}
                        title="Nenhum exercício encontrado"
                        description="Tente ajustar os filtros ou o termo de busca"
                    />
                ) : (
                    <FlatList
                        data={exercises}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <ExerciseCard
                                exercise={item}
                                onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: item.id } })}
                            />
                        )}
                        onRefresh={refresh}
                        refreshing={isLoading}
                    />
                )}
            </View>
        </>
    );
}

import React, { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity } from "react-native";
import { Search, Dumbbell, Play, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";
import { useExerciseLibrary, type Exercise } from "@/hooks/useExerciseLibrary";
import { useExerciseCrud, type ExerciseFormData } from "@/hooks/useExerciseCrud";
import { VideoPreviewModal } from "./VideoPreviewModal";
import { ExerciseFormModal } from "../exercises/ExerciseFormModal";

interface ExercisePanelProps {
    onSelectExercise: (exercise: Exercise) => void;
    visible: boolean;
}

export function ExercisePanel({ onSelectExercise, visible }: ExercisePanelProps) {
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

    // Video preview
    const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);

    // Exercise creation
    const [showCreateExercise, setShowCreateExercise] = useState(false);
    const { createExercise, isSaving: isCreating } = useExerciseCrud(() => {
        refresh();
    });

    const handleSelect = useCallback((exercise: Exercise) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectExercise(exercise);
    }, [onSelectExercise]);

    const handleVideoPreview = useCallback((exercise: Exercise) => {
        if (!exercise.video_url) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setVideoPreview({ url: exercise.video_url, name: exercise.name });
    }, []);

    const handleSaveNewExercise = useCallback(async (data: ExerciseFormData) => {
        await createExercise(data);
        setShowCreateExercise(false);
    }, [createExercise]);

    if (!visible) return null;

    return (
        <View
            style={{
                width: 280,
                backgroundColor: colors.background.card,
                borderRightWidth: 1,
                borderRightColor: colors.border.primary,
            }}
        >
            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary }}>
                        Exercícios
                    </Text>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowCreateExercise(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Criar novo exercício"
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: '#f5f3ff',
                        }}
                    >
                        <Plus size={12} color={colors.brand.primary} strokeWidth={2.5} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.brand.primary }}>
                            Novo
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.background.primary,
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        borderWidth: 1,
                        borderColor: colors.border.primary,
                    }}
                >
                    <Search size={16} color={colors.text.tertiary} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar exercício..."
                        placeholderTextColor={colors.text.tertiary}
                        style={{
                            flex: 1,
                            paddingVertical: 8,
                            paddingHorizontal: 8,
                            fontSize: 13,
                            color: colors.text.primary,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            </View>

            {/* Muscle group chips */}
            <FlatList
                horizontal
                data={['Todos', ...muscleGroups]}
                keyExtractor={(item) => typeof item === 'string' ? item : item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}
                renderItem={({ item }) => {
                    const label = typeof item === 'string' ? item : item.name;
                    const isActive = label === 'Todos' ? !muscleFilter : muscleFilter === (typeof item === 'string' ? item : item.id);
                    return (
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.selectionAsync();
                                setMuscleFilter(label === 'Todos' ? null : (typeof item === 'string' ? item : item.id));
                            }}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 8,
                                backgroundColor: isActive ? colors.brand.primaryLight : colors.background.primary,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: isActive ? colors.brand.primary : colors.text.secondary,
                                }}
                            >
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Exercise list */}
            <FlatList
                data={exercises}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            borderRadius: 10,
                            gap: 10,
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => {
                                if (item.video_url) {
                                    handleVideoPreview(item);
                                } else {
                                    handleSelect(item);
                                }
                            }}
                            activeOpacity={item.video_url ? 0.7 : 1}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                backgroundColor: item.video_url ? '#f5f3ff' : colors.brand.primaryLight,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {item.video_url ? (
                                <Play size={14} color={colors.brand.primary} fill={colors.brand.primary} />
                            ) : (
                                <Dumbbell size={14} color={colors.brand.primary} />
                            )}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{ fontSize: 13, fontWeight: '500', color: colors.text.primary }}
                                numberOfLines={1}
                            >
                                {item.name}
                            </Text>
                            {item.muscle_groups && item.muscle_groups.length > 0 && (
                                <Text
                                    style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 1 }}
                                    numberOfLines={1}
                                >
                                    {item.muscle_groups.map((mg: { id: string; name: string }) => mg.name).join(", ")}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* Video Preview Modal */}
            <VideoPreviewModal
                visible={!!videoPreview}
                videoUrl={videoPreview?.url ?? null}
                exerciseName={videoPreview?.name ?? ""}
                onClose={() => setVideoPreview(null)}
            />

            {/* Create Exercise Modal */}
            <ExerciseFormModal
                visible={showCreateExercise}
                exercise={null}
                muscleGroups={muscleGroups}
                onClose={() => setShowCreateExercise(false)}
                onSave={handleSaveNewExercise}
                isSaving={isCreating}
            />
        </View>
    );
}

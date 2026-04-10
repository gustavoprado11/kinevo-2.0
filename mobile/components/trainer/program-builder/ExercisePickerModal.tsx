import React, { useCallback, useRef, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Search, X, Dumbbell, Play, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";
import { useExerciseLibrary, type Exercise } from "@/hooks/useExerciseLibrary";
import { useExerciseCrud, type ExerciseFormData } from "@/hooks/useExerciseCrud";
import { VideoPreviewModal } from "./VideoPreviewModal";
import { ExerciseFormModal } from "../exercises/ExerciseFormModal";

interface ExercisePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (exercise: Exercise) => void;
}

export function ExercisePickerModal({ visible, onClose, onSelect }: ExercisePickerModalProps) {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["75%", "95%"], []);

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

    // Video preview state
    const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);

    // Exercise creation state
    const [showCreateExercise, setShowCreateExercise] = useState(false);
    const { createExercise, isSaving: isCreating } = useExerciseCrud(() => {
        refresh();
    });

    const handleSelect = useCallback((exercise: Exercise) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(exercise);
        onClose();
    }, [onSelect, onClose]);

    const handleVideoPreview = useCallback((exercise: Exercise) => {
        if (!exercise.video_url) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setVideoPreview({ url: exercise.video_url, name: exercise.name });
    }, []);

    const handleCloseVideoPreview = useCallback(() => {
        setVideoPreview(null);
    }, []);

    const handleCreateExercise = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowCreateExercise(true);
    }, []);

    const handleSaveNewExercise = useCallback(async (data: ExerciseFormData) => {
        await createExercise(data);
        setShowCreateExercise(false);
    }, [createExercise]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    if (!visible) return null;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            onClose={onClose}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: colors.text.quaternary }}
            backgroundStyle={{ backgroundColor: colors.background.primary }}
        >
            <BottomSheetView style={{ flex: 1 }}>
                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text.primary }}>
                        Selecionar exercício
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Create new exercise button */}
                        <TouchableOpacity
                            onPress={handleCreateExercise}
                            accessibilityRole="button"
                            accessibilityLabel="Criar novo exercício"
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: '#f5f3ff',
                            }}
                        >
                            <Plus size={14} color={colors.brand.primary} strokeWidth={2.5} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand.primary }}>
                                Novo
                            </Text>
                        </TouchableOpacity>

                        {/* Close button */}
                        <TouchableOpacity
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar"
                            style={{ padding: 4 }}
                        >
                            <X size={22} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.background.card,
                        borderRadius: 12,
                        marginHorizontal: 20,
                        paddingHorizontal: 12,
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
                        accessibilityLabel="Buscar exercício"
                        accessibilityRole="search"
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            fontSize: 14,
                            color: colors.text.primary,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                {/* Muscle group filters */}
                <FlatList
                    data={[{ id: null, name: "Todos" }, ...muscleGroups]}
                    keyExtractor={(item) => item.id ?? "all"}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, gap: 6 }}
                    renderItem={({ item }) => {
                        const isActive = muscleFilter === item.id;
                        return (
                            <TouchableOpacity
                                onPress={() => setMuscleFilter(item.id)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={item.name}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 100,
                                    backgroundColor: isActive ? colors.brand.primary : colors.background.card,
                                    borderWidth: 1,
                                    borderColor: isActive ? colors.brand.primary : colors.border.primary,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: "600",
                                        color: isActive ? colors.text.inverse : colors.text.secondary,
                                    }}
                                >
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />

                {/* Exercise list */}
                <FlatList
                    data={exercises}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleSelect(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar ${item.name}`}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                padding: 12,
                                marginBottom: 4,
                                borderRadius: 12,
                                backgroundColor: colors.background.card,
                                borderWidth: 1,
                                borderColor: colors.border.primary,
                            }}
                        >
                            {/* Thumbnail / Icon — play overlay if has video */}
                            <TouchableOpacity
                                onPress={() => {
                                    if (item.video_url) {
                                        handleVideoPreview(item);
                                    } else {
                                        handleSelect(item);
                                    }
                                }}
                                activeOpacity={item.video_url ? 0.7 : 1}
                                accessibilityRole={item.video_url ? "button" : "none"}
                                accessibilityLabel={item.video_url ? `Ver vídeo de ${item.name}` : undefined}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    backgroundColor: item.video_url ? '#f5f3ff' : colors.brand.primaryLight,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 12,
                                }}
                            >
                                {item.video_url ? (
                                    <Play size={18} color={colors.brand.primary} fill={colors.brand.primary} />
                                ) : (
                                    <Dumbbell size={16} color={colors.brand.primary} />
                                )}
                            </TouchableOpacity>

                            {/* Exercise info */}
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text.primary }} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    {item.muscle_groups.length > 0 && (
                                        <Text style={{ fontSize: 11, color: colors.text.tertiary }} numberOfLines={1}>
                                            {item.muscle_groups.map(mg => mg.name).join(", ")}
                                        </Text>
                                    )}
                                    {item.equipment && item.muscle_groups.length > 0 && (
                                        <Text style={{ fontSize: 9, color: colors.text.quaternary }}>•</Text>
                                    )}
                                    {item.equipment && (
                                        <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                            {item.equipment}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", paddingVertical: 40 }}>
                            <Text style={{ fontSize: 14, color: colors.text.tertiary }}>
                                {isLoading ? "Carregando..." : "Nenhum exercício encontrado"}
                            </Text>
                        </View>
                    }
                />
            </BottomSheetView>

            {/* Video Preview Modal */}
            <VideoPreviewModal
                visible={!!videoPreview}
                videoUrl={videoPreview?.url ?? null}
                exerciseName={videoPreview?.name ?? ""}
                onClose={handleCloseVideoPreview}
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
        </BottomSheet>
    );
}

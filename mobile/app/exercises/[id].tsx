import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    useWindowDimensions,
    TouchableOpacity,
    Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import * as Haptics from "expo-haptics";
import { Pencil, Trash2, Shield } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useExerciseCrud } from "../../hooks/useExerciseCrud";
import { useExerciseLibrary, type Exercise } from "../../hooks/useExerciseLibrary";
import { ExerciseFormModal } from "../../components/trainer/exercises/ExerciseFormModal";
import { extractYouTubeId, isDirectVideoUrl } from "../../utils/youtube";
import { toast } from "../../lib/toast";
import type { ExerciseFormData } from "../../hooks/useExerciseCrud";

// Lazy-load expo-av
let ExpoVideo: any = null;
let ExpoResizeMode: any = null;
let expoAvLoaded = false;

try {
    const av = require("expo-av");
    ExpoVideo = av.Video;
    ExpoResizeMode = av.ResizeMode;
    expoAvLoaded = true;
} catch {
    // expo-av not available
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    beginner: { label: "Iniciante", color: "#16a34a", bg: "#f0fdf4" },
    intermediate: { label: "Intermediário", color: "#f59e0b", bg: "#fffbeb" },
    advanced: { label: "Avançado", color: "#ef4444", bg: "#fef2f2" },
};

export default function ExerciseDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { width } = useWindowDimensions();
    const { user } = useAuth();
    const router = useRouter();
    const { muscleGroups } = useExerciseLibrary();

    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    const fetchExercise = useCallback(async () => {
        try {
            const { data } = await (supabase as any)
                .from("exercises")
                .select(
                    "id, name, equipment, owner_id, video_url, instructions, difficulty_level, exercise_muscle_groups(muscle_groups(id, name))"
                )
                .eq("id", id)
                .single();

            if (data) {
                setExercise({
                    id: data.id,
                    name: data.name,
                    equipment: data.equipment,
                    owner_id: data.owner_id,
                    video_url: data.video_url,
                    instructions: data.instructions,
                    difficulty_level: data.difficulty_level,
                    muscle_groups: ((data as any).exercise_muscle_groups ?? [])
                        .map((emg: any) => emg.muscle_groups)
                        .filter(Boolean),
                });
            }
        } catch (err) {
            if (__DEV__) console.error("[exercise-detail] Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchExercise();
    }, [fetchExercise]);

    const { updateExercise, deleteExercise, isSaving } = useExerciseCrud(() => {
        fetchExercise();
    });

    const isOwner = exercise?.owner_id === user?.id;
    const isSystem = exercise?.owner_id === null;

    const handleEdit = useCallback(
        async (data: ExerciseFormData) => {
            if (!exercise) return;
            try {
                await updateExercise(exercise.id, data);
                toast.success("Exercício atualizado!");
                setShowEditModal(false);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Falha ao atualizar.";
                toast.error("Erro", message);
            }
        },
        [exercise, updateExercise]
    );

    const handleDelete = useCallback(() => {
        if (!exercise) return;
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
                            router.back();
                        } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : "Falha ao excluir.";
                            toast.error("Erro", message);
                        }
                    },
                },
            ]
        );
    }, [exercise, deleteExercise, router]);

    const videoId = exercise ? extractYouTubeId(exercise.video_url) : null;
    const isDirect = exercise ? isDirectVideoUrl(exercise.video_url) : false;
    const difficulty = exercise?.difficulty_level ? DIFFICULTY_CONFIG[exercise.difficulty_level] : null;

    if (isLoading) {
        return (
            <>
                <Stack.Screen options={{ title: "Exercício", headerStyle: { backgroundColor: "#F2F2F7" }, headerTintColor: "#0f172a" }} />
                <View style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#7c3aed" />
                </View>
            </>
        );
    }

    if (!exercise) {
        return (
            <>
                <Stack.Screen options={{ title: "Exercício", headerStyle: { backgroundColor: "#F2F2F7" }, headerTintColor: "#0f172a" }} />
                <View style={{ flex: 1, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, color: "#64748b" }}>Exercício não encontrado</Text>
                </View>
            </>
        );
    }

    return (
        <>
            <Stack.Screen options={{ title: exercise.name, headerStyle: { backgroundColor: "#F2F2F7" }, headerTintColor: "#0f172a" }} />
            <ScrollView
                style={{ flex: 1, backgroundColor: "#F2F2F7" }}
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                {/* Video */}
                {videoId ? (
                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                        <View style={{ borderRadius: 14, overflow: "hidden" }}>
                            <YoutubePlayer
                                height={(width - 40) * 9 / 16}
                                videoId={videoId}
                                webViewProps={{ allowsInlineMediaPlayback: true }}
                            />
                        </View>
                    </View>
                ) : isDirect && exercise.video_url && expoAvLoaded && ExpoVideo ? (
                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                        <View style={{ borderRadius: 14, overflow: "hidden" }}>
                            <ExpoVideo
                                source={{ uri: exercise.video_url }}
                                style={{ width: width - 40, height: (width - 40) * 9 / 16 }}
                                useNativeControls
                                resizeMode={ExpoResizeMode?.CONTAIN}
                            />
                        </View>
                    </View>
                ) : null}

                {/* Info Card */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    <View
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 14,
                            padding: 16,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.04)",
                        }}
                    >
                        {/* Name + badge */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a", flex: 1 }}>
                                {exercise.name}
                            </Text>
                            {isSystem ? (
                                <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#64748b" }}>SISTEMA</Text>
                                </View>
                            ) : (
                                <View style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#7c3aed" }}>CUSTOM</Text>
                                </View>
                            )}
                        </View>

                        {/* Tags */}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                            {exercise.muscle_groups.map((mg) => (
                                <View key={mg.id} style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#7c3aed" }}>{mg.name}</Text>
                                </View>
                            ))}
                            {exercise.equipment && (
                                <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748b" }}>{exercise.equipment}</Text>
                                </View>
                            )}
                            {difficulty && (
                                <View style={{ backgroundColor: difficulty.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: difficulty.color }}>{difficulty.label}</Text>
                                </View>
                            )}
                        </View>

                        {/* Instructions */}
                        {exercise.instructions && (
                            <>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                                    Instruções
                                </Text>
                                <Text style={{ fontSize: 14, color: "#374151", lineHeight: 22 }}>
                                    {exercise.instructions}
                                </Text>
                            </>
                        )}
                    </View>
                </View>

                {/* Action buttons */}
                {isOwner && (
                    <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowEditModal(true);
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel="Editar exercício"
                            accessibilityRole="button"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#7c3aed",
                                borderRadius: 14,
                                paddingVertical: 14,
                                gap: 8,
                            }}
                        >
                            <Pencil size={18} color="#ffffff" />
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>
                                Editar exercício
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDelete}
                            activeOpacity={0.7}
                            accessibilityLabel="Excluir exercício"
                            accessibilityRole="button"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#fef2f2",
                                borderRadius: 14,
                                paddingVertical: 14,
                                gap: 8,
                            }}
                        >
                            <Trash2 size={18} color="#ef4444" />
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#ef4444" }}>
                                Excluir exercício
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isSystem && (
                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#f1f5f9",
                                borderRadius: 12,
                                paddingVertical: 12,
                                gap: 8,
                            }}
                        >
                            <Shield size={16} color="#94a3b8" />
                            <Text style={{ fontSize: 13, fontWeight: "500", color: "#94a3b8" }}>
                                Exercício do sistema — somente leitura
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Edit Modal */}
            <ExerciseFormModal
                visible={showEditModal}
                exercise={exercise}
                muscleGroups={muscleGroups}
                onClose={() => setShowEditModal(false)}
                onSave={handleEdit}
                isSaving={isSaving}
            />
        </>
    );
}

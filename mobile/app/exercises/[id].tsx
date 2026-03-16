import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import { supabase } from "../../lib/supabase";
import { extractYouTubeId } from "../../utils/youtube";
import type { Exercise } from "../../hooks/useExerciseLibrary";

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    beginner: { label: "Iniciante", color: "#16a34a", bg: "#f0fdf4" },
    intermediate: { label: "Intermediário", color: "#f59e0b", bg: "#fffbeb" },
    advanced: { label: "Avançado", color: "#ef4444", bg: "#fef2f2" },
};

export default function ExerciseDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { width } = useWindowDimensions();
    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                const { data } = await (supabase as any)
                    .from("exercises")
                    .select("id, name, equipment, owner_id, video_url, instructions, difficulty_level, exercise_muscle_groups(muscle_groups(id, name))")
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
        }
        fetch();
    }, [id]);

    const videoId = exercise ? extractYouTubeId(exercise.video_url) : null;
    const difficulty = exercise?.difficulty_level
        ? DIFFICULTY_CONFIG[exercise.difficulty_level]
        : null;
    const isSystem = exercise?.owner_id === null;

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
                {videoId && (
                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                        <View style={{ borderRadius: 14, overflow: "hidden" }}>
                            <YoutubePlayer
                                height={(width - 40) * 9 / 16}
                                videoId={videoId}
                                webViewProps={{ allowsInlineMediaPlayback: true }}
                            />
                        </View>
                    </View>
                )}

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

                {/* Footer */}
                <Text style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 24, paddingHorizontal: 40 }}>
                    Para editar este exercício, use a versão web
                </Text>
            </ScrollView>
        </>
    );
}

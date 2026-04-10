import React, { useRef, useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PressableScale } from "../../shared/PressableScale";
import { colors } from "@/theme";
import type { Workout } from "@/stores/program-builder-store";

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface WorkoutTabBarProps {
    workouts: Workout[];
    currentWorkoutId: string | null;
    onSelectWorkout: (workoutId: string) => void;
    onAddWorkout: () => void;
}

export function WorkoutTabBar({
    workouts,
    currentWorkoutId,
    onSelectWorkout,
    onAddWorkout,
}: WorkoutTabBarProps) {
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (currentWorkoutId && scrollRef.current) {
            const index = workouts.findIndex(w => w.id === currentWorkoutId);
            if (index > 0) {
                scrollRef.current.scrollTo({ x: index * 130, animated: true });
            }
        }
    }, [currentWorkoutId, workouts]);

    return (
        <View style={{ paddingVertical: 6 }}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    gap: 8,
                    alignItems: 'center',
                }}
                style={{ flexGrow: 0 }}
            >
                {workouts.map((workout) => {
                    const isActive = workout.id === currentWorkoutId;
                    const hasDays = workout.frequency.length > 0;
                    return (
                        <PressableScale
                            key={workout.id}
                            onPress={() => onSelectWorkout(workout.id)}
                            pressScale={0.95}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={workout.name}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                borderRadius: 14,
                                backgroundColor: isActive ? colors.brand.primary : '#ffffff',
                                borderWidth: 1,
                                borderColor: isActive ? colors.brand.primary : '#e2e8f0',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: isActive ? 0.12 : 0.04,
                                shadowRadius: isActive ? 6 : 3,
                                elevation: isActive ? 3 : 1,
                            }}
                        >
                            {/* Line 1: name + exercise count */}
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: isActive ? '#ffffff' : colors.text.primary,
                                }}
                                numberOfLines={1}
                            >
                                {workout.name}
                                <Text style={{
                                    fontWeight: "400",
                                    color: isActive ? "rgba(255,255,255,0.65)" : colors.text.tertiary,
                                    fontSize: 12,
                                }}>
                                    {" · "}{workout.items.length} ex
                                </Text>
                            </Text>

                            {/* Line 2: mini day dots */}
                            <View style={{ flexDirection: 'row', gap: 3, marginTop: 5 }}>
                                {DAY_KEYS.map((dayKey) => {
                                    const isDay = workout.frequency.includes(dayKey);
                                    return (
                                        <View
                                            key={dayKey}
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: isDay
                                                    ? (isActive ? '#ffffff' : colors.brand.primary)
                                                    : (isActive ? 'rgba(255,255,255,0.2)' : '#d1d5db'),
                                            }}
                                        />
                                    );
                                })}
                            </View>
                        </PressableScale>
                    );
                })}

                {/* Add workout button */}
                <PressableScale
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onAddWorkout();
                    }}
                    pressScale={0.9}
                    accessibilityRole="button"
                    accessibilityLabel="Adicionar treino"
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: '#ffffff',
                        borderWidth: 1.5,
                        borderColor: '#e2e8f0',
                        borderStyle: 'dashed',
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Plus size={16} color={colors.brand.primary} />
                </PressableScale>
            </ScrollView>
        </View>
    );
}

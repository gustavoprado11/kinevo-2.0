import React from "react";
import { View, Text } from "react-native";
import { WorkoutCard } from "../WorkoutCard";

interface WorkoutListProps {
    workouts: any[];
    onWorkoutPress: (id: string) => void;
}

export function WorkoutList({ workouts, onWorkoutPress }: WorkoutListProps) {
    if (workouts.length === 0) return null;

    return (
        <View>
            <Text className="text-lg font-bold text-slate-100 mb-3 tracking-wide">
                Seus Treinos
            </Text>
            {workouts.map((workout, index) => (
                <WorkoutCard
                    key={workout.id}
                    index={index}
                    title={workout.name}
                    subtitle={workout.notes}
                    exerciseCount={workout.items?.length || 0}
                    onPress={() => onWorkoutPress(workout.id)}
                />
            ))}
        </View>
    );
}

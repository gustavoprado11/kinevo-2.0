import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { PlayCircle } from 'lucide-react-native';
import { SetRow } from './SetRow';

export interface SetData {
    weight: string;
    reps: string;
    completed: boolean;
}

interface ExerciseCardProps {
    exerciseName: string;
    sets: number; // Target sets
    reps: string; // Target reps
    restSeconds: number;
    setsData: SetData[];
    onSetChange: (index: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSetComplete: (index: number) => void;
    videoUrl?: string; // Optional
    previousLoad?: string; // Optional history
    onVideoPress?: (url: string) => void;
}

export function ExerciseCard({
    exerciseName,
    sets,
    reps,
    restSeconds,
    setsData,
    onSetChange,
    onToggleSetComplete,
    videoUrl,
    previousLoad,
    onVideoPress
}: ExerciseCardProps) {

    const handleOpenVideo = () => {
        if (videoUrl) {
            onVideoPress?.(videoUrl);
        } else {
            Alert.alert("Vídeo indisponível", "Este exercício não possui vídeo cadastrado.");
        }
    };

    return (
        <View className="bg-slate-900 rounded-xl p-4 mb-4 border border-slate-800">
            {/* Header */}
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-2">
                    <Text className="text-lg font-bold text-white mb-1">{exerciseName}</Text>
                    <Text className="text-slate-400 text-sm">
                        {sets} séries • {reps} reps • {restSeconds}s descanso
                    </Text>
                    {previousLoad && (
                        <Text className="text-slate-500 text-xs italic mt-1">
                            Carga anterior: {previousLoad}
                        </Text>
                    )}
                </View>
                <TouchableOpacity onPress={handleOpenVideo}>
                    <PlayCircle size={24} color="#8b5cf6" />
                </TouchableOpacity>
            </View>

            {/* Sets List */}
            <View>
                {setsData.map((set, index) => (
                    <SetRow
                        key={index}
                        index={index}
                        weight={set.weight}
                        reps={set.reps}
                        isCompleted={set.completed}
                        onWeightChange={(val) => onSetChange(index, 'weight', val)}
                        onRepsChange={(val) => onSetChange(index, 'reps', val)}
                        onToggleComplete={() => onToggleSetComplete(index)}
                    />
                ))}
            </View>
        </View>
    );
}

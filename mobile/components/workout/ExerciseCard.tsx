import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { ArrowRightLeft, PlayCircle } from 'lucide-react-native';
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
    onSwapPress?: () => void;
    isSwapped?: boolean;
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
    onVideoPress,
    onSwapPress,
    isSwapped
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
                    {isSwapped && (
                        <Text className="text-violet-300 text-xs mt-1">
                            Exercicio substituido nesta sessao
                        </Text>
                    )}
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={onSwapPress}>
                        <ArrowRightLeft size={20} color="#a78bfa" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleOpenVideo}>
                        <PlayCircle size={24} color="#8b5cf6" />
                    </TouchableOpacity>
                </View>
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

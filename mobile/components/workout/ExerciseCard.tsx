import React from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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
        <BlurView
            intensity={60}
            tint="light"
            className="rounded-3xl p-4 mb-4 overflow-hidden"
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.6)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
            }}
        >
            {/* Header */}
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-2">
                    <Text className="text-xl font-bold text-slate-900 mb-1">{exerciseName}</Text>
                    <Text className="text-slate-500 text-sm">
                        {sets} séries • {reps} reps • {restSeconds}s descanso
                    </Text>
                    {previousLoad && (
                        <Text className="text-slate-400 text-sm italic mt-1">
                            Carga anterior: {previousLoad}
                        </Text>
                    )}
                    {isSwapped && (
                        <Text className="text-violet-600 text-xs mt-1">
                            Exercicio substituído nesta sessão
                        </Text>
                    )}
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={onSwapPress}
                        className="p-2.5 rounded-full"
                        style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)' }}
                    >
                        <ArrowRightLeft size={20} color="#7c3aed" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleOpenVideo}
                        className="p-2.5 rounded-full"
                        style={{ backgroundColor: 'rgba(124, 58, 237, 0.1)' }}
                    >
                        <PlayCircle size={20} color="#7c3aed" />
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
        </BlurView>
    );
}

import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface SetRowProps {
    index: number;
    weight: string;
    reps: string;
    isCompleted: boolean;
    onWeightChange: (value: string) => void;
    onRepsChange: (value: string) => void;
    onToggleComplete: () => void;
}

export function SetRow({
    index,
    weight,
    reps,
    isCompleted,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
}: SetRowProps) {

    const handleToggle = () => {
        // Feedback tátil
        if (!isCompleted) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.selectionAsync();
        }
        onToggleComplete();
    }

    return (
        <View className="flex-row items-center justify-between mb-3">
            {/* Set Number */}
            <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center mr-3">
                <Text className="text-slate-400 font-bold text-sm">{index + 1}</Text>
            </View>

            {/* Weight Input */}
            <View className="flex-1 mr-3">
                <TextInput
                    className={`bg-slate-800 text-white p-3 rounded-lg text-center font-medium ${isCompleted ? 'opacity-50' : ''}`}
                    placeholder="kg"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={onWeightChange}
                    editable={!isCompleted}
                />
            </View>

            {/* Reps Input */}
            <View className="flex-1 mr-3">
                <TextInput
                    className={`bg-slate-800 text-white p-3 rounded-lg text-center font-medium ${isCompleted ? 'opacity-50' : ''}`}
                    placeholder="Reps"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={onRepsChange}
                    editable={!isCompleted}
                />
            </View>

            {/* Check Button */}
            <TouchableOpacity
                onPress={handleToggle}
                className={`w-12 h-12 rounded-lg items-center justify-center border ${isCompleted
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-transparent border-slate-700'
                    }`}
            >
                {isCompleted && <Check size={20} color="#fff" />}
            </TouchableOpacity>
        </View>
    );
}

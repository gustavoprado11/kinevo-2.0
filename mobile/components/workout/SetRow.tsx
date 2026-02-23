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
            <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center mr-3">
                <Text className="text-slate-500 font-medium text-sm">{index + 1}</Text>
            </View>

            {/* Weight Input */}
            <View className="flex-1 mr-3">
                <TextInput
                    className={`bg-white/60 text-slate-900 border border-white/40 p-3 rounded-xl text-center font-bold text-lg shadow-sm ${isCompleted ? 'opacity-50 bg-slate-100/50' : ''}`}
                    placeholder="kg"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={onWeightChange}
                    editable={!isCompleted}
                />
            </View>

            {/* Reps Input */}
            <View className="flex-1 mr-3">
                <TextInput
                    className={`bg-white/60 text-slate-900 border border-white/40 p-3 rounded-xl text-center font-bold text-lg shadow-sm ${isCompleted ? 'opacity-50 bg-slate-100/50' : ''}`}
                    placeholder="Reps"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={onRepsChange}
                    editable={!isCompleted}
                />
            </View>

            {/* Check Button */}
            <TouchableOpacity
                onPress={handleToggle}
                className={`w-12 h-12 rounded-xl items-center justify-center border-2 shadow-sm ${isCompleted
                    ? 'bg-emerald-500 border-emerald-400 shadow-emerald-500/30'
                    : 'bg-white/60 border-white/40'
                    }`}
            >
                {isCompleted && <Check size={20} color="#fff" />}
            </TouchableOpacity>
        </View>
    );
}

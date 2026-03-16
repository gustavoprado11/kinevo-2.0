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
    previousWeight?: number;
    previousReps?: number;
}

export function SetRow({
    index,
    weight,
    reps,
    isCompleted,
    onWeightChange,
    onRepsChange,
    onToggleComplete,
    previousWeight,
    previousReps,
}: SetRowProps) {

    const handleToggle = () => {
        if (!isCompleted) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
            Haptics.selectionAsync();
        }
        onToggleComplete();
    };

    const hasPrevious = previousWeight !== undefined && previousReps !== undefined;

    return (
        <View style={[
            {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 5,
                paddingHorizontal: 4,
                borderRadius: 10,
                marginBottom: 4,
            },
            isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.06)' },
        ]}>
            {/* Set Number */}
            <View style={[
                {
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                },
                isCompleted
                    ? { backgroundColor: 'rgba(124, 58, 237, 0.15)' }
                    : { backgroundColor: '#f1f5f9' },
            ]}>
                <Text style={[
                    { fontSize: 12, fontWeight: '600' },
                    isCompleted ? { color: '#7c3aed' } : { color: '#64748b' },
                ]}>
                    {index + 1}
                </Text>
            </View>

            {/* Previous set data */}
            <View style={{ width: 58, alignItems: 'center', marginRight: 6 }}>
                <Text style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: '#94a3b8',
                    fontVariant: ['tabular-nums'],
                }}>
                    {hasPrevious
                        ? `${Number.isInteger(previousWeight) ? previousWeight : previousWeight!.toFixed(1)}×${previousReps}`
                        : '—'}
                </Text>
            </View>

            {/* Weight Input */}
            <TextInput
                style={[
                    {
                        flex: 1,
                        height: 38,
                        backgroundColor: '#f5f5f7',
                        borderRadius: 10,
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: 15,
                        color: '#0f172a',
                        marginRight: 6,
                        fontVariant: ['tabular-nums'],
                    },
                    isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' },
                ]}
                placeholder={hasPrevious ? String(previousWeight) : 'kg'}
                placeholderTextColor={hasPrevious ? '#94a3b8' : '#cbd5e1'}
                keyboardType="decimal-pad"
                returnKeyType="next"
                value={weight}
                onChangeText={onWeightChange}
                editable={!isCompleted}
            />

            {/* Reps Input */}
            <TextInput
                style={[
                    {
                        flex: 1,
                        height: 38,
                        backgroundColor: '#f5f5f7',
                        borderRadius: 10,
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: 15,
                        color: '#0f172a',
                        marginRight: 6,
                        fontVariant: ['tabular-nums'],
                    },
                    isCompleted && { backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' },
                ]}
                placeholder={hasPrevious ? String(previousReps) : ''}
                placeholderTextColor={hasPrevious ? '#94a3b8' : '#cbd5e1'}
                keyboardType="number-pad"
                returnKeyType="done"
                value={reps}
                onChangeText={onRepsChange}
                editable={!isCompleted}
            />

            {/* Check Button — circular, gray → violet */}
            <TouchableOpacity
                onPress={handleToggle}
                activeOpacity={0.7}
                style={[
                    {
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    isCompleted
                        ? { backgroundColor: '#7c3aed' }
                        : { backgroundColor: '#e8e8ed' },
                ]}
            >
                {isCompleted ? (
                    <Check size={18} color="#fff" strokeWidth={3} />
                ) : (
                    <View style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 2,
                        borderColor: '#c7c7cc',
                    }} />
                )}
            </TouchableOpacity>
        </View>
    );
}

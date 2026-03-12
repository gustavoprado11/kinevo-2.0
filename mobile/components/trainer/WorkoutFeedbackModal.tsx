import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface WorkoutFeedbackModalProps {
    visible: boolean;
    studentName: string;
    workoutName: string;
    isSubmitting: boolean;
    onConfirm: (rpe: number | null, feedback: string | null) => void;
    onCancel: () => void;
}

const RPE_OPTIONS = [
    { value: 1, label: 'Muito fácil', emoji: '😴' },
    { value: 2, label: 'Fácil', emoji: '😌' },
    { value: 3, label: 'Leve', emoji: '🙂' },
    { value: 4, label: 'Moderado-', emoji: '😊' },
    { value: 5, label: 'Moderado', emoji: '😐' },
    { value: 6, label: 'Moderado+', emoji: '😤' },
    { value: 7, label: 'Difícil', emoji: '😓' },
    { value: 8, label: 'Muito difícil', emoji: '🥵' },
    { value: 9, label: 'Quase máximo', emoji: '😵' },
    { value: 10, label: 'Máximo', emoji: '💀' },
];

export function WorkoutFeedbackModal({
    visible,
    studentName,
    workoutName,
    isSubmitting,
    onConfirm,
    onCancel,
}: WorkoutFeedbackModalProps) {
    const [rpe, setRpe] = useState<number | null>(null);
    const [feedback, setFeedback] = useState('');

    const handleSelectRpe = (value: number) => {
        Haptics.selectionAsync();
        setRpe((prev) => (prev === value ? null : value));
    };

    const handleConfirm = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConfirm(rpe, feedback.trim() || null);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1, backgroundColor: '#f8fafc' }}
            >
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingTop: 16,
                        paddingBottom: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#f1f5f9',
                    }}
                >
                    <View>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>
                            Concluir Treino
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {studentName} — {workoutName}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
                        <X size={22} color="#64748b" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* RPE Section */}
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: 1.5,
                            marginBottom: 12,
                        }}
                    >
                        Percepção de Esforço (RPE)
                    </Text>

                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginBottom: 24,
                        }}
                    >
                        {RPE_OPTIONS.map((option) => {
                            const isSelected = rpe === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => handleSelectRpe(option.value)}
                                    activeOpacity={0.6}
                                    style={{
                                        width: '18.5%',
                                        aspectRatio: 1,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isSelected
                                            ? 'rgba(124, 58, 237, 0.1)'
                                            : '#fff',
                                        borderWidth: 1,
                                        borderColor: isSelected
                                            ? 'rgba(124, 58, 237, 0.3)'
                                            : '#f1f5f9',
                                    }}
                                >
                                    <Text style={{ fontSize: 18 }}>{option.emoji}</Text>
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: '700',
                                            color: isSelected ? '#7c3aed' : '#0f172a',
                                            marginTop: 2,
                                        }}
                                    >
                                        {option.value}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {rpe !== null && (
                        <Text
                            style={{
                                fontSize: 13,
                                color: '#7c3aed',
                                fontWeight: '500',
                                textAlign: 'center',
                                marginBottom: 20,
                                marginTop: -12,
                            }}
                        >
                            RPE {rpe} — {RPE_OPTIONS[rpe - 1]?.label}
                        </Text>
                    )}

                    {/* Feedback */}
                    <Text
                        style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: 1.5,
                            marginBottom: 8,
                        }}
                    >
                        Observações
                    </Text>
                    <TextInput
                        value={feedback}
                        onChangeText={setFeedback}
                        placeholder="Como foi o treino?"
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        style={{
                            backgroundColor: '#fff',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 14,
                            color: '#0f172a',
                            minHeight: 100,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                        }}
                    />
                </ScrollView>

                {/* Footer */}
                <View
                    style={{
                        flexDirection: 'row',
                        gap: 12,
                        paddingHorizontal: 20,
                        paddingBottom: 34,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: '#f1f5f9',
                    }}
                >
                    <TouchableOpacity
                        onPress={onCancel}
                        activeOpacity={0.6}
                        style={{
                            flex: 1,
                            backgroundColor: '#fff',
                            borderRadius: 14,
                            paddingVertical: 14,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#64748b' }}>
                            Cancelar
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={isSubmitting}
                        activeOpacity={0.7}
                        style={{
                            flex: 1,
                            backgroundColor: '#7c3aed',
                            borderRadius: 14,
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 8,
                        }}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                                Salvar Treino
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

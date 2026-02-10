import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { X, Check } from 'lucide-react-native';

interface WorkoutFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (rpe: number, feedback: string) => void;
}

export function WorkoutFeedbackModal({ visible, onClose, onConfirm }: WorkoutFeedbackModalProps) {
    const [rpe, setRpe] = useState<number | null>(null);
    const [feedback, setFeedback] = useState('');

    const handleConfirm = () => {
        if (rpe === null) return; // RPE is required? Maybe optional? Requirement says "Solicitando: RPE... Feedback (Opcional)". So RPE is likely required.
        onConfirm(rpe, feedback);
        // Reset state? Maybe better to reset when opening.
        setRpe(null);
        setFeedback('');
    };

    const getRpeColor = (value: number) => {
        if (value <= 4) return 'bg-emerald-500';
        if (value <= 7) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getRpeLabel = (value: number) => {
        if (value <= 2) return 'Muito Leve';
        if (value <= 4) return 'Leve';
        if (value <= 6) return 'Moderado';
        if (value <= 8) return 'Intenso';
        return 'Exaustivo';
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/80 justify-end">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View className="bg-slate-900 rounded-t-3xl border-t border-slate-800 p-6 pb-10">
                        {/* Header */}
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-xl font-bold text-white">Como foi o treino?</Text>
                                <Text className="text-slate-400 text-sm">Avalie seu esforço e deixe observações.</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                                <X size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* RPE Selector */}
                            <Text className="text-slate-300 font-bold mb-3">Percepção de Esforço (RPE)</Text>
                            <View className="flex-row flex-wrap justify-between gap-y-3 mb-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                                    const isSelected = rpe === value;
                                    const baseColor = getRpeColor(value);

                                    return (
                                        <TouchableOpacity
                                            key={value}
                                            onPress={() => setRpe(value)}
                                            className={`w-[18%] aspect-square rounded-xl items-center justify-center border-2 ${isSelected
                                                    ? `border-white ${baseColor}`
                                                    : 'border-slate-800 bg-slate-800'
                                                }`}
                                        >
                                            <Text className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                                {value}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Selected RPE Label */}
                            <View className="h-8 items-center justify-center mb-6">
                                {rpe && (
                                    <Text className={`font-bold ${rpe <= 4 ? 'text-emerald-500' :
                                            rpe <= 7 ? 'text-yellow-500' : 'text-red-500'
                                        }`}>
                                        {getRpeLabel(rpe)}
                                    </Text>
                                )}
                            </View>

                            {/* Feedback Input */}
                            <Text className="text-slate-300 font-bold mb-3">Observações (Opcional)</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl min-h-[100px] mb-6 text-base"
                                placeholder="Senti dor no ombro? Carga estava leve? Escreva aqui..."
                                placeholderTextColor="#64748B"
                                multiline
                                textAlignVertical="top"
                                value={feedback}
                                onChangeText={setFeedback}
                            />

                            {/* Action Button */}
                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={rpe === null}
                                className={`w-full py-4 rounded-xl flex-row items-center justify-center space-x-2 ${rpe !== null ? 'bg-violet-600' : 'bg-slate-800 opacity-50'
                                    }`}
                            >
                                <Check size={20} color={rpe !== null ? '#fff' : '#64748B'} />
                                <Text className={`font-bold text-base ${rpe !== null ? 'text-white' : 'text-slate-500'}`}>
                                    Salvar e Finalizar
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

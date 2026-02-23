import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowRightLeft, RefreshCw, Search, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ExerciseSubstituteOption } from '../../hooks/useWorkoutSession';

interface ExerciseSwapModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (option: ExerciseSubstituteOption) => void;
    exerciseName: string | null;
    options: ExerciseSubstituteOption[];
    isLoading: boolean;
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    searchResults: ExerciseSubstituteOption[];
    isSearching: boolean;
}

export function ExerciseSwapModal({
    visible,
    onClose,
    onSelect,
    exerciseName,
    options,
    isLoading,
    searchQuery,
    onSearchQueryChange,
    searchResults,
    isSearching
}: ExerciseSwapModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <BlurView
                        intensity={90}
                        tint="light"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            padding: 24,
                            paddingBottom: 40,
                            maxHeight: '80%',
                            borderTopWidth: 1,
                            borderTopColor: 'rgba(255, 255, 255, 0.5)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 10,
                        }}
                    >
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center gap-2">
                                <ArrowRightLeft size={18} color="#7c3aed" />
                                <Text className="text-slate-900 text-lg font-bold">Substituir Exercício</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2 bg-slate-100 rounded-full">
                                <X size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-slate-500 text-sm mb-4">
                            {exerciseName ? `Atual: ${exerciseName}` : 'Selecione um substituto.'}
                        </Text>

                        <View className="mb-6">
                            <View className="flex-row items-center rounded-2xl border border-white/60 bg-white/40 px-3 overflow-hidden">
                                <Search size={16} color="#64748b" />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={onSearchQueryChange}
                                    placeholder="Buscar exercício para troca..."
                                    placeholderTextColor="#94a3b8"
                                    className="flex-1 px-2 py-4 text-slate-900 font-medium"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => onSearchQueryChange('')} className="p-1">
                                        <X size={14} color="#64748b" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {isLoading ? (
                            <View className="py-10 items-center justify-center">
                                <ActivityIndicator size="large" color="#8B5CF6" />
                                <Text className="text-slate-400 mt-3">Carregando substituicoes...</Text>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    Sugestões rápidas
                                </Text>
                                {options.length === 0 ? (
                                    <View className="py-10 items-center justify-center">
                                        <RefreshCw size={20} color="#64748B" />
                                        <Text className="text-slate-400 mt-3 text-center">
                                            Nenhuma sugestao disponivel para este exercicio.
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="mb-5">
                                        {options.map((option) => (
                                            <TouchableOpacity
                                                key={option.id}
                                                onPress={() => onSelect(option)}
                                                className="py-4 border-b border-slate-100"
                                            >
                                                <View className="flex-row items-start justify-between">
                                                    <Text className="text-slate-900 font-semibold flex-1 mr-3 text-base">{option.name}</Text>
                                                    <View className={`px-2 py-1 rounded-full border ${option.source === 'manual'
                                                        ? 'bg-violet-50 border-violet-100'
                                                        : 'bg-slate-50 border-slate-200'
                                                        }`}>
                                                        <Text className={`text-[10px] font-bold uppercase ${option.source === 'manual' ? 'text-violet-600' : 'text-slate-500'}`}>
                                                            {option.source === 'manual' ? 'Treinador' : 'Automática'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text className="text-slate-500 text-xs mt-1">
                                                    {(option.muscle_groups || []).join(', ') || 'Grupo muscular não informado'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                                    Busca manual
                                </Text>
                                {isSearching ? (
                                    <View className="py-6 items-center justify-center">
                                        <ActivityIndicator size="small" color="#7c3aed" />
                                        <Text className="text-slate-500 mt-2 text-sm">Buscando...</Text>
                                    </View>
                                ) : searchQuery.trim().length < 2 ? (
                                    <Text className="text-slate-400 text-sm mb-4 italic">
                                        Digite ao menos 2 letras para buscar exercícios similares.
                                    </Text>
                                ) : searchResults.length === 0 ? (
                                    <Text className="text-slate-400 text-sm mb-4 italic">
                                        Nenhum exercício encontrado para essa busca.
                                    </Text>
                                ) : (
                                    <View className="mb-2">
                                        {searchResults.map((option) => (
                                            <TouchableOpacity
                                                key={`search-${option.id}`}
                                                onPress={() => onSelect(option)}
                                                className="py-4 border-b border-slate-100"
                                            >
                                                <View className="flex-row items-start justify-between">
                                                    <Text className="text-slate-900 font-semibold flex-1 mr-3 text-base">{option.name}</Text>
                                                    <View className="px-2 py-1 rounded-full border bg-slate-50 border-slate-200">
                                                        <Text className="text-[10px] font-bold uppercase text-slate-500">Busca</Text>
                                                    </View>
                                                </View>

                                                <Text className="text-slate-500 text-xs mt-1">
                                                    {(option.muscle_groups || []).join(', ') || 'Grupo muscular não informado'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </BlurView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

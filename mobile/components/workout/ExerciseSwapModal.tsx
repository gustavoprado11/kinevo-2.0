import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, ActivityIndicator, TextInput } from 'react-native';
import { ArrowRightLeft, RefreshCw, Search, X } from 'lucide-react-native';
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
            <View className="flex-1 bg-black/80 justify-end">
                <View className="bg-slate-900 rounded-t-3xl border-t border-slate-800 p-5 pb-8 max-h-[75%]">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                            <ArrowRightLeft size={18} color="#A78BFA" />
                            <Text className="text-white text-lg font-bold">Trocar Exercício</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <X size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-slate-400 text-sm mb-4">
                        {exerciseName ? `Atual: ${exerciseName}` : 'Selecione um substituto.'}
                    </Text>

                    <View className="mb-4">
                        <View className="flex-row items-center rounded-xl border border-slate-700 bg-slate-950 px-3">
                            <Search size={16} color="#94A3B8" />
                            <TextInput
                                value={searchQuery}
                                onChangeText={onSearchQueryChange}
                                placeholder="Buscar exercicio para troca..."
                                placeholderTextColor="#64748B"
                                className="flex-1 px-2 py-3 text-slate-100"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => onSearchQueryChange('')} className="p-1">
                                    <X size={14} color="#94A3B8" />
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
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text className="text-slate-300 text-xs font-medium uppercase tracking-wide mb-2">
                                Sugestoes rapidas
                            </Text>
                            {options.length === 0 ? (
                                <View className="py-10 items-center justify-center">
                                    <RefreshCw size={20} color="#64748B" />
                                    <Text className="text-slate-400 mt-3 text-center">
                                        Nenhuma sugestao disponivel para este exercicio.
                                    </Text>
                                </View>
                            ) : (
                                <View className="gap-2 mb-5">
                                    {options.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            onPress={() => onSelect(option)}
                                            className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                                        >
                                            <View className="flex-row items-start justify-between">
                                                <Text className="text-white font-semibold flex-1 mr-3">{option.name}</Text>
                                                <View className={`px-2 py-1 rounded-full border ${option.source === 'manual'
                                                        ? 'bg-violet-500/10 border-violet-500/30'
                                                        : 'bg-slate-800 border-slate-700'
                                                    }`}>
                                                    <Text className={`text-xs font-medium ${option.source === 'manual' ? 'text-violet-300' : 'text-slate-300'}`}>
                                                        {option.source === 'manual' ? 'Treinador' : 'Automatica'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text className="text-slate-400 text-xs mt-1">
                                                {(option.muscle_groups || []).join(', ') || 'Grupo muscular nao informado'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text className="text-slate-300 text-xs font-medium uppercase tracking-wide mb-2">
                                Busca manual
                            </Text>
                            {isSearching ? (
                                <View className="py-6 items-center justify-center">
                                    <ActivityIndicator size="small" color="#8B5CF6" />
                                    <Text className="text-slate-400 mt-2 text-sm">Buscando...</Text>
                                </View>
                            ) : searchQuery.trim().length < 2 ? (
                                <Text className="text-slate-500 text-sm mb-4">
                                    Digite ao menos 2 letras para buscar exercicios similares.
                                </Text>
                            ) : searchResults.length === 0 ? (
                                <Text className="text-slate-500 text-sm mb-4">
                                    Nenhum exercicio encontrado para essa busca.
                                </Text>
                            ) : (
                                <View className="gap-2 mb-2">
                                    {searchResults.map((option) => (
                                        <TouchableOpacity
                                            key={`search-${option.id}`}
                                            onPress={() => onSelect(option)}
                                            className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                                        >
                                            <View className="flex-row items-start justify-between">
                                                <Text className="text-white font-semibold flex-1 mr-3">{option.name}</Text>
                                                <View className="px-2 py-1 rounded-full border bg-slate-800 border-slate-700">
                                                    <Text className="text-xs font-medium text-slate-300">Busca</Text>
                                                </View>
                                            </View>

                                            <Text className="text-slate-400 text-xs mt-1">
                                                {(option.muscle_groups || []).join(', ') || 'Grupo muscular nao informado'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

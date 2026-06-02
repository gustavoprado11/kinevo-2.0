import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowRightLeft, RefreshCw, Search, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ExerciseSubstituteOption } from '../../hooks/useWorkoutSession';
import { useV2Colors, useIsDark } from '../../hooks/useV2Colors';
import { toRgba } from '../../lib/brandColor';

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
    const colors = useV2Colors();
    const isDark = useIsDark();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                >
                    <BlurView
                        intensity={isDark ? 100 : 90}
                        tint={isDark ? 'dark' : 'light'}
                        style={{
                            flex: 1,
                            backgroundColor: colors.surface.glass,
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            padding: 24,
                            paddingBottom: 40,
                            maxHeight: '85%',
                            borderTopWidth: 1,
                            borderTopColor: colors.border.subtle,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 10,
                        }}
                    >
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center gap-2">
                                <ArrowRightLeft size={18} color={colors.purple[600]} />
                                <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>Substituir Exercício</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: colors.surface.card2, borderRadius: 999 }}>
                                <X size={18} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: colors.text.tertiary, fontSize: 14, marginBottom: 16 }}>
                            {exerciseName ? `Atual: ${exerciseName}` : 'Selecione um substituto.'}
                        </Text>

                        <View style={{ marginBottom: 24 }}>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: colors.border.default,
                                backgroundColor: colors.surface.card2,
                                paddingHorizontal: 12,
                                overflow: 'hidden',
                            }}>
                                <Search size={16} color={colors.text.tertiary} />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={onSearchQueryChange}
                                    placeholder="Buscar exercício para troca..."
                                    placeholderTextColor={colors.text.quaternary}
                                    style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 16, color: colors.text.primary, fontWeight: '500' }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => onSearchQueryChange('')} style={{ padding: 4 }}>
                                        <X size={14} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {isLoading ? (
                            <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={colors.purple[500]} />
                                <Text style={{ color: colors.text.tertiary, marginTop: 12 }}>Carregando substituicoes...</Text>
                            </View>
                        ) : (
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                                    Sugestões rápidas
                                </Text>
                                {options.length === 0 ? (
                                    <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                                        <RefreshCw size={20} color={colors.text.tertiary} />
                                        <Text style={{ color: colors.text.tertiary, marginTop: 12, textAlign: 'center' }}>
                                            Nenhuma sugestao disponivel para este exercicio.
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={{ marginBottom: 20 }}>
                                        {options.map((option) => (
                                            <TouchableOpacity
                                                key={option.id}
                                                onPress={() => onSelect(option)}
                                                style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: colors.text.primary, fontWeight: '600', flex: 1, marginRight: 12, fontSize: 16 }}>{option.name}</Text>
                                                    <View style={{
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        backgroundColor: option.source === 'manual' ? toRgba(colors.purple[600], 0.14) : colors.surface.card2,
                                                        borderColor: option.source === 'manual' ? toRgba(colors.purple[600], 0.32) : colors.border.default,
                                                    }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: option.source === 'manual' ? colors.purple[600] : colors.text.secondary }}>
                                                            {option.source === 'manual' ? 'Treinador' : 'Automática'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 4 }}>
                                                    {(option.muscle_groups || []).join(', ') || 'Grupo muscular não informado'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                                    Busca manual
                                </Text>
                                {isSearching ? (
                                    <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
                                        <ActivityIndicator size="small" color={colors.purple[600]} />
                                        <Text style={{ color: colors.text.tertiary, marginTop: 8, fontSize: 14 }}>Buscando...</Text>
                                    </View>
                                ) : searchQuery.trim().length < 2 ? (
                                    <Text style={{ color: colors.text.tertiary, fontSize: 14, marginBottom: 16, fontStyle: 'italic' }}>
                                        Digite ao menos 2 letras para buscar exercícios similares.
                                    </Text>
                                ) : searchResults.length === 0 ? (
                                    <Text style={{ color: colors.text.tertiary, fontSize: 14, marginBottom: 16, fontStyle: 'italic' }}>
                                        Nenhum exercício encontrado para essa busca.
                                    </Text>
                                ) : (
                                    <View style={{ marginBottom: 8 }}>
                                        {searchResults.map((option) => (
                                            <TouchableOpacity
                                                key={`search-${option.id}`}
                                                onPress={() => onSelect(option)}
                                                style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <Text style={{ color: colors.text.primary, fontWeight: '600', flex: 1, marginRight: 12, fontSize: 16 }}>{option.name}</Text>
                                                    <View style={{
                                                        paddingHorizontal: 8,
                                                        paddingVertical: 4,
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        backgroundColor: colors.surface.card2,
                                                        borderColor: colors.border.default,
                                                    }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.text.secondary }}>Busca</Text>
                                                    </View>
                                                </View>

                                                <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: 4 }}>
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

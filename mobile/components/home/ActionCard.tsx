import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Dumbbell, ChevronRight, Coffee, Check } from "lucide-react-native";

interface ActionCardProps {
    workout?: {
        id: string;
        name: string;
        items?: { length: number };
        notes?: string;
    } | null;
    isCompleted?: boolean;
    title?: string;
    onPress?: () => void;
}

export function ActionCard({ workout, isCompleted, title, onPress }: ActionCardProps) {
    const sectionTitle = title || "Hoje";

    if (!workout) {
        // Rest Day Card
        return (
            <View style={{ marginBottom: 32 }}>
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#e2e8f0',
                        marginBottom: 14,
                        letterSpacing: 0.5,
                    }}
                >
                    {sectionTitle}
                </Text>
                <View
                    style={{
                        backgroundColor: '#1A1A2E',
                        borderRadius: 16,
                        padding: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            height: 48,
                            width: 48,
                            borderRadius: 14,
                            backgroundColor: 'rgba(16,185,129,0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 16,
                        }}
                    >
                        <Coffee size={24} color="#10b981" strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#e2e8f0' }}>
                            Descanso Merecido
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                            Recupere suas energias para o próximo treino.
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    if (isCompleted) {
        // Completed Workout Card — mirrors WorkoutCard structure
        return (
            <View style={{ marginBottom: 28 }}>
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#e2e8f0',
                        marginBottom: 14,
                        letterSpacing: 0.5,
                    }}
                >
                    {sectionTitle}
                </Text>
                <View
                    style={{
                        backgroundColor: '#1A1A2E',
                        borderRadius: 16,
                        overflow: 'hidden',
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 18,
                            paddingHorizontal: 20,
                        }}
                    >
                        {/* Icon Badge — same size as WorkoutCard, green tint */}
                        <View
                            style={{
                                height: 48,
                                width: 48,
                                borderRadius: 14,
                                backgroundColor: 'rgba(16,185,129,0.08)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 16,
                            }}
                        >
                            <Check size={22} color="#34d399" strokeWidth={2} />
                        </View>

                        {/* Content — same typography as WorkoutCard */}
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 15,
                                    fontWeight: '600',
                                    color: '#e2e8f0',
                                    marginBottom: 3,
                                }}
                            >
                                {workout.name}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: '500',
                                    color: '#34d399',
                                }}
                            >
                                Concluído com sucesso!
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // Active Workout Card
    return (
        <View style={{ marginBottom: 32 }}>
            <Text
                style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#e2e8f0',
                    marginBottom: 14,
                    letterSpacing: 0.5,
                }}
            >
                {title || "Treino de Hoje"}
            </Text>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                style={{ borderRadius: 20, overflow: 'hidden' }}
            >
                <LinearGradient
                    colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 24 }}
                >
                    {/* Top row: Icon + Tag */}
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 24,
                        }}
                    >
                        <View
                            style={{
                                height: 44,
                                width: 44,
                                borderRadius: 22,
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Dumbbell size={20} color="#fff" />
                        </View>
                        <View
                            style={{
                                backgroundColor: 'rgba(0,0,0,0.15)',
                                paddingHorizontal: 12,
                                paddingVertical: 5,
                                borderRadius: 20,
                            }}
                        >
                            <Text
                                style={{
                                    color: 'rgba(255,255,255,0.75)',
                                    fontSize: 9,
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: 2.5,
                                }}
                            >
                                Agendado
                            </Text>
                        </View>
                    </View>

                    {/* Title */}
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: '800',
                            color: '#ffffff',
                            marginBottom: 6,
                        }}
                    >
                        {workout.name}
                    </Text>

                    {/* Notes */}
                    {workout.notes && (
                        <Text
                            style={{
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.6)',
                                marginBottom: 16,
                            }}
                            numberOfLines={1}
                        >
                            {workout.notes}
                        </Text>
                    )}

                    {/* Bottom row: Exercise count + Arrow */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 14,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '500',
                                color: 'rgba(255,255,255,0.55)',
                            }}
                        >
                            {workout.items?.length || 0} exercícios
                        </Text>
                        <View
                            style={{
                                height: 36,
                                width: 36,
                                borderRadius: 18,
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

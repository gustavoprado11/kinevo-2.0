import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Dumbbell, ChevronRight } from "lucide-react-native";

interface WorkoutCardProps {
    title: string;
    subtitle?: string;
    exerciseCount: number;
    onPress?: () => void;
    index?: number;
}

export function WorkoutCard({ title, subtitle, exerciseCount, onPress, index = 0 }: WorkoutCardProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{
                marginBottom: 14,
                borderRadius: 16,
                backgroundColor: '#1A1A2E',
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
                {/* Icon Badge */}
                <View
                    style={{
                        height: 48,
                        width: 48,
                        borderRadius: 14,
                        backgroundColor: 'rgba(139,92,246,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                    }}
                >
                    <Dumbbell size={22} color="#a78bfa" strokeWidth={1.5} />
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: '#e2e8f0',
                            marginBottom: 3,
                        }}
                    >
                        {title}
                    </Text>

                    {subtitle && (
                        <Text
                            style={{
                                fontSize: 12,
                                color: '#64748b',
                                fontWeight: '400',
                                marginBottom: 2,
                            }}
                            numberOfLines={1}
                        >
                            {subtitle}
                        </Text>
                    )}

                    <Text
                        style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.40)',
                            fontWeight: '400',
                        }}
                    >
                        {exerciseCount} exercícios
                    </Text>
                </View>

                {/* Chevron */}
                <ChevronRight size={18} color="#475569" strokeWidth={1.5} />
            </View>
        </TouchableOpacity>
    );
}

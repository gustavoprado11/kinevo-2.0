import React from "react";
import { View, Text } from "react-native";
import { Dumbbell, ChevronRight } from "lucide-react-native";
import { PressableScale } from "./shared/PressableScale";

interface WorkoutCardProps {
    title: string;
    subtitle?: string;
    exerciseCount: number;
    onPress?: () => void;
    index?: number;
}

export function WorkoutCard({ title, subtitle, exerciseCount, onPress, index = 0 }: WorkoutCardProps) {
    return (
        <PressableScale
            onPress={onPress}
            style={{
                marginBottom: 12,
                borderRadius: 20,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            <View
                style={{
                    backgroundColor: '#ffffff',
                    borderWidth: 1,
                    borderColor: 'rgba(0, 0, 0, 0.04)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 18,
                    paddingHorizontal: 20,
                    borderRadius: 20,
                }}
            >
                {/* Icon Badge */}
                <View
                    style={{
                        height: 48,
                        width: 48,
                        borderRadius: 14,
                        backgroundColor: '#f5f3ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                    }}
                >
                    <Dumbbell size={22} color="#7c3aed" strokeWidth={1.5} />
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: '#0f172a',
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
                            color: '#94a3b8',
                            fontWeight: '400',
                        }}
                    >
                        {exerciseCount} exercícios
                    </Text>
                </View>

                {/* Chevron */}
                <ChevronRight size={18} color="#cbd5e1" strokeWidth={1.5} />
            </View>
        </PressableScale>
    );
}

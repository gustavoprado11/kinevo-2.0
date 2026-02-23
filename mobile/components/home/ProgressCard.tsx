import React, { useCallback } from "react";
import { View, Text } from "react-native";
import { Trophy } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { PressableScale } from "../shared/PressableScale";

interface ProgressCardProps {
    programName: string;
    completedSessions: number;
    targetSessions: number;
}

export function ProgressCard({ programName, completedSessions, targetSessions }: ProgressCardProps) {
    const progress = targetSessions > 0
        ? Math.min((completedSessions / targetSessions) * 100, 100)
        : 0;

    // ── Focus animation: bar fills from 0 → target every time screen gains focus ──
    const barWidth = useSharedValue(0);

    useFocusEffect(
        useCallback(() => {
            // Reset to 0 instantly
            barWidth.value = 0;
            // Animate to target with a satisfying ease-out curve
            const timer = setTimeout(() => {
                barWidth.value = withTiming(progress, {
                    duration: 900,
                    easing: Easing.out(Easing.cubic),
                });
            }, 200); // small delay so user sees the animation start

            return () => clearTimeout(timer);
        }, [progress])
    );

    const animatedBarStyle = useAnimatedStyle(() => ({
        width: `${barWidth.value}%`,
    }));

    return (
        <PressableScale
            pressScale={0.98}
            style={{
                borderRadius: 24,
                overflow: 'hidden',
                marginBottom: 32,
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
                    padding: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 24,
                }}
            >
                {/* Header: Label + Trophy */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: 2,
                                color: '#94a3b8',
                                marginBottom: 6,
                            }}
                        >
                            Programa Atual
                        </Text>
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: '700',
                                color: '#0f172a',
                            }}
                            numberOfLines={1}
                        >
                            {programName}
                        </Text>
                    </View>
                    <View
                        style={{
                            height: 44,
                            width: 44,
                            borderRadius: 22,
                            backgroundColor: '#f5f3ff',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Trophy size={20} color="#7c3aed" />
                    </View>
                </View>

                {/* Meta row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                        Meta Semanal
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: '#7c3aed' }}>
                            {completedSessions}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#64748b', marginLeft: 4 }}>
                            / {targetSessions} treinos
                        </Text>
                    </View>
                </View>

                {/* Animated Progress Bar */}
                <View
                    style={{
                        height: 6,
                        backgroundColor: '#f1f5f9',
                        borderRadius: 3,
                        overflow: 'hidden',
                    }}
                >
                    <Animated.View
                        style={[
                            {
                                height: '100%',
                                backgroundColor: '#7c3aed',
                                borderRadius: 3,
                            },
                            animatedBarStyle,
                        ]}
                    />
                </View>
            </View>
        </PressableScale>
    );
}

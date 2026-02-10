import React from "react";
import { View, Text } from "react-native";
import { Trophy } from "lucide-react-native";

interface ProgressCardProps {
    programName: string;
    completedSessions: number;
    targetSessions: number;
}

export function ProgressCard({ programName, completedSessions, targetSessions }: ProgressCardProps) {
    const progress = targetSessions > 0
        ? Math.min((completedSessions / targetSessions) * 100, 100)
        : 0;

    return (
        <View
            style={{
                backgroundColor: '#1A1A2E',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                padding: 24,
                marginBottom: 32,
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
                            color: 'rgba(255,255,255,0.45)',
                            marginBottom: 6,
                        }}
                    >
                        Programa Atual
                    </Text>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: '700',
                            color: '#e2e8f0',
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
                        backgroundColor: 'rgba(139,92,246,0.1)',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Trophy size={20} color="#8b5cf6" />
                </View>
            </View>

            {/* Meta row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                    Meta Semanal
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#a78bfa' }}>
                        {completedSessions}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#64748b', marginLeft: 4 }}>
                        / {targetSessions} treinos
                    </Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View
                style={{
                    height: 6,
                    backgroundColor: '#1e293b',
                    borderRadius: 3,
                    overflow: 'hidden',
                }}
            >
                <View
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        backgroundColor: '#8b5cf6',
                        borderRadius: 3,
                    }}
                />
            </View>
        </View>
    );
}

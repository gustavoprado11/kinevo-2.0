import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

interface RestTimerOverlayProps {
    endTime: number;
    totalSeconds: number;
    exerciseName: string;
    onSkip: () => void;
    onComplete: () => void;
    onAdjustTime: (deltaSeconds: number) => void;
}

export function RestTimerOverlay({
    endTime,
    totalSeconds,
    exerciseName,
    onSkip,
    onComplete,
    onAdjustTime,
}: RestTimerOverlayProps) {
    const [remaining, setRemaining] = useState(() =>
        Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
    );

    const stableOnComplete = useCallback(onComplete, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setRemaining(r);
            if (r <= 0) {
                clearInterval(interval);
                stableOnComplete();
            }
        }, 200);
        return () => clearInterval(interval);
    }, [endTime, stableOnComplete]);

    const progress = totalSeconds > 0 ? Math.min(1, (totalSeconds - remaining) / totalSeconds) : 0;

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const display = `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
        <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
        }}>
            {/* Bottom sheet container */}
            <BlurView
                intensity={100}
                tint="light"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    borderTopWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    paddingTop: 16,
                    paddingBottom: 44,
                    paddingHorizontal: 24,
                    shadowColor: '#7C3AED',
                    shadowOffset: { width: 0, height: -8 },
                    shadowOpacity: 0.1,
                    shadowRadius: 24,
                    elevation: 12,
                    overflow: 'hidden',
                }}
            >
                {/* Handle bar */}
                <View style={{
                    width: 36,
                    height: 4,
                    backgroundColor: '#E2E8F0',
                    borderRadius: 2,
                    alignSelf: 'center',
                    marginBottom: 16,
                }} />

                {/* Header: label + skip */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20,
                }}>
                    <Text style={{
                        color: '#64748B',
                        fontSize: 11,
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: 2,
                    }}>
                        Descanso
                    </Text>

                    <TouchableOpacity
                        onPress={onSkip}
                        activeOpacity={0.6}
                        style={{
                            borderRadius: 12,
                            overflow: 'hidden',
                        }}
                    >
                        <BlurView
                            intensity={40}
                            tint="light"
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingVertical: 8,
                                paddingHorizontal: 14,
                                backgroundColor: 'rgba(148, 163, 184, 0.15)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                            }}
                        >
                            <Text style={{
                                color: '#64748B',
                                fontSize: 14,
                                fontWeight: '600',
                            }}>
                                Pular
                            </Text>
                            <X size={14} color="#64748B" />
                        </BlurView>
                    </TouchableOpacity>
                </View>

                {/* Timer row: -10s | TIMER | +30s */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    gap: 16,
                }}>
                    {/* -10s button */}
                    <TouchableOpacity
                        onPress={() => onAdjustTime(-10)}
                        activeOpacity={0.6}
                        style={{
                            borderRadius: 14,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                        }}
                    >
                        <BlurView
                            intensity={40}
                            tint="light"
                            style={{
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                backgroundColor: 'rgba(248, 250, 252, 0.4)',
                            }}
                        >
                            <Text style={{
                                color: '#64748B',
                                fontSize: 14,
                                fontWeight: '700',
                                fontVariant: ['tabular-nums'],
                            }}>
                                -10s
                            </Text>
                        </BlurView>
                    </TouchableOpacity>

                    {/* Timer display */}
                    <Text style={{
                        color: '#0F172A',
                        fontSize: 64,
                        fontWeight: '200',
                        textAlign: 'center',
                        fontVariant: ['tabular-nums'],
                        letterSpacing: 2,
                        minWidth: 160,
                    }}>
                        {display}
                    </Text>

                    {/* +30s button */}
                    <TouchableOpacity
                        onPress={() => onAdjustTime(30)}
                        activeOpacity={0.6}
                        style={{
                            borderRadius: 14,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                        }}
                    >
                        <BlurView
                            intensity={40}
                            tint="light"
                            style={{
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                backgroundColor: 'rgba(248, 250, 252, 0.4)',
                            }}
                        >
                            <Text style={{
                                color: '#64748B',
                                fontSize: 14,
                                fontWeight: '700',
                                fontVariant: ['tabular-nums'],
                            }}>
                                +30s
                            </Text>
                        </BlurView>
                    </TouchableOpacity>
                </View>

                {/* Progress bar */}
                <View style={{
                    height: 5,
                    backgroundColor: '#F1F5F9',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginBottom: 12,
                }}>
                    <View style={{
                        height: '100%',
                        width: `${progress * 100}%`,
                        backgroundColor: '#7C3AED',
                        borderRadius: 3,
                        shadowColor: '#7C3AED',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 6,
                    }} />
                </View>

                <Text style={{
                    color: '#94A3B8',
                    fontSize: 12,
                    textAlign: 'center',
                }}>
                    {exerciseName}
                </Text>
            </BlurView>
        </View>
    );
}

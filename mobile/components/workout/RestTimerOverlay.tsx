import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';

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
            <View style={{
                backgroundColor: '#0F172A',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                paddingTop: 16,
                paddingBottom: 44,
                paddingHorizontal: 24,
                shadowColor: '#7C3AED',
                shadowOffset: { width: 0, height: -8 },
                shadowOpacity: 0.08,
                shadowRadius: 24,
                elevation: 12,
            }}>
                {/* Handle bar */}
                <View style={{
                    width: 36,
                    height: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
                        color: 'rgba(255, 255, 255, 0.45)',
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
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        }}
                    >
                        <Text style={{
                            color: 'rgba(255, 255, 255, 0.50)',
                            fontSize: 14,
                            fontWeight: '600',
                        }}>
                            Pular
                        </Text>
                        <X size={14} color="rgba(255, 255, 255, 0.40)" />
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
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        }}
                    >
                        <Text style={{
                            color: 'rgba(255, 255, 255, 0.45)',
                            fontSize: 14,
                            fontWeight: '700',
                            fontVariant: ['tabular-nums'],
                        }}>
                            -10s
                        </Text>
                    </TouchableOpacity>

                    {/* Timer display */}
                    <Text style={{
                        color: '#F1F5F9',
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
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        }}
                    >
                        <Text style={{
                            color: 'rgba(255, 255, 255, 0.45)',
                            fontSize: 14,
                            fontWeight: '700',
                            fontVariant: ['tabular-nums'],
                        }}>
                            +30s
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Progress bar */}
                <View style={{
                    height: 5,
                    backgroundColor: '#1E293B',
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

                {/* Exercise name */}
                <Text style={{
                    color: 'rgba(255, 255, 255, 0.35)',
                    fontSize: 12,
                    textAlign: 'center',
                }}>
                    {exerciseName}
                </Text>
            </View>
        </View>
    );
}

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface RestTimerOverlayProps {
    endTime: number;
    totalSeconds: number;
    exerciseName: string;
    onSkip: () => void;
    onComplete: () => void;
    onAdjustTime: (deltaSeconds: number) => void;
}

const CIRCLE_SIZE = 140;
const STROKE_WIDTH = 6;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                stableOnComplete();
            }
        }, 200);
        return () => clearInterval(interval);
    }, [endTime, stableOnComplete]);

    const progress = totalSeconds > 0 ? Math.min(1, (totalSeconds - remaining) / totalSeconds) : 0;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const display = `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
        <View style={styles.overlay}>
            <BlurView
                intensity={100}
                tint="light"
                style={styles.container}
            >
                {/* Handle bar */}
                <View style={styles.handle} />

                {/* Header: label + skip */}
                <View style={styles.header}>
                    <Text style={styles.label}>Descanso</Text>
                    <TouchableOpacity
                        onPress={onSkip}
                        activeOpacity={0.6}
                        style={styles.skipButtonOuter}
                    >
                        <BlurView
                            intensity={40}
                            tint="light"
                            style={styles.skipButton}
                        >
                            <Text style={styles.skipText}>Pular</Text>
                            <X size={14} color="#64748B" />
                        </BlurView>
                    </TouchableOpacity>
                </View>

                {/* Circular timer */}
                <View style={styles.timerContainer}>
                    <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                        {/* Background circle */}
                        <Circle
                            cx={CIRCLE_SIZE / 2}
                            cy={CIRCLE_SIZE / 2}
                            r={RADIUS}
                            stroke="#e2e8f0"
                            strokeWidth={STROKE_WIDTH}
                            fill="none"
                        />
                        {/* Progress circle */}
                        <Circle
                            cx={CIRCLE_SIZE / 2}
                            cy={CIRCLE_SIZE / 2}
                            r={RADIUS}
                            stroke="#7c3aed"
                            strokeWidth={STROKE_WIDTH}
                            fill="none"
                            strokeDasharray={`${CIRCUMFERENCE}`}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            rotation={-90}
                            origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
                        />
                    </Svg>
                    {/* Timer text centered in circle */}
                    <View style={styles.timerTextContainer}>
                        <Text style={styles.timerText}>{display}</Text>
                    </View>
                </View>

                {/* Adjust buttons */}
                <View style={styles.adjustRow}>
                    <TouchableOpacity
                        onPress={() => onAdjustTime(-15)}
                        activeOpacity={0.6}
                        style={styles.adjustButtonOuter}
                    >
                        <BlurView intensity={40} tint="light" style={styles.adjustButton}>
                            <Text style={styles.adjustText}>-15s</Text>
                        </BlurView>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => onAdjustTime(30)}
                        activeOpacity={0.6}
                        style={styles.adjustButtonOuter}
                    >
                        <BlurView intensity={40} tint="light" style={styles.adjustButton}>
                            <Text style={styles.adjustText}>+30s</Text>
                        </BlurView>
                    </TouchableOpacity>
                </View>

                {/* Exercise name */}
                <Text style={styles.exerciseName}>{exerciseName}</Text>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    container: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        paddingTop: 16,
        paddingBottom: 44,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 12,
        overflow: 'hidden',
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    label: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    skipButtonOuter: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    skipText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    timerContainer: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    timerTextContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerText: {
        color: '#0F172A',
        fontSize: 48,
        fontWeight: '200',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    adjustRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
    },
    adjustButtonOuter: {
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    adjustButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(248, 250, 252, 0.4)',
    },
    adjustText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    exerciseName: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
    },
});

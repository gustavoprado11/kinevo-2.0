import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, AppState } from 'react-native';
import { BlurView } from 'expo-blur';
import { Flame, Play, Pause, Check, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
    WARMUP_TYPE_LABELS,
    type WarmupConfig,
    type WarmupType,
} from '@kinevo/shared/types/workout-items';
import type { ExerciseData } from '../../hooks/useWorkoutSession';

interface WarmupCardProps {
    exercise: ExerciseData;
    disabled?: boolean;
    onTimerStart?: (endTimestamp: number, totalSeconds: number, warmupType: string) => void;
    onTimerStop?: () => void;
}

type TimerState = 'idle' | 'countdown' | 'running' | 'paused' | 'completing' | 'completed';

const COUNTDOWN_SECONDS = 5;

function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function WarmupCard({ exercise, disabled, onTimerStart, onTimerStop }: WarmupCardProps) {
    const config = (exercise.item_config || {}) as WarmupConfig;
    const warmupType: WarmupType = config.warmup_type || 'free';
    const durationMinutes = config.duration_minutes || 0;
    const totalSeconds = durationMinutes * 60;
    const hasTimer = totalSeconds > 0;

    // ── Render state (drives UI) ─────────────────────────────────────────
    const [timerState, setTimerState] = useState<TimerState>(
        exercise.setsData.length > 0 && exercise.setsData[0].completed ? 'completed' : 'idle'
    );
    const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);

    // ── Refs for ALL mutable state (read inside single interval) ─────────
    const timerStateRef = useRef<TimerState>(timerState);
    const timeRemainingRef = useRef(totalSeconds);
    const elapsedTimeRef = useRef(0);
    const countdownRef = useRef(COUNTDOWN_SECONDS);
    const completingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Background recovery: track wall-clock start of running phase
    const phaseStartTimeRef = useRef(0);
    const phaseDurationRef = useRef(0);

    // Stable refs for callbacks
    const onTimerStartRef = useRef(onTimerStart);
    onTimerStartRef.current = onTimerStart;
    const onTimerStopRef = useRef(onTimerStop);
    onTimerStopRef.current = onTimerStop;

    // Config ref
    const configRef = useRef({ hasTimer, totalSeconds });
    configRef.current = { hasTimer, totalSeconds };

    // Animation refs
    const countdownScale = useRef(new Animated.Value(1)).current;
    const completingScale = useRef(new Animated.Value(0.8)).current;
    const completingOpacity = useRef(new Animated.Value(0)).current;

    const typeLabel = WARMUP_TYPE_LABELS[warmupType] || 'Livre';

    // ── Helper: notify Live Activity (reads from refs) ───────────────────
    const notifyTimerStartFromRef = useCallback((remainingSecs: number) => {
        const cfg = configRef.current;
        if (!cfg.hasTimer || !onTimerStartRef.current) return;
        const endTs = Date.now() + remainingSecs * 1000;
        onTimerStartRef.current(endTs, cfg.totalSeconds, typeLabel);
    }, [typeLabel]);

    // ── Helper: start completing animation ───────────────────────────────
    const doStartCompleting = useCallback(() => {
        timerStateRef.current = 'completing';
        setTimerState('completing');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onTimerStopRef.current?.();

        completingScale.setValue(0.8);
        completingOpacity.setValue(0);
        Animated.parallel([
            Animated.spring(completingScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
            Animated.timing(completingOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        completingTimeoutRef.current = setTimeout(() => {
            timerStateRef.current = 'completed';
            setTimerState('completed');
        }, 2000);
    }, [completingScale, completingOpacity]);

    // ── SINGLE STABLE INTERVAL ───────────────────────────────────────────
    const isTimerActive = timerState === 'countdown' || timerState === 'running';

    useEffect(() => {
        if (!isTimerActive) return;

        const intervalId = setInterval(() => {
            const state = timerStateRef.current;
            const cfg = configRef.current;

            // ── COUNTDOWN TICK ───────────────────────────────────────
            if (state === 'countdown') {
                const next = countdownRef.current - 1;

                if (next <= 0) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    countdownRef.current = COUNTDOWN_SECONDS;
                    setCountdownValue(COUNTDOWN_SECONDS);

                    timerStateRef.current = 'running';
                    setTimerState('running');
                    phaseStartTimeRef.current = Date.now();
                    phaseDurationRef.current = cfg.totalSeconds;
                    notifyTimerStartFromRef(cfg.totalSeconds);
                    return;
                }

                countdownRef.current = next;
                setCountdownValue(next);
                countdownScale.setValue(1.2);
                Animated.spring(countdownScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return;
            }

            // ── RUNNING TICK ─────────────────────────────────────────
            if (state === 'running') {
                elapsedTimeRef.current += 1;
                setElapsedTime(elapsedTimeRef.current);

                if (cfg.hasTimer) {
                    const remaining = Math.max(0, cfg.totalSeconds - elapsedTimeRef.current);
                    timeRemainingRef.current = remaining;
                    setTimeRemaining(remaining);
                    if (remaining <= 0) {
                        doStartCompleting();
                    }
                }
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isTimerActive, doStartCompleting, notifyTimerStartFromRef, countdownScale]);

    // ── BACKGROUND RECOVERY ──────────────────────────────────────────────
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (
                nextState !== 'active' ||
                timerStateRef.current !== 'running' ||
                phaseStartTimeRef.current === 0
            ) return;

            const cfg = configRef.current;
            if (!cfg.hasTimer) return;

            const wallElapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
            const remaining = Math.max(0, Math.ceil(phaseDurationRef.current - wallElapsed));

            if (remaining <= 0) {
                doStartCompleting();
            } else {
                const newElapsed = cfg.totalSeconds - remaining;
                elapsedTimeRef.current = newElapsed;
                timeRemainingRef.current = remaining;
                setElapsedTime(newElapsed);
                setTimeRemaining(remaining);
                phaseStartTimeRef.current = Date.now();
                phaseDurationRef.current = remaining;
                notifyTimerStartFromRef(remaining);
            }
        });
        return () => sub.remove();
    }, [doStartCompleting, notifyTimerStartFromRef]);

    // Cleanup completing timeout
    useEffect(() => {
        return () => {
            if (completingTimeoutRef.current) clearTimeout(completingTimeoutRef.current);
        };
    }, []);

    const handleToggleComplete = () => {
        if (disabled) return;
        if (timerState === 'completed') {
            Haptics.selectionAsync();
            timerStateRef.current = 'idle';
            setTimerState('idle');
            setElapsedTime(0);
            elapsedTimeRef.current = 0;
            setTimeRemaining(totalSeconds);
            timeRemainingRef.current = totalSeconds;
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (hasTimer && (timerState === 'running' || timerState === 'paused')) {
                doStartCompleting();
            } else {
                // No timer or idle — skip completing animation
                timerStateRef.current = 'completed';
                setTimerState('completed');
                onTimerStopRef.current?.();
            }
        }
    };

    const handlePlay = () => {
        if (disabled || timerState === 'completed' || timerState === 'completing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        countdownRef.current = COUNTDOWN_SECONDS;
        setCountdownValue(COUNTDOWN_SECONDS);
        timerStateRef.current = 'countdown';
        setTimerState('countdown');

        countdownScale.setValue(1.2);
        Animated.spring(countdownScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    };

    const handlePause = () => {
        timerStateRef.current = 'paused';
        setTimerState('paused');
        onTimerStopRef.current?.();
    };

    const handleResume = () => {
        timerStateRef.current = 'running';
        setTimerState('running');
        phaseStartTimeRef.current = Date.now();
        phaseDurationRef.current = timeRemainingRef.current;
        notifyTimerStartFromRef(timeRemainingRef.current);
    };

    const isCompleted = timerState === 'completed';
    const isActive = timerState === 'running' || timerState === 'paused';

    // Progress for bar (0 → 1)
    const progress = hasTimer && totalSeconds > 0
        ? Math.min(1, (totalSeconds - timeRemaining) / totalSeconds)
        : 0;

    // ── COMPLETING STATE ─────────────────────────────────────────────────────
    if (timerState === 'completing') {
        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={[styles.container, { backgroundColor: 'rgba(240, 253, 244, 0.7)' }]}
            >
                <Animated.View style={[styles.completingCenter, {
                    opacity: completingOpacity,
                    transform: [{ scale: completingScale }],
                }]}>
                    <CheckCircle2 size={48} color="#22c55e" />
                    <Text style={styles.completingLabel}>Concluído!</Text>
                </Animated.View>
            </BlurView>
        );
    }

    // ── COMPLETED STATE ──────────────────────────────────────────────────────
    if (isCompleted) {
        const displayTime = hasTimer
            ? formatTimer(Math.min(elapsedTime, totalSeconds))
            : (durationMinutes ? `${durationMinutes} min` : '');

        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.completedContainer}
            >
                <View style={styles.headerRow}>
                    <Flame size={18} color="#f59e0b" />
                    <Text style={styles.completedTitle}>Aquecimento</Text>
                    {displayTime ? (
                        <Text style={styles.completedTime}>{displayTime}</Text>
                    ) : null}
                    <TouchableOpacity
                        onPress={handleToggleComplete}
                        activeOpacity={0.7}
                        style={styles.checkCircleCompleted}
                    >
                        <Check size={18} color="#fff" strokeWidth={3} />
                    </TouchableOpacity>
                </View>
            </BlurView>
        );
    }

    // ── COUNTDOWN STATE ──────────────────────────────────────────────────────
    if (timerState === 'countdown') {
        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Flame size={18} color="#f59e0b" />
                    <Text style={styles.title}>Aquecimento</Text>
                    <View style={{ flex: 1 }} />
                </View>

                <View style={styles.countdownCenter}>
                    <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: countdownScale }] }]}>
                        {countdownValue}
                    </Animated.Text>
                    <Text style={styles.countdownLabel}>PREPARE-SE</Text>
                </View>
            </BlurView>
        );
    }

    // ── ACTIVE STATE (timer running/paused) ──────────────────────────────────
    if (isActive) {
        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Flame size={18} color="#f59e0b" />
                    <Text style={styles.title}>Aquecimento</Text>
                    <View style={{ flex: 1 }} />

                    {timerState === 'running' ? (
                        <TouchableOpacity onPress={handlePause} style={styles.controlCircle} activeOpacity={0.7}>
                            <Pause size={14} color="#6b7280" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleResume} style={styles.controlCircle} activeOpacity={0.7}>
                            <Play size={14} color="#6b7280" />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={handleToggleComplete}
                        activeOpacity={0.7}
                        style={styles.checkCircleUnchecked}
                    >
                        <View style={styles.checkCircleInner} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.timerDisplay}>
                    {hasTimer ? formatTimer(timeRemaining) : formatTimer(elapsedTime)}
                </Text>

                {hasTimer ? (
                    <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                    </View>
                ) : null}

                <Text style={styles.typeLabel}>{typeLabel}</Text>
            </BlurView>
        );
    }

    // ── IDLE STATE ────────────────────────────────────────────────────────────
    const subtitle = [
        typeLabel,
        durationMinutes ? `${durationMinutes} min` : null,
    ].filter(Boolean).join(' \u00B7 ');

    return (
        <BlurView
            intensity={60}
            tint="light"
            className="rounded-2xl overflow-hidden"
            style={styles.container}
        >
            <View style={styles.headerRow}>
                <Flame size={18} color="#f59e0b" />
                <Text style={styles.title}>Aquecimento</Text>
                <View style={{ flex: 1 }} />

                {hasTimer ? (
                    <TouchableOpacity
                        onPress={handlePlay}
                        style={[styles.controlCircle, disabled && { opacity: 0.5 }]}
                        activeOpacity={0.7}
                        disabled={disabled}
                    >
                        <Play size={14} color="#6b7280" />
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    onPress={handleToggleComplete}
                    activeOpacity={0.7}
                    disabled={disabled}
                    style={[styles.checkCircleUnchecked, disabled && { opacity: 0.5 }]}
                >
                    <View style={styles.checkCircleInner} />
                </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>{subtitle}</Text>

            {config.description ? (
                <Text style={styles.descriptionText}>{config.description}</Text>
            ) : null}
        </BlurView>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        padding: 12,
        marginBottom: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    completedContainer: {
        backgroundColor: 'rgba(249, 250, 251, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 12,
        borderRadius: 16,
        opacity: 0.7,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    completedTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6b7280',
        flex: 1,
    },
    completedTime: {
        fontSize: 14,
        color: '#9ca3af',
        fontVariant: ['tabular-nums'],
        marginRight: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    descriptionText: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
        lineHeight: 18,
    },
    typeLabel: {
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 4,
    },
    timerDisplay: {
        fontSize: 26,
        fontWeight: '200',
        color: '#1f2937',
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
        marginTop: 8,
        marginBottom: 8,
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: '#e5e7eb',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#f59e0b',
        borderRadius: 3,
    },
    controlCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleUnchecked: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e8e8ed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleCompleted: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleInner: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#c7c7cc',
    },
    // Countdown
    countdownCenter: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    countdownNumber: {
        fontSize: 40,
        fontWeight: '700',
        color: '#1f2937',
        fontVariant: ['tabular-nums'],
    },
    countdownLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9ca3af',
        letterSpacing: 3,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    // Completing
    completingCenter: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    completingLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginTop: 8,
    },
});

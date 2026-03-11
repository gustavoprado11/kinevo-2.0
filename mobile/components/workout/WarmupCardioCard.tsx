import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Flame, Activity, Clock, Timer, Check, Play, Pause, SkipForward, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ExerciseData } from '../../hooks/useWorkoutSession';

interface WarmupCardioCardProps {
    exercise: ExerciseData;
    disabled?: boolean;
    /** Called when cardio item is toggled complete (for set_log persistence) */
    onCardioToggle?: (exerciseId: string, completed: boolean, extraData?: Record<string, any>) => void;
}

const CARDIO_EQUIPMENT_LABELS: Record<string, string> = {
    treadmill: 'Esteira',
    bike: 'Bicicleta',
    elliptical: 'Elíptico',
    rower: 'Remo',
    stairmaster: 'Escada',
    jump_rope: 'Corda',
    outdoor_run: 'Corrida',
    outdoor_bike: 'Bike',
    swimming: 'Natação',
    other: 'Outro',
};

/** Build a one-line summary */
function cardioSummary(config: Record<string, any>): string {
    const mode = config.mode || 'continuous';
    const parts: string[] = [];

    if (mode === 'interval' && config.intervals) {
        parts.push(`${config.intervals.rounds}x (${config.intervals.work_seconds}s/${config.intervals.rest_seconds}s)`);
    } else {
        if (config.duration_minutes) parts.push(`${config.duration_minutes} min`);
        if (config.distance_km) parts.push(`${config.distance_km} km`);
    }
    if (config.equipment) parts.push(CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment);
    if (config.intensity) parts.push(config.intensity);
    return parts.join(' · ');
}

// ─── Timer Hook ───────────────────────────────────────────────────────────────
function useCardioTimer(config: Record<string, any>) {
    const mode = config.mode || 'continuous';
    const isInterval = mode === 'interval' && config.intervals;

    const [isRunning, setIsRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0); // seconds elapsed for continuous
    const [currentRound, setCurrentRound] = useState(1);
    const [phase, setPhase] = useState<'work' | 'rest'>('work');
    const [phaseElapsed, setPhaseElapsed] = useState(0);
    const [isDone, setIsDone] = useState(false);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const totalContinuousSeconds = (config.duration_minutes || 0) * 60;
    const workSeconds = config.intervals?.work_seconds || 30;
    const restSeconds = config.intervals?.rest_seconds || 15;
    const totalRounds = config.intervals?.rounds || 8;

    const start = useCallback(() => {
        setIsRunning(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    const pause = useCallback(() => {
        setIsRunning(false);
    }, []);

    const finish = useCallback(() => {
        setIsRunning(false);
        setIsDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, []);

    const skipRound = useCallback(() => {
        if (!isInterval) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (currentRound >= totalRounds) {
            finish();
            return;
        }
        setCurrentRound(r => r + 1);
        setPhase('work');
        setPhaseElapsed(0);
    }, [isInterval, currentRound, totalRounds, finish]);

    const reset = useCallback(() => {
        setIsRunning(false);
        setElapsed(0);
        setCurrentRound(1);
        setPhase('work');
        setPhaseElapsed(0);
        setIsDone(false);
    }, []);

    useEffect(() => {
        if (!isRunning) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        intervalRef.current = setInterval(() => {
            if (isInterval) {
                setPhaseElapsed(prev => {
                    const next = prev + 1;
                    const limit = phase === 'work' ? workSeconds : restSeconds;
                    if (next >= limit) {
                        // Phase complete
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        if (phase === 'work') {
                            if (currentRound >= totalRounds) {
                                // All rounds done
                                finish();
                                return 0;
                            }
                            setPhase('rest');
                            return 0;
                        } else {
                            // Rest done → next work round
                            setCurrentRound(r => r + 1);
                            setPhase('work');
                            return 0;
                        }
                    }
                    return next;
                });
                setElapsed(e => e + 1);
            } else {
                setElapsed(prev => {
                    const next = prev + 1;
                    if (totalContinuousSeconds > 0 && next >= totalContinuousSeconds) {
                        finish();
                    }
                    return next;
                });
            }
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, isInterval, phase, currentRound, totalRounds, workSeconds, restSeconds, totalContinuousSeconds, finish]);

    const continuousRemaining = Math.max(0, totalContinuousSeconds - elapsed);
    const phaseRemaining = isInterval
        ? Math.max(0, (phase === 'work' ? workSeconds : restSeconds) - phaseElapsed)
        : 0;

    return {
        isRunning, elapsed, isDone,
        // Continuous
        continuousRemaining,
        hasContinuousTarget: totalContinuousSeconds > 0,
        // Interval
        currentRound, totalRounds, phase, phaseRemaining,
        isInterval,
        // Controls
        start, pause, finish, skipRound, reset,
    };
}

function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function WarmupCardioCard({ exercise, disabled, onCardioToggle }: WarmupCardioCardProps) {
    const [completed, setCompleted] = useState(
        exercise.setsData.length > 0 && exercise.setsData[0].completed
    );
    const [expanded, setExpanded] = useState(false);
    const [descExpanded, setDescExpanded] = useState(false);

    const isWarmup = exercise.item_type === 'warmup';
    const config = exercise.item_config || {};

    const timer = useCardioTimer(config);

    // Auto-complete when timer finishes
    useEffect(() => {
        if (timer.isDone && !completed) {
            setCompleted(true);
            if (!isWarmup && onCardioToggle) {
                onCardioToggle(exercise.id, true, {
                    actual_duration_seconds: timer.elapsed,
                    completed_rounds: timer.isInterval ? timer.currentRound : undefined,
                });
            }
        }
    }, [timer.isDone]);

    const handleToggle = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const next = !completed;
        setCompleted(next);
        if (!next) {
            timer.reset();
            setExpanded(false);
        }
        if (!isWarmup && onCardioToggle) {
            onCardioToggle(exercise.id, next, next ? { actual_duration_seconds: timer.elapsed } : undefined);
        }
    };

    const handlePlay = () => {
        if (disabled || completed) return;
        setExpanded(true);
        timer.start();
    };

    const handleFinishEarly = () => {
        timer.finish();
        setExpanded(false);
    };

    const accentColor = completed ? '#10b981' : isWarmup ? '#f97316' : '#06b6d4';
    const bgColor = completed
        ? 'rgba(16, 185, 129, 0.06)'
        : isWarmup ? 'rgba(249, 115, 22, 0.06)' : 'rgba(6, 182, 212, 0.06)';
    const borderColor = completed
        ? 'rgba(16, 185, 129, 0.15)'
        : isWarmup ? 'rgba(249, 115, 22, 0.15)' : 'rgba(6, 182, 212, 0.15)';

    // ── Warmup Card ───────────────────────────────────────────────────────────
    if (isWarmup) {
        return (
            <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
                <View style={styles.row}>
                    <View style={[styles.iconWrap, { backgroundColor: completed ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)' }]}>
                        {completed ? <Check size={18} color="#10b981" /> : <Flame size={18} color="#f97316" />}
                    </View>

                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={[styles.label, { color: accentColor }]}>Aquecimento</Text>
                            <TouchableOpacity onPress={handleToggle} disabled={disabled}
                                style={[styles.checkBtn, completed
                                    ? { backgroundColor: completed ? '#10b981' : '#f97316', borderColor: completed ? '#10b981' : '#f97316' }
                                    : { borderColor: 'rgba(255,255,255,0.2)' }
                                ]}
                            >
                                {completed && <Check size={14} color="#fff" />}
                            </TouchableOpacity>
                        </View>

                        {config.description ? (
                            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7}>
                                <Text
                                    numberOfLines={descExpanded ? undefined : 2}
                                    style={styles.warmupDesc}
                                >
                                    {config.description}
                                </Text>
                                {!descExpanded && config.description.length > 80 && (
                                    <Text style={styles.seeMore}>ver mais</Text>
                                )}
                            </TouchableOpacity>
                        ) : null}

                        {config.duration_minutes ? (
                            <View style={[styles.detail, { marginTop: 4 }]}>
                                <Clock size={12} color="rgba(249,115,22,0.5)" />
                                <Text style={styles.detailText}>{config.duration_minutes} min</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        );
    }

    // ── Cardio Card ───────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
            <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: completed ? 'rgba(16,185,129,0.12)' : 'rgba(6,182,212,0.12)' }]}>
                    {completed ? <Check size={18} color="#10b981" /> : <Activity size={18} color="#06b6d4" />}
                </View>

                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.label, { color: accentColor }]}>Aeróbio</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {/* Play button (when collapsed and not completed) */}
                            {!expanded && !completed && !disabled && (
                                <TouchableOpacity onPress={handlePlay} style={styles.playBtn} hitSlop={8}>
                                    <Play size={14} color="#06b6d4" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={handleToggle} disabled={disabled}
                                style={[styles.checkBtn, completed
                                    ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                                    : { borderColor: 'rgba(255,255,255,0.2)' }
                                ]}
                            >
                                {completed && <Check size={14} color="#fff" />}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Summary line */}
                    <Text style={styles.detailText}>{cardioSummary(config)}</Text>

                    {/* Completed duration */}
                    {completed && timer.elapsed > 0 && (
                        <Text style={[styles.detailText, { color: '#10b981', marginTop: 2 }]}>
                            Tempo real: {formatTimer(timer.elapsed)}
                        </Text>
                    )}

                    {/* ── Expanded Timer ─────────────────────────────────── */}
                    {expanded && !completed && (
                        <View style={styles.timerContainer}>
                            {timer.isInterval ? (
                                <>
                                    {/* Phase indicator */}
                                    <View style={[
                                        styles.phaseBadge,
                                        { backgroundColor: timer.phase === 'work' ? 'rgba(239,68,68,0.15)' : 'rgba(20,184,166,0.15)' }
                                    ]}>
                                        <Text style={[
                                            styles.phaseText,
                                            { color: timer.phase === 'work' ? '#ef4444' : '#14b8a6' }
                                        ]}>
                                            {timer.phase === 'work' ? 'TRABALHO' : 'DESCANSO'}
                                        </Text>
                                    </View>

                                    {/* Timer */}
                                    <Text style={[
                                        styles.timerDisplay,
                                        { color: timer.phase === 'work' ? '#ef4444' : '#14b8a6' }
                                    ]}>
                                        {formatTimer(timer.phaseRemaining)}
                                    </Text>

                                    {/* Round counter */}
                                    <Text style={styles.roundText}>
                                        Round {timer.currentRound} / {timer.totalRounds}
                                    </Text>

                                    {/* Round progress */}
                                    <View style={styles.roundProgress}>
                                        {Array.from({ length: timer.totalRounds }, (_, i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.roundDot,
                                                    {
                                                        backgroundColor: i < timer.currentRound - 1
                                                            ? '#10b981'
                                                            : i === timer.currentRound - 1
                                                                ? (timer.phase === 'work' ? '#ef4444' : '#14b8a6')
                                                                : 'rgba(255,255,255,0.1)',
                                                    },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <>
                                    {/* Continuous timer */}
                                    <Text style={styles.timerDisplay}>
                                        {timer.hasContinuousTarget
                                            ? formatTimer(timer.continuousRemaining)
                                            : formatTimer(timer.elapsed)
                                        }
                                    </Text>
                                    {config.intensity && (
                                        <Text style={styles.intensityHint}>Intensidade: {config.intensity}</Text>
                                    )}
                                    {config.equipment && (
                                        <Text style={styles.equipmentTag}>
                                            {CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment}
                                        </Text>
                                    )}
                                </>
                            )}

                            {/* Controls */}
                            <View style={styles.timerControls}>
                                {timer.isRunning ? (
                                    <TouchableOpacity onPress={timer.pause} style={styles.controlBtn}>
                                        <Pause size={20} color="#fff" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={timer.start} style={styles.controlBtn}>
                                        <Play size={20} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                {timer.isInterval && (
                                    <TouchableOpacity onPress={timer.skipRound} style={styles.controlBtnOutline}>
                                        <SkipForward size={18} color="#06b6d4" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={handleFinishEarly} style={styles.controlBtnOutline}>
                                    <Square size={18} color="#10b981" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Notes */}
                    {config.notes ? (
                        <Text style={styles.notes}>{config.notes}</Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
    },
    checkBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(6,182,212,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    warmupDesc: {
        fontSize: 14,
        color: '#92400e',
        lineHeight: 20,
        marginBottom: 2,
    },
    seeMore: {
        fontSize: 11,
        color: '#f97316',
        fontWeight: '600',
        marginTop: 2,
    },
    detail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    notes: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 6,
    },

    // Timer styles
    timerContainer: {
        marginTop: 12,
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    phaseBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 8,
    },
    phaseText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 2,
    },
    timerDisplay: {
        fontSize: 36,
        fontWeight: '200',
        color: '#06b6d4',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    roundText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    roundProgress: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 8,
    },
    roundDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    intensityHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    equipmentTag: {
        fontSize: 11,
        color: 'rgba(6,182,212,0.6)',
        marginTop: 4,
    },
    timerControls: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    controlBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(6,182,212,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlBtnOutline: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

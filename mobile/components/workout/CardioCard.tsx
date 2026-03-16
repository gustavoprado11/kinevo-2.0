import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, AppState } from 'react-native';
import { BlurView } from 'expo-blur';
import {
    Activity, Play, Pause, Check, SkipForward, CheckCircle2,
    Footprints, Bike, Waves, TrendingUp, Zap, Dumbbell,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
    CARDIO_EQUIPMENT_LABELS,
    type CardioConfig,
    type CardioMode,
    type CardioEquipment,
} from '@kinevo/shared/types/workout-items';
import type { ExerciseData } from '../../hooks/useWorkoutSession';
import type { TimerUpdateData } from '../../hooks/useLiveActivity';

interface CardioCardProps {
    exercise: ExerciseData;
    disabled?: boolean;
    onCardioToggle?: (exerciseId: string, completed: boolean, extraData?: Record<string, any>) => void;
    onTimerUpdate?: (data: TimerUpdateData) => void;
    onTimerStop?: () => void;
}

type CardioTimerState = 'idle' | 'countdown' | 'active' | 'completing' | 'completed';
type IntervalPhase = 'work' | 'rest';

const COUNTDOWN_SECONDS = 5;

const EQUIPMENT_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
    treadmill: Footprints,
    bike: Bike,
    elliptical: TrendingUp,
    rower: Waves,
    stairmaster: TrendingUp,
    jump_rope: Zap,
    outdoor_run: Footprints,
    outdoor_bike: Bike,
    swimming: Waves,
    other: Dumbbell,
};

function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CardioCard({ exercise, disabled, onCardioToggle, onTimerUpdate, onTimerStop }: CardioCardProps) {
    const config = (exercise.item_config || {}) as CardioConfig;
    const mode: CardioMode = config.mode || 'continuous';
    const isInterval = mode === 'interval' && !!config.intervals;

    const workSeconds = config.intervals?.work_seconds || 30;
    const restSeconds = config.intervals?.rest_seconds || 15;
    const totalRounds = config.intervals?.rounds || 8;
    const totalContinuousSeconds = (config.duration_minutes || 0) * 60;
    const hasContinuousTarget = totalContinuousSeconds > 0;

    const estimatedIntervalSeconds = isInterval
        ? (workSeconds * totalRounds) + (restSeconds * (totalRounds - 1))
        : 0;

    // ── Render state (drives UI) ───────────────────────────────────────────
    const [cardState, setCardState] = useState<CardioTimerState>(
        exercise.setsData.length > 0 && exercise.setsData[0].completed ? 'completed' : 'idle'
    );
    const [isRunning, setIsRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [phase, setPhase] = useState<IntervalPhase>('work');
    const [currentRound, setCurrentRound] = useState(1);
    const [phaseRemaining, setPhaseRemaining] = useState(workSeconds);
    const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);

    // ── Refs for ALL mutable state (read inside the single interval) ─────
    const timerStateRef = useRef<CardioTimerState>(cardState);
    const isRunningRef = useRef(false);
    const phaseRef = useRef<IntervalPhase>('work');
    const currentRoundRef = useRef(1);
    const phaseRemainingRef = useRef(workSeconds);
    const elapsedRef = useRef(0);
    const countdownRef = useRef(COUNTDOWN_SECONDS);

    const completingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Background recovery: track wall-clock start of current phase
    const phaseStartTimeRef = useRef(0);       // Date.now() when current phase started
    const phaseDurationRef = useRef(0);        // total seconds for current phase

    // Stable refs for callbacks (avoids stale closures)
    const onTimerUpdateRef = useRef(onTimerUpdate);
    onTimerUpdateRef.current = onTimerUpdate;
    const onTimerStopRef = useRef(onTimerStop);
    onTimerStopRef.current = onTimerStop;
    const onCardioToggleRef = useRef(onCardioToggle);
    onCardioToggleRef.current = onCardioToggle;

    // Animation for countdown
    const countdownScale = useRef(new Animated.Value(1)).current;
    // Animation for completing
    const completingScale = useRef(new Animated.Value(0.8)).current;
    const completingOpacity = useRef(new Animated.Value(0)).current;

    const equipmentLabel = config.equipment
        ? CARDIO_EQUIPMENT_LABELS[config.equipment] || config.equipment
        : null;
    const EquipmentIcon = config.equipment
        ? EQUIPMENT_ICONS[config.equipment] || Dumbbell
        : null;

    // Stable ref for config values used inside the interval
    const configRef = useRef({ equipmentLabel, intensity: config.intensity, isInterval, totalRounds, workSeconds, restSeconds, hasContinuousTarget, totalContinuousSeconds });
    configRef.current = { equipmentLabel, intensity: config.intensity, isInterval, totalRounds, workSeconds, restSeconds, hasContinuousTarget, totalContinuousSeconds };

    // ── Helper: notify Live Activity (reads from refs) ───────────────────
    const notifyTimerUpdateFromRef = useCallback((
        remainingSecs: number,
        phaseTotalSecs: number,
        currentPhase?: 'work' | 'rest',
        round?: number,
    ) => {
        const cb = onTimerUpdateRef.current;
        if (!cb) return;
        const cfg = configRef.current;
        const endTs = Date.now() + remainingSecs * 1000;
        cb({
            itemType: 'cardio',
            timerEndTimestamp: endTs,
            timerTotalSeconds: phaseTotalSecs,
            cardioEquipment: cfg.equipmentLabel ?? undefined,
            cardioIntensity: cfg.intensity ?? undefined,
            cardioMode: cfg.isInterval ? 'interval' : 'continuous',
            intervalPhase: currentPhase,
            intervalCurrentRound: round,
            intervalTotalRounds: cfg.isInterval ? cfg.totalRounds : undefined,
        });
    }, []);

    // ── Helper: start completing animation (reads from refs) ─────────────
    const doStartCompleting = useCallback(() => {
        timerStateRef.current = 'completing';
        isRunningRef.current = false;
        setCardState('completing');
        setIsRunning(false);

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
            setCardState('completed');
        }, 2000);
    }, [completingScale, completingOpacity]);

    // ── SINGLE STABLE INTERVAL ───────────────────────────────────────────
    // Only created/destroyed when isTimerActive flips.
    const isTimerActive = cardState === 'countdown' || (cardState === 'active' && isRunning);

    useEffect(() => {
        if (!isTimerActive) return;

        const intervalId = setInterval(() => {
            const state = timerStateRef.current;
            const cfg = configRef.current;

            // ── COUNTDOWN TICK ───────────────────────────────────────
            if (state === 'countdown') {
                const next = countdownRef.current - 1;

                if (next <= 0) {
                    // Countdown finished — transition to active
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    countdownRef.current = COUNTDOWN_SECONDS;
                    setCountdownValue(COUNTDOWN_SECONDS);

                    // Initialize timer state
                    if (cfg.isInterval) {
                        phaseRef.current = 'work';
                        currentRoundRef.current = 1;
                        phaseRemainingRef.current = cfg.workSeconds;
                        setPhase('work');
                        setCurrentRound(1);
                        setPhaseRemaining(cfg.workSeconds);
                        phaseStartTimeRef.current = Date.now();
                        phaseDurationRef.current = cfg.workSeconds;
                        notifyTimerUpdateFromRef(cfg.workSeconds, cfg.workSeconds, 'work', 1);
                    } else if (cfg.hasContinuousTarget) {
                        phaseStartTimeRef.current = Date.now();
                        phaseDurationRef.current = cfg.totalContinuousSeconds;
                        notifyTimerUpdateFromRef(cfg.totalContinuousSeconds, cfg.totalContinuousSeconds);
                    }

                    timerStateRef.current = 'active';
                    isRunningRef.current = true;
                    setCardState('active');
                    setIsRunning(true);
                    return;
                }

                countdownRef.current = next;
                setCountdownValue(next);
                countdownScale.setValue(1.2);
                Animated.spring(countdownScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return;
            }

            // ── ACTIVE TICK ──────────────────────────────────────────
            if (state === 'active' && isRunningRef.current) {
                elapsedRef.current += 1;
                setElapsed(elapsedRef.current);

                if (cfg.isInterval) {
                    const nextRemaining = phaseRemainingRef.current - 1;

                    if (nextRemaining <= 0) {
                        const curPhase = phaseRef.current;
                        const curRound = currentRoundRef.current;

                        if (curPhase === 'work') {
                            if (curRound >= cfg.totalRounds) {
                                doStartCompleting();
                                return;
                            }
                            // work → rest
                            phaseRef.current = 'rest';
                            phaseRemainingRef.current = cfg.restSeconds;
                            setPhase('rest');
                            setPhaseRemaining(cfg.restSeconds);
                            phaseStartTimeRef.current = Date.now();
                            phaseDurationRef.current = cfg.restSeconds;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            notifyTimerUpdateFromRef(cfg.restSeconds, cfg.restSeconds, 'rest', curRound);
                        } else {
                            // rest → next work round
                            const nextRound = curRound + 1;
                            phaseRef.current = 'work';
                            currentRoundRef.current = nextRound;
                            phaseRemainingRef.current = cfg.workSeconds;
                            setPhase('work');
                            setCurrentRound(nextRound);
                            setPhaseRemaining(cfg.workSeconds);
                            phaseStartTimeRef.current = Date.now();
                            phaseDurationRef.current = cfg.workSeconds;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            notifyTimerUpdateFromRef(cfg.workSeconds, cfg.workSeconds, 'work', nextRound);
                        }
                    } else {
                        phaseRemainingRef.current = nextRemaining;
                        setPhaseRemaining(nextRemaining);
                    }
                } else {
                    // Continuous mode
                    if (cfg.hasContinuousTarget && elapsedRef.current >= cfg.totalContinuousSeconds) {
                        doStartCompleting();
                    }
                }
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isTimerActive, doStartCompleting, notifyTimerUpdateFromRef, countdownScale]);

    // Notify parent on completion
    useEffect(() => {
        if (cardState === 'completed' && onCardioToggleRef.current) {
            onCardioToggleRef.current(exercise.id, true, {
                actual_duration_seconds: elapsedRef.current,
                completed_rounds: isInterval ? currentRoundRef.current : undefined,
                mode,
            });
        }
    }, [cardState]);

    // ── BACKGROUND RECOVERY ──────────────────────────────────────────────
    // When app returns from background, fast-forward through missed phases.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (
                nextState !== 'active' ||
                timerStateRef.current !== 'active' ||
                !isRunningRef.current ||
                phaseStartTimeRef.current === 0
            ) return;

            const cfg = configRef.current;

            if (cfg.isInterval) {
                // Fast-forward through potentially multiple missed phases
                let elapsedInPhase = (Date.now() - phaseStartTimeRef.current) / 1000;
                let curPhase = phaseRef.current;
                let curRound = currentRoundRef.current;
                let curPhaseDuration = phaseDurationRef.current;

                while (elapsedInPhase >= curPhaseDuration) {
                    elapsedInPhase -= curPhaseDuration;

                    if (curPhase === 'work') {
                        if (curRound >= cfg.totalRounds) {
                            doStartCompleting();
                            return;
                        }
                        curPhase = 'rest';
                        curPhaseDuration = cfg.restSeconds;
                    } else {
                        curRound += 1;
                        curPhase = 'work';
                        curPhaseDuration = cfg.workSeconds;
                    }
                }

                const remaining = Math.max(1, Math.ceil(curPhaseDuration - elapsedInPhase));

                phaseRef.current = curPhase;
                currentRoundRef.current = curRound;
                phaseRemainingRef.current = remaining;
                phaseStartTimeRef.current = Date.now() - (curPhaseDuration - remaining) * 1000;
                phaseDurationRef.current = curPhaseDuration;

                setPhase(curPhase);
                setCurrentRound(curRound);
                setPhaseRemaining(remaining);
                notifyTimerUpdateFromRef(remaining, curPhaseDuration, curPhase, curRound);
            } else if (cfg.hasContinuousTarget) {
                // Continuous mode: phaseStartTimeRef marks when this run segment started,
                // phaseDurationRef = remaining seconds at that moment
                const wallElapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
                const elapsedAtStart = cfg.totalContinuousSeconds - phaseDurationRef.current;
                const newElapsed = Math.floor(elapsedAtStart + wallElapsed);

                if (newElapsed >= cfg.totalContinuousSeconds) {
                    doStartCompleting();
                    return;
                }

                elapsedRef.current = newElapsed;
                setElapsed(newElapsed);
                const newRemaining = cfg.totalContinuousSeconds - newElapsed;
                phaseStartTimeRef.current = Date.now();
                phaseDurationRef.current = newRemaining;
                notifyTimerUpdateFromRef(newRemaining, cfg.totalContinuousSeconds);
            }
        });
        return () => sub.remove();
    }, [doStartCompleting, notifyTimerUpdateFromRef]);

    // Cleanup completing timeout on unmount
    useEffect(() => {
        return () => {
            if (completingTimeoutRef.current) clearTimeout(completingTimeoutRef.current);
        };
    }, []);

    const handleToggleComplete = () => {
        if (disabled) return;
        if (cardState === 'completed') {
            // Uncheck — back to idle
            Haptics.selectionAsync();
            timerStateRef.current = 'idle';
            isRunningRef.current = false;
            setCardState('idle');
            setIsRunning(false);
            setElapsed(0);
            elapsedRef.current = 0;
            setCurrentRound(1);
            currentRoundRef.current = 1;
            setPhase('work');
            phaseRef.current = 'work';
            setPhaseRemaining(workSeconds);
            phaseRemainingRef.current = workSeconds;
            if (onCardioToggleRef.current) onCardioToggleRef.current(exercise.id, false);
        } else {
            // Check — mark completed
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            doStartCompleting();
        }
    };

    const handlePlay = () => {
        if (disabled || cardState === 'completed' || cardState === 'completing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        countdownRef.current = COUNTDOWN_SECONDS;
        setCountdownValue(COUNTDOWN_SECONDS);
        timerStateRef.current = 'countdown';
        setCardState('countdown');

        // Trigger initial scale pulse
        countdownScale.setValue(1.2);
        Animated.spring(countdownScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    };

    const handlePause = () => {
        isRunningRef.current = false;
        setIsRunning(false);
        onTimerStopRef.current?.();
    };

    const handleResume = () => {
        isRunningRef.current = true;
        setIsRunning(true);
        // Resume without countdown — reset phase start for background recovery
        if (isInterval) {
            const phaseTotalSecs = phaseRef.current === 'work' ? workSeconds : restSeconds;
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = phaseRemainingRef.current;
            notifyTimerUpdateFromRef(phaseRemainingRef.current, phaseTotalSecs, phaseRef.current, currentRoundRef.current);
        } else if (hasContinuousTarget) {
            const remaining = totalContinuousSeconds - elapsedRef.current;
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = remaining;
            notifyTimerUpdateFromRef(remaining, totalContinuousSeconds);
        }
    };

    const handleSkipPhase = () => {
        if (!isInterval) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const curPhase = phaseRef.current;
        const curRound = currentRoundRef.current;

        if (curPhase === 'work') {
            if (curRound >= totalRounds) {
                doStartCompleting();
                return;
            }
            phaseRef.current = 'rest';
            phaseRemainingRef.current = restSeconds;
            setPhase('rest');
            setPhaseRemaining(restSeconds);
            notifyTimerUpdateFromRef(restSeconds, restSeconds, 'rest', curRound);
        } else {
            const nextRound = curRound + 1;
            phaseRef.current = 'work';
            currentRoundRef.current = nextRound;
            phaseRemainingRef.current = workSeconds;
            setPhase('work');
            setCurrentRound(nextRound);
            setPhaseRemaining(workSeconds);
            notifyTimerUpdateFromRef(workSeconds, workSeconds, 'work', nextRound);
        }
    };

    // Computed values
    const continuousRemaining = Math.max(0, totalContinuousSeconds - elapsed);
    const continuousProgress = hasContinuousTarget && totalContinuousSeconds > 0
        ? Math.min(1, elapsed / totalContinuousSeconds)
        : 0;

    // ── COMPLETING STATE ─────────────────────────────────────────────────────
    if (cardState === 'completing') {
        const completingText = isInterval
            ? `${currentRound}/${totalRounds} rounds`
            : null;

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
                    {completingText ? (
                        <Text style={styles.completingRounds}>{completingText}</Text>
                    ) : null}
                    <Text style={styles.completingLabel}>Concluído!</Text>
                </Animated.View>
            </BlurView>
        );
    }

    // ── COMPLETED STATE ──────────────────────────────────────────────────────
    if (cardState === 'completed') {
        const summary = isInterval
            ? `${totalRounds}/${totalRounds} rounds \u00B7 ${formatTimer(elapsed)}`
            : formatTimer(elapsed);

        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.completedContainer}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.completedTitle}>Aeróbio concluído</Text>
                    <Text style={styles.completedTime}>{summary}</Text>
                    {EquipmentIcon ? (
                        <EquipmentIcon size={16} color="#9ca3af" />
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
    if (cardState === 'countdown') {
        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.title}>Aeróbio</Text>
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

    // ── ACTIVE STATE — INTERVAL MODE ─────────────────────────────────────────
    if (cardState === 'active' && isInterval) {
        const isWork = phase === 'work';
        const phaseColor = isWork ? '#dc2626' : '#059669';
        const phaseLabel = isWork ? 'TRABALHO' : 'DESCANSO';

        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.title}>Aeróbio</Text>
                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={handleSkipPhase} style={styles.controlCircle} activeOpacity={0.7}>
                        <SkipForward size={14} color="#6b7280" />
                    </TouchableOpacity>

                    {isRunning ? (
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

                <View style={styles.phaseBadgeRow}>
                    <View style={[styles.phaseBadge, {
                        backgroundColor: isWork ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    }]}>
                        <Text style={[styles.phaseText, { color: phaseColor }]}>{phaseLabel}</Text>
                    </View>
                    {equipmentLabel && EquipmentIcon ? (
                        <View style={styles.equipmentInline}>
                            <EquipmentIcon size={14} color="#9ca3af" />
                            <Text style={styles.equipmentText}>{equipmentLabel}</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={[styles.timerDisplay, { color: phaseColor }]}>
                    {formatTimer(phaseRemaining)}
                </Text>

                <Text style={styles.roundLabel}>Round {currentRound} / {totalRounds}</Text>

                <View style={styles.dotsRow}>
                    {Array.from({ length: totalRounds }, (_, i) => {
                        let dotColor = '#d1d5db';
                        if (i < currentRound - 1) dotColor = '#06b6d4';
                        else if (i === currentRound - 1) dotColor = phaseColor;
                        return (
                            <View key={i} style={[styles.dot, { backgroundColor: dotColor }]} />
                        );
                    })}
                </View>
            </BlurView>
        );
    }

    // ── ACTIVE STATE — CONTINUOUS MODE ───────────────────────────────────────
    if (cardState === 'active') {
        return (
            <BlurView
                intensity={60}
                tint="light"
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.title}>Aeróbio</Text>
                    <View style={{ flex: 1 }} />

                    {isRunning ? (
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

                {equipmentLabel && EquipmentIcon ? (
                    <View style={styles.equipmentInline}>
                        <EquipmentIcon size={14} color="#9ca3af" />
                        <Text style={styles.equipmentText}>{equipmentLabel}</Text>
                    </View>
                ) : null}

                <Text style={styles.timerDisplay}>
                    {hasContinuousTarget ? formatTimer(continuousRemaining) : formatTimer(elapsed)}
                </Text>

                {hasContinuousTarget ? (
                    <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${continuousProgress * 100}%` }]} />
                    </View>
                ) : null}

                {config.intensity ? (
                    <View style={styles.intensityRow}>
                        <View style={styles.intensityBadge}>
                            <Text style={styles.intensityText}>{config.intensity}</Text>
                        </View>
                    </View>
                ) : null}
            </BlurView>
        );
    }

    // ── IDLE STATE ────────────────────────────────────────────────────────────
    const prescriptionParts: string[] = [];
    if (isInterval && config.intervals) {
        prescriptionParts.push(
            `${totalRounds}x (${workSeconds}s trabalho / ${restSeconds}s descanso)`
        );
    } else {
        if (config.duration_minutes) prescriptionParts.push(`${config.duration_minutes} min`);
        if (config.distance_km) prescriptionParts.push(`${config.distance_km} km`);
    }
    if (config.intensity && !isInterval) prescriptionParts.push(config.intensity);
    const prescriptionText = prescriptionParts.join(' \u00B7 ');

    return (
        <BlurView
            intensity={60}
            tint="light"
            className="rounded-2xl overflow-hidden"
            style={styles.container}
        >
            <View style={styles.headerRow}>
                <Activity size={18} color="#06b6d4" />
                <Text style={styles.title}>Aeróbio</Text>
                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    onPress={handlePlay}
                    style={[styles.controlCircle, disabled && { opacity: 0.5 }]}
                    activeOpacity={0.7}
                    disabled={disabled}
                >
                    <Play size={14} color="#6b7280" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleToggleComplete}
                    activeOpacity={0.7}
                    disabled={disabled}
                    style={[styles.checkCircleUnchecked, disabled && { opacity: 0.5 }]}
                >
                    <View style={styles.checkCircleInner} />
                </TouchableOpacity>
            </View>

            {equipmentLabel && EquipmentIcon ? (
                <View style={[styles.equipmentInline, { marginTop: 4 }]}>
                    <EquipmentIcon size={16} color="#6b7280" />
                    <Text style={styles.equipmentLabelBold}>{equipmentLabel}</Text>
                </View>
            ) : null}

            {prescriptionText ? (
                <Text style={styles.subtitle}>{prescriptionText}</Text>
            ) : null}

            {isInterval && estimatedIntervalSeconds > 0 ? (
                <Text style={styles.estimatedDuration}>
                    \u2248 {formatTimer(estimatedIntervalSeconds)}
                </Text>
            ) : null}

            {isInterval && config.intensity ? (
                <View style={[styles.intensityBadge, { alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={styles.intensityText}>{config.intensity}</Text>
                </View>
            ) : null}

            {config.notes ? (
                <Text style={styles.notesText}>{config.notes}</Text>
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
        marginRight: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    estimatedDuration: {
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 2,
    },
    notesText: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
        lineHeight: 18,
    },
    equipmentInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    equipmentText: {
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: '500',
    },
    equipmentLabelBold: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
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
        backgroundColor: '#06b6d4',
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
    intensityRow: {
        alignItems: 'center',
        marginBottom: 4,
    },
    intensityBadge: {
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 100,
    },
    intensityText: {
        fontSize: 13,
        color: '#0891b2',
        fontWeight: '600',
    },
    phaseBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    phaseBadge: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 8,
    },
    phaseText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    roundLabel: {
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 4,
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
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
    completingRounds: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        marginTop: 8,
    },
    completingLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginTop: 4,
    },
});

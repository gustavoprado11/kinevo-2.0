// Fase 7: dark mode adapt via makeStyles(colors) factory + useV2Colors.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    type CardioSegment,
} from '@kinevo/shared/types/workout-items';
import { cardioProtocolLabel, protocolMatchesIntervals } from '@kinevo/shared/lib/cardio/interval-protocols';
import { segmentStructureLabel } from '@kinevo/shared/lib/cardio/segments';
import type { ExerciseData } from '../../hooks/useWorkoutSession';
import type { TimerUpdateData } from '../../hooks/useLiveActivity';
import { useV2Colors, useIsDark, type V2Palette } from '../../hooks/useV2Colors';

interface CardioCardProps {
    exercise: ExerciseData;
    disabled?: boolean;
    onCardioToggle?: (exerciseId: string, completed: boolean, extraData?: Record<string, any>) => void;
    onTimerUpdate?: (data: TimerUpdateData) => void;
    onTimerStop?: () => void;
}

type CardioTimerState = 'idle' | 'countdown' | 'active' | 'completing' | 'completed';
type IntervalPhase = 'work' | 'rest';

/** Segmento normalizado do modo 'phased' — shape achatado que o driver do
 *  timer consome (steady = alvo em segundos; interval = work/rest/rounds). */
interface RuntimeSegment {
    kind: 'steady' | 'interval';
    label?: string;
    /** steady: alvo total em segundos. */
    seconds: number;
    work: number;
    rest: number;
    rounds: number;
    intensity?: string;
}

function normalizeSegments(segments: CardioSegment[] | undefined): RuntimeSegment[] {
    return (segments ?? [])
        .map((s): RuntimeSegment | null => {
            if (s.kind === 'interval') {
                if (!s.intervals) return null;
                return {
                    kind: 'interval',
                    label: s.label,
                    seconds: 0,
                    work: s.intervals.work_seconds || 30,
                    rest: s.intervals.rest_seconds ?? 0,
                    rounds: s.intervals.rounds || 1,
                    intensity: s.intensity,
                };
            }
            const seconds = Math.round((s.duration_minutes ?? 0) * 60);
            if (seconds <= 0) return null;
            return { kind: 'steady', label: s.label, seconds, work: 0, rest: 0, rounds: 0, intensity: s.intensity };
        })
        .filter((s): s is RuntimeSegment => s !== null);
}

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
    const colors = useV2Colors();
    const isDark = useIsDark();
    const styles = makeStyles(colors);
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

    // ── Modo 'phased': sequência de segmentos (o driver troca a "cara" do
    // configRef a cada segmento; o tick contínuo/intervalado roda inalterado).
    const phasedSegments = useMemo(
        () => (mode === 'phased' ? normalizeSegments(config.segments) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mode, exercise.item_config],
    );
    const isPhased = mode === 'phased' && phasedSegments.length > 0;
    const [segmentIndex, setSegmentIndex] = useState(0);
    const segmentIndexRef = useRef(0);
    // Elapsed acumulado no INÍCIO do segmento atual (alvo steady é por segmento).
    const segmentStartElapsedRef = useRef(0);
    const [segmentStartElapsed, setSegmentStartElapsed] = useState(0);
    const phasedSegmentsRef = useRef(phasedSegments);
    phasedSegmentsRef.current = phasedSegments;

    // Valores runtime do segmento ativo (modos simples = os do config, como antes).
    const activeSegment = isPhased
        ? phasedSegments[Math.min(segmentIndex, phasedSegments.length - 1)]
        : null;
    const runIsInterval = activeSegment ? activeSegment.kind === 'interval' : isInterval;
    const runWorkSeconds = activeSegment?.kind === 'interval' ? activeSegment.work : workSeconds;
    const runRestSeconds = activeSegment?.kind === 'interval' ? activeSegment.rest : restSeconds;
    const runTotalRounds = activeSegment?.kind === 'interval' ? activeSegment.rounds : totalRounds;
    const runContinuousTotal = activeSegment
        ? (activeSegment.kind === 'steady' ? activeSegment.seconds : 0)
        : totalContinuousSeconds;
    const runHasContinuousTarget = activeSegment ? activeSegment.kind === 'steady' : hasContinuousTarget;
    const runIntensity = activeSegment ? (activeSegment.intensity ?? config.intensity) : config.intensity;

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

    // Stable ref for config values used inside the interval. Em 'phased' os
    // valores refletem o SEGMENTO ATIVO (o render recomputa; transições dentro
    // do tick escrevem sincronamente via applySegmentToConfigRef).
    const configRef = useRef({
        equipmentLabel,
        intensity: runIntensity,
        isInterval: runIsInterval,
        totalRounds: runTotalRounds,
        workSeconds: runWorkSeconds,
        restSeconds: runRestSeconds,
        hasContinuousTarget: runHasContinuousTarget,
        totalContinuousSeconds: runContinuousTotal,
        isPhased,
        phasedCount: phasedSegments.length,
    });
    configRef.current = {
        equipmentLabel,
        intensity: runIntensity,
        isInterval: runIsInterval,
        totalRounds: runTotalRounds,
        workSeconds: runWorkSeconds,
        restSeconds: runRestSeconds,
        hasContinuousTarget: runHasContinuousTarget,
        totalContinuousSeconds: runContinuousTotal,
        isPhased,
        phasedCount: phasedSegments.length,
    };

    /** Escreve sincronamente no configRef a "cara" do segmento idx — o tick e
     *  a recuperação de background leem só daqui entre renders. */
    const applySegmentToConfigRef = useCallback((idx: number) => {
        const seg = phasedSegmentsRef.current[idx];
        if (!seg) return;
        configRef.current = {
            ...configRef.current,
            intensity: seg.intensity ?? configRef.current.intensity,
            isInterval: seg.kind === 'interval',
            totalRounds: seg.kind === 'interval' ? seg.rounds : 0,
            workSeconds: seg.kind === 'interval' ? seg.work : 0,
            restSeconds: seg.kind === 'interval' ? seg.rest : 0,
            hasContinuousTarget: seg.kind === 'steady',
            totalContinuousSeconds: seg.kind === 'steady' ? seg.seconds : 0,
        };
    }, []);

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

    /** Inicializa o estado de fase para o segmento idx (início do bloco phased
     *  e cada transição de segmento passam por aqui). */
    const beginSegment = useCallback((idx: number) => {
        const seg = phasedSegmentsRef.current[idx];
        if (!seg) return;
        segmentIndexRef.current = idx;
        setSegmentIndex(idx);
        segmentStartElapsedRef.current = elapsedRef.current;
        setSegmentStartElapsed(elapsedRef.current);
        applySegmentToConfigRef(idx);
        if (seg.kind === 'interval') {
            phaseRef.current = 'work';
            currentRoundRef.current = 1;
            phaseRemainingRef.current = seg.work;
            setPhase('work');
            setCurrentRound(1);
            setPhaseRemaining(seg.work);
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = seg.work;
            notifyTimerUpdateFromRef(seg.work, seg.work, 'work', 1);
        } else {
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = seg.seconds;
            notifyTimerUpdateFromRef(seg.seconds, seg.seconds);
        }
    }, [applySegmentToConfigRef, notifyTimerUpdateFromRef]);

    /** Fim da prescrição do TRECHO atual: em phased avança para o próximo
     *  segmento; no último (ou nos modos simples) conclui de verdade. O check
     *  manual NÃO passa por aqui — ele conclui o bloco inteiro. */
    const finishSegment = useCallback(() => {
        const cfg = configRef.current;
        if (cfg.isPhased && segmentIndexRef.current < cfg.phasedCount - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            beginSegment(segmentIndexRef.current + 1);
            return;
        }
        doStartCompleting();
    }, [beginSegment, doStartCompleting]);

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
                    if (cfg.isPhased) {
                        beginSegment(0);
                    } else if (cfg.isInterval) {
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
                                finishSegment();
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
                    // Continuous mode — alvo POR SEGMENTO em phased (elapsed é
                    // acumulado do bloco; o início do segmento desconta).
                    const segElapsed = elapsedRef.current - segmentStartElapsedRef.current;
                    if (cfg.hasContinuousTarget && segElapsed >= cfg.totalContinuousSeconds) {
                        finishSegment();
                    }
                }
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isTimerActive, doStartCompleting, finishSegment, beginSegment, notifyTimerUpdateFromRef, countdownScale]);

    // Notify parent on completion
    useEffect(() => {
        if (cardState === 'completed' && onCardioToggleRef.current) {
            const cfg = configRef.current;
            onCardioToggleRef.current(exercise.id, true, {
                actual_duration_seconds: elapsedRef.current,
                completed_rounds: cfg.isInterval ? currentRoundRef.current : undefined,
                mode,
                // Em 'phased': até onde o aluno chegou (check manual pode
                // concluir no meio — registra a fase alcançada).
                completed_segments: cfg.isPhased ? segmentIndexRef.current + 1 : undefined,
                total_segments: cfg.isPhased ? cfg.phasedCount : undefined,
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

            if (cfg.isPhased) {
                // Fast-forward pode atravessar SEGMENTOS inteiros. Simula a
                // sequência a partir do checkpoint (phaseStartTimeRef) e
                // assenta no segmento/fase onde o relógio de parede caiu.
                const segs = phasedSegmentsRef.current;
                let idx = segmentIndexRef.current;
                let seg = segs[idx];
                if (!seg) return;

                const fullSeconds = (s: RuntimeSegment) =>
                    s.kind === 'steady' ? s.seconds : s.work * s.rounds + s.rest * Math.max(s.rounds - 1, 0);

                let elapsedInPhase = (Date.now() - phaseStartTimeRef.current) / 1000;
                let curPhase = phaseRef.current;
                let curRound = currentRoundRef.current;
                let curPhaseDuration = phaseDurationRef.current;
                let segStartElapsed = segmentStartElapsedRef.current;
                // Steady retomado no meio tem phaseDuration = restante; o que
                // já foi cumprido do segmento antes do checkpoint:
                let posBase = seg.kind === 'steady' ? seg.seconds - curPhaseDuration : 0;
                let crossed = false;

                for (;;) {
                    if (seg.kind === 'interval') {
                        let segmentDone = false;
                        while (elapsedInPhase >= curPhaseDuration) {
                            elapsedInPhase -= curPhaseDuration;
                            if (curPhase === 'work') {
                                if (curRound >= seg.rounds) { segmentDone = true; break; }
                                curPhase = 'rest';
                                curPhaseDuration = seg.rest;
                            } else {
                                curRound += 1;
                                curPhase = 'work';
                                curPhaseDuration = seg.work;
                            }
                        }
                        if (!segmentDone) break;
                    } else {
                        if (elapsedInPhase < curPhaseDuration) break;
                        elapsedInPhase -= curPhaseDuration;
                    }
                    // Segmento venceu em background — avança para o próximo
                    if (idx >= segs.length - 1) {
                        doStartCompleting();
                        return;
                    }
                    segStartElapsed += fullSeconds(seg);
                    idx += 1;
                    seg = segs[idx];
                    crossed = true;
                    posBase = 0;
                    curPhase = 'work';
                    curRound = 1;
                    curPhaseDuration = seg.kind === 'interval' ? seg.work : seg.seconds;
                }

                if (crossed) {
                    segmentIndexRef.current = idx;
                    setSegmentIndex(idx);
                    segmentStartElapsedRef.current = segStartElapsed;
                    setSegmentStartElapsed(segStartElapsed);
                    applySegmentToConfigRef(idx);
                }

                if (seg.kind === 'interval') {
                    const remaining = Math.max(1, Math.ceil(curPhaseDuration - elapsedInPhase));
                    phaseRef.current = curPhase;
                    currentRoundRef.current = curRound;
                    phaseRemainingRef.current = remaining;
                    phaseStartTimeRef.current = Date.now() - (curPhaseDuration - remaining) * 1000;
                    phaseDurationRef.current = curPhaseDuration;
                    setPhase(curPhase);
                    setCurrentRound(curRound);
                    setPhaseRemaining(remaining);
                    if (crossed) {
                        // elapsed aproximado ao cruzar (posição nominal na fase)
                        const approx = Math.round(
                            segStartElapsed
                            + (curRound - 1) * (seg.work + seg.rest)
                            + (curPhase === 'rest' ? seg.work : 0)
                            + (curPhaseDuration - remaining)
                        );
                        elapsedRef.current = Math.max(elapsedRef.current, approx);
                        setElapsed(elapsedRef.current);
                    }
                    notifyTimerUpdateFromRef(remaining, curPhaseDuration, curPhase, curRound);
                } else {
                    const posInSegment = Math.floor(posBase + elapsedInPhase);
                    elapsedRef.current = Math.max(elapsedRef.current, segStartElapsed + posInSegment);
                    setElapsed(elapsedRef.current);
                    const newRemaining = Math.max(1, seg.seconds - posInSegment);
                    phaseStartTimeRef.current = Date.now();
                    phaseDurationRef.current = newRemaining;
                    notifyTimerUpdateFromRef(newRemaining, seg.seconds);
                }
                return;
            }

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
    }, [doStartCompleting, notifyTimerUpdateFromRef, applySegmentToConfigRef]);

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
            setSegmentIndex(0);
            segmentIndexRef.current = 0;
            setSegmentStartElapsed(0);
            segmentStartElapsedRef.current = 0;
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
        // Resume without countdown — reset phase start for background recovery.
        // Lê do configRef: em 'phased' os valores são do segmento ativo.
        const cfg = configRef.current;
        if (cfg.isInterval) {
            const phaseTotalSecs = phaseRef.current === 'work' ? cfg.workSeconds : cfg.restSeconds;
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = phaseRemainingRef.current;
            notifyTimerUpdateFromRef(phaseRemainingRef.current, phaseTotalSecs, phaseRef.current, currentRoundRef.current);
        } else if (cfg.hasContinuousTarget) {
            const remaining = Math.max(1, cfg.totalContinuousSeconds - (elapsedRef.current - segmentStartElapsedRef.current));
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = remaining;
            notifyTimerUpdateFromRef(remaining, cfg.totalContinuousSeconds);
        }
    };

    const handleSkipPhase = () => {
        const cfg = configRef.current;
        if (!cfg.isInterval) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const curPhase = phaseRef.current;
        const curRound = currentRoundRef.current;

        if (curPhase === 'work') {
            if (curRound >= cfg.totalRounds) {
                finishSegment();
                return;
            }
            phaseRef.current = 'rest';
            phaseRemainingRef.current = cfg.restSeconds;
            setPhase('rest');
            setPhaseRemaining(cfg.restSeconds);
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = cfg.restSeconds;
            notifyTimerUpdateFromRef(cfg.restSeconds, cfg.restSeconds, 'rest', curRound);
        } else {
            const nextRound = curRound + 1;
            phaseRef.current = 'work';
            currentRoundRef.current = nextRound;
            phaseRemainingRef.current = cfg.workSeconds;
            setPhase('work');
            setCurrentRound(nextRound);
            setPhaseRemaining(cfg.workSeconds);
            phaseStartTimeRef.current = Date.now();
            phaseDurationRef.current = cfg.workSeconds;
            notifyTimerUpdateFromRef(cfg.workSeconds, cfg.workSeconds, 'work', nextRound);
        }
    };

    /** Em 'phased', pula o SEGMENTO steady atual (o interval usa handleSkipPhase). */
    const handleSkipSegment = () => {
        if (!configRef.current.isPhased) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        finishSegment();
    };

    // Computed values — em 'phased' o alvo contínuo é do SEGMENTO ativo,
    // então o elapsed relevante desconta o início do segmento.
    const segRelElapsed = isPhased ? Math.max(0, elapsed - segmentStartElapsed) : elapsed;
    const continuousRemaining = Math.max(0, runContinuousTotal - segRelElapsed);
    const continuousProgress = runHasContinuousTarget && runContinuousTotal > 0
        ? Math.min(1, segRelElapsed / runContinuousTotal)
        : 0;
    const phaseIndicatorText = isPhased && activeSegment
        ? `Fase ${Math.min(segmentIndex, phasedSegments.length - 1) + 1}/${phasedSegments.length}`
            + (activeSegment.label ? ` · ${activeSegment.label}` : '')
        : null;

    // ── COMPLETING STATE ─────────────────────────────────────────────────────
    if (cardState === 'completing') {
        const completingText = isPhased
            ? `${phasedSegments.length} fases`
            : isInterval
                ? `${currentRound}/${totalRounds} rounds`
                : null;

        return (
            <BlurView
                intensity={60}
                tint={isDark ? 'dark' : 'light'}
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
        const summary = isPhased
            ? `${phasedSegments.length} fases \u00B7 ${formatTimer(elapsed)}`
            : isInterval
                ? `${totalRounds}/${totalRounds} rounds \u00B7 ${formatTimer(elapsed)}`
                : formatTimer(elapsed);

        return (
            <BlurView
                intensity={60}
                tint={isDark ? 'dark' : 'light'}
                className="rounded-2xl overflow-hidden"
                style={styles.completedContainer}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.completedTitle}>Aeróbio concluído</Text>
                    <Text style={styles.completedTime}>{summary}</Text>
                    {EquipmentIcon ? (
                        <EquipmentIcon size={16} color="#8A8681" />
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
                tint={isDark ? 'dark' : 'light'}
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

    // ── ACTIVE STATE — INTERVAL MODE (modo interval ou segmento interval em phased)
    if (cardState === 'active' && runIsInterval) {
        const isWork = phase === 'work';
        const phaseColor = isWork ? '#dc2626' : '#059669';
        const phaseLabel = isWork ? 'TRABALHO' : 'DESCANSO';

        return (
            <BlurView
                intensity={60}
                tint={isDark ? 'dark' : 'light'}
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.title}>Aeróbio</Text>
                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={handleSkipPhase} style={styles.controlCircle} activeOpacity={0.7}>
                        <SkipForward size={14} color="#57534E" />
                    </TouchableOpacity>

                    {isRunning ? (
                        <TouchableOpacity onPress={handlePause} style={styles.controlCircle} activeOpacity={0.7}>
                            <Pause size={14} color="#57534E" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleResume} style={styles.controlCircle} activeOpacity={0.7}>
                            <Play size={14} color="#57534E" />
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

                {phaseIndicatorText ? (
                    <Text style={styles.phaseIndicatorText}>{phaseIndicatorText}</Text>
                ) : null}

                <View style={styles.phaseBadgeRow}>
                    <View style={[styles.phaseBadge, {
                        backgroundColor: isWork ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                    }]}>
                        <Text style={[styles.phaseText, { color: phaseColor }]}>{phaseLabel}</Text>
                    </View>
                    {equipmentLabel && EquipmentIcon ? (
                        <View style={styles.equipmentInline}>
                            <EquipmentIcon size={14} color="#8A8681" />
                            <Text style={styles.equipmentText}>{equipmentLabel}</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={[styles.timerDisplay, { color: phaseColor }]}>
                    {formatTimer(phaseRemaining)}
                </Text>

                <Text style={styles.roundLabel}>Round {currentRound} / {runTotalRounds}</Text>

                <View style={styles.dotsRow}>
                    {Array.from({ length: runTotalRounds }, (_, i) => {
                        let dotColor = '#D6D3D0';
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
                tint={isDark ? 'dark' : 'light'}
                className="rounded-2xl overflow-hidden"
                style={styles.container}
            >
                <View style={styles.headerRow}>
                    <Activity size={18} color="#06b6d4" />
                    <Text style={styles.title}>Aeróbio</Text>
                    <View style={{ flex: 1 }} />

                    {isPhased ? (
                        <TouchableOpacity onPress={handleSkipSegment} style={styles.controlCircle} activeOpacity={0.7}>
                            <SkipForward size={14} color="#57534E" />
                        </TouchableOpacity>
                    ) : null}

                    {isRunning ? (
                        <TouchableOpacity onPress={handlePause} style={styles.controlCircle} activeOpacity={0.7}>
                            <Pause size={14} color="#57534E" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleResume} style={styles.controlCircle} activeOpacity={0.7}>
                            <Play size={14} color="#57534E" />
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

                {phaseIndicatorText ? (
                    <Text style={styles.phaseIndicatorText}>{phaseIndicatorText}</Text>
                ) : null}

                {equipmentLabel && EquipmentIcon ? (
                    <View style={styles.equipmentInline}>
                        <EquipmentIcon size={14} color="#8A8681" />
                        <Text style={styles.equipmentText}>{equipmentLabel}</Text>
                    </View>
                ) : null}

                <Text style={styles.timerDisplay}>
                    {runHasContinuousTarget ? formatTimer(continuousRemaining) : formatTimer(elapsed)}
                </Text>

                {runHasContinuousTarget ? (
                    <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${continuousProgress * 100}%` }]} />
                    </View>
                ) : null}

                {runIntensity ? (
                    <View style={styles.intensityRow}>
                        <View style={styles.intensityBadge}>
                            <Text style={styles.intensityText}>{runIntensity}</Text>
                        </View>
                    </View>
                ) : null}
            </BlurView>
        );
    }

    // ── IDLE STATE ────────────────────────────────────────────────────────────
    const prescriptionParts: string[] = [];
    if (isInterval && config.intervals) {
        // Protocolo nomeado (Tabata, 4×4…) abre a linha quando os números batem.
        const protocolLabel = protocolMatchesIntervals(config.protocol_key, config.intervals)
            ? cardioProtocolLabel(config.protocol_key)
            : null;
        if (protocolLabel) prescriptionParts.push(protocolLabel);
        prescriptionParts.push(
            `${totalRounds}x (${workSeconds}s trabalho / ${restSeconds}s descanso)`
        );
    } else if (!isPhased) {
        // Em 'phased' a prescrição vira a lista de fases abaixo — os campos
        // derivados (duration_minutes/intensity) seriam redundantes aqui.
        if (config.duration_minutes) prescriptionParts.push(`${config.duration_minutes} min`);
        if (config.distance_km) prescriptionParts.push(`${config.distance_km} km`);
    }
    if (config.intensity && !isInterval && !isPhased) prescriptionParts.push(config.intensity);
    const phasedTotalSeconds = phasedSegments.reduce(
        (acc, s) => acc + (s.kind === 'steady' ? s.seconds : s.work * s.rounds + s.rest * Math.max(s.rounds - 1, 0)),
        0,
    );
    const prescriptionText = prescriptionParts.join(' \u00B7 ');

    return (
        <BlurView
            intensity={60}
            tint={isDark ? 'dark' : 'light'}
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
                    <Play size={14} color="#57534E" />
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

            {exercise.progressionWeekLabel ? (
                <Text style={styles.weekLabel}>{exercise.progressionWeekLabel}</Text>
            ) : null}

            {equipmentLabel && EquipmentIcon ? (
                <View style={[styles.equipmentInline, { marginTop: 4 }]}>
                    <EquipmentIcon size={16} color="#57534E" />
                    <Text style={styles.equipmentLabelBold}>{equipmentLabel}</Text>
                </View>
            ) : null}

            {prescriptionText ? (
                <Text style={styles.subtitle}>{prescriptionText}</Text>
            ) : null}

            {isPhased && config.segments ? (
                <View style={styles.phasedList}>
                    {config.segments.map((segment, i) => (
                        <View key={i} style={styles.phasedRow}>
                            <Text style={styles.phasedIndex}>{i + 1}</Text>
                            <Text style={styles.phasedText} numberOfLines={1}>
                                {[segment.label, segmentStructureLabel(segment), segment.intensity]
                                    .filter(Boolean)
                                    .join(' \u00b7 ')}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {isPhased && phasedTotalSeconds > 0 ? (
                <Text style={styles.estimatedDuration}>
                    {'\u2248 '}{formatTimer(phasedTotalSeconds)}
                </Text>
            ) : null}

            {isInterval && estimatedIntervalSeconds > 0 ? (
                <Text style={styles.estimatedDuration}>
                    {'\u2248 '}{formatTimer(estimatedIntervalSeconds)}
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

function makeStyles(colors: V2Palette) {
    return StyleSheet.create({
        container: {
            backgroundColor: colors.surface.glass,
            borderWidth: 1,
            borderColor: colors.border.subtle,
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
            backgroundColor: colors.surface.card2,
            borderWidth: 1,
            borderColor: colors.border.subtle,
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
            color: colors.text.primary,
        },
        completedTitle: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.text.tertiary,
            flex: 1,
        },
        completedTime: {
            fontSize: 14,
            color: colors.text.quaternary,
            fontVariant: ['tabular-nums'],
            marginRight: 4,
        },
        subtitle: {
            fontSize: 14,
            color: colors.text.tertiary,
            marginTop: 4,
        },
        // Progressão semanal: "Semana 5 de 12 · Regenerativa"
        weekLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text.tertiary,
            marginTop: 6,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
        estimatedDuration: {
            fontSize: 13,
            color: colors.text.quaternary,
            marginTop: 2,
        },
        notesText: {
            fontSize: 13,
            color: colors.text.tertiary,
            marginTop: 4,
            lineHeight: 18,
        },
        phasedList: {
            marginTop: 6,
            gap: 3,
        },
        phasedRow: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
        },
        phasedIndex: {
            fontSize: 11,
            color: colors.text.quaternary,
            fontVariant: ['tabular-nums'],
            minWidth: 12,
        },
        phasedText: {
            flex: 1,
            fontSize: 13,
            color: colors.text.tertiary,
        },
        phaseIndicatorText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text.tertiary,
            marginTop: 6,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.5,
        },
        equipmentInline: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        equipmentText: {
            fontSize: 13,
            color: colors.text.quaternary,
            fontWeight: '500',
        },
        equipmentLabelBold: {
            fontSize: 14,
            color: colors.text.secondary,
            fontWeight: '600',
        },
        timerDisplay: {
            fontSize: 26,
            fontWeight: '200',
            color: colors.text.primary,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
            letterSpacing: 2,
            marginTop: 8,
            marginBottom: 8,
        },
        progressBarTrack: {
            height: 6,
            backgroundColor: colors.surface.card2,
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
            backgroundColor: colors.surface.card2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkCircleUnchecked: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface.card2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkCircleCompleted: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.purple[600],
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkCircleInner: {
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: colors.text.quaternary,
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
            color: colors.text.tertiary,
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
            color: colors.text.primary,
            fontVariant: ['tabular-nums'],
        },
        countdownLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.text.quaternary,
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
            color: colors.text.secondary,
            marginTop: 8,
        },
        completingLabel: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text.primary,
            marginTop: 4,
        },
    });
}

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import type { ExerciseData } from './useWorkoutSession';

// Lazy-import native module (iOS only)
let liveActivityModule: typeof import('../modules/live-activity-controller') | null = null;
if (Platform.OS === 'ios') {
    try {
        liveActivityModule = require('../modules/live-activity-controller');
    } catch {
        // Module not available (e.g., Expo Go or Android)
    }
}

interface UseLiveActivityParams {
    workoutName: string;
    workoutId: string;
    exercises: ExerciseData[];
    studentName: string;
    isLoading: boolean;
}

interface TimerUpdateData {
    itemType: 'warmup' | 'cardio';
    timerEndTimestamp: number;     // Unix ms — target end for native countdown
    timerTotalSeconds: number;

    // Warmup-specific
    warmupType?: string;

    // Cardio-specific
    cardioEquipment?: string;
    cardioIntensity?: string;
    cardioMode?: 'continuous' | 'interval';
    intervalPhase?: 'work' | 'rest';
    intervalCurrentRound?: number;
    intervalTotalRounds?: number;
}

interface UseLiveActivityReturn {
    isSupported: boolean;
    isActive: boolean;
    startRestTimer: (exerciseIndex: number, seconds: number) => void;
    updateTimerState: (data: TimerUpdateData) => void;
    clearTimerState: () => void;
    stopActivity: () => void;
}

export type { TimerUpdateData };

export function useLiveActivity({
    workoutName,
    workoutId,
    exercises,
    studentName,
    isLoading,
}: UseLiveActivityParams): UseLiveActivityReturn {
    const isActiveRef = useRef(false);
    const workoutStartTimestampRef = useRef(Date.now());
    const restTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRestingRef = useRef(false);
    const restEndTimestampRef = useRef<number | null>(null);
    const timerDataRef = useRef<TimerUpdateData | null>(null);
    const getWorkoutStateRef = useRef<(() => Record<string, unknown> | null)>(() => null);

    const isSupported = Platform.OS === 'ios' && !!liveActivityModule?.isLiveActivitySupported();

    // Calculate workout state from exercises
    const getWorkoutState = useCallback(() => {
        if (exercises.length === 0) return null;

        // Find current exercise (first with incomplete sets)
        let currentExerciseIndex = exercises.findIndex(ex =>
            ex.setsData.some(s => !s.completed)
        );
        // If all complete, use last exercise
        if (currentExerciseIndex === -1) currentExerciseIndex = exercises.length - 1;

        const currentExercise = exercises[currentExerciseIndex];

        // Count completed sets for current exercise
        const setsCompleted = currentExercise.setsData.filter(s => s.completed).length;

        // Count total completed sets across all exercises
        const totalSetsCompleted = exercises.reduce(
            (sum, ex) => sum + ex.setsData.filter(s => s.completed).length,
            0
        );

        // Count total sets across all exercises
        const totalSetsOverall = exercises.reduce(
            (sum, ex) => sum + ex.setsData.length,
            0
        );

        // Determine item type
        const itemType = currentExercise.item_type || 'exercise';

        // Build state with timer data if active
        const timerData = timerDataRef.current;
        const hasActiveTimer = timerData && timerData.timerEndTimestamp > Date.now();

        return {
            currentExerciseIndex,
            currentExerciseName: currentExercise.name,
            setsCompleted,
            totalSets: currentExercise.setsData.length,
            isResting: isRestingRef.current,
            restEndTimestamp: restEndTimestampRef.current,
            totalSetsCompleted,
            totalSetsOverall,
            workoutStartTimestamp: workoutStartTimestampRef.current,
            currentItemType: hasActiveTimer ? timerData.itemType : itemType,
            timerEndTimestamp: hasActiveTimer ? timerData.timerEndTimestamp : null,
            timerTotalSeconds: hasActiveTimer ? timerData.timerTotalSeconds : null,
            warmupType: hasActiveTimer && timerData.itemType === 'warmup' ? timerData.warmupType : null,
            cardioEquipment: hasActiveTimer && timerData.itemType === 'cardio' ? timerData.cardioEquipment : null,
            cardioIntensity: hasActiveTimer && timerData.itemType === 'cardio' ? timerData.cardioIntensity : null,
            cardioMode: hasActiveTimer && timerData.itemType === 'cardio' ? timerData.cardioMode : null,
            intervalPhase: hasActiveTimer && timerData.itemType === 'cardio' ? timerData.intervalPhase : null,
            intervalCurrentRound: hasActiveTimer && timerData.itemType === 'cardio' ? timerData.intervalCurrentRound : null,
            intervalTotalRounds: hasActiveTimer && timerData.itemType === 'cardio' ? timerData.intervalTotalRounds : null,
            updateId: Date.now().toString(),
        };
    }, [exercises]);

    // Keep ref in sync so stable callbacks always read the latest getWorkoutState
    getWorkoutStateRef.current = getWorkoutState;

    // Start Live Activity when workout loads
    useEffect(() => {
        if (!isSupported || !liveActivityModule || isLoading || exercises.length === 0 || isActiveRef.current) {
            return;
        }

        const totalSetsOverall = exercises.reduce(
            (sum, ex) => sum + ex.setsData.length,
            0
        );

        const firstItemType = exercises[0].item_type || 'exercise';

        liveActivityModule.startWorkoutActivity({
            workoutName,
            workoutId,
            totalExercises: exercises.length,
            studentName,
            workoutStartTimestamp: workoutStartTimestampRef.current,
            firstExerciseName: exercises[0].name,
            firstExerciseTotalSets: exercises[0].setsData.length,
            totalSetsOverall,
            currentItemType: firstItemType,
        }).then(() => {
            isActiveRef.current = true;
        }).catch((err: Error) => {
            if (__DEV__) console.warn('[LiveActivity] Failed to start:', err.message);
        });

        // Cleanup: stop activity when component unmounts (workout ends)
        return () => {
            if (isActiveRef.current && liveActivityModule) {
                liveActivityModule.stopWorkoutActivity().catch(() => {});
                isActiveRef.current = false;
            }
            if (restTimerRef.current) {
                clearTimeout(restTimerRef.current);
            }
        };
    }, [isSupported, isLoading, exercises.length > 0]); // Only on initial load

    // Update Live Activity when exercises state changes (set completed)
    useEffect(() => {
        if (!isSupported || !liveActivityModule || !isActiveRef.current || exercises.length === 0) {
            return;
        }

        const state = getWorkoutState();
        if (!state) return;

        liveActivityModule.updateWorkoutActivity(state).catch((err: Error) => {
            if (__DEV__) console.warn('[LiveActivity] Failed to update:', err.message);
        });
    }, [exercises, getWorkoutState]);

    // Start rest timer — triggers countdown on Lock Screen
    // STABLE callback: reads getWorkoutState from ref
    const startRestTimer = useCallback((exerciseIndex: number, seconds: number) => {
        if (!isSupported || !liveActivityModule || !isActiveRef.current || seconds <= 0) {
            return;
        }

        // Clear any existing rest timer
        if (restTimerRef.current) {
            clearTimeout(restTimerRef.current);
        }

        const restEnd = Date.now() + seconds * 1000;
        isRestingRef.current = true;
        restEndTimestampRef.current = restEnd;

        // Update Live Activity with rest state
        const state = getWorkoutStateRef.current();
        if (state) {
            liveActivityModule.updateWorkoutActivity({
                ...state,
                isResting: true,
                restEndTimestamp: restEnd,
            }).catch((err: Error) => {
                if (__DEV__) console.warn('[LiveActivity] Failed to update rest:', err.message);
            });
        }

        // Schedule end of rest
        restTimerRef.current = setTimeout(() => {
            isRestingRef.current = false;
            restEndTimestampRef.current = null;

            const updatedState = getWorkoutStateRef.current();
            if (updatedState && liveActivityModule && isActiveRef.current) {
                liveActivityModule.updateWorkoutActivity({
                    ...updatedState,
                    isResting: false,
                    restEndTimestamp: null,
                }).catch((err: Error) => {
                    if (__DEV__) console.warn('[LiveActivity] Failed to clear rest:', err.message);
                });
            }
        }, seconds * 1000);
    }, [isSupported]);

    // Update timer state for warmup/cardio — sends ONE update, iOS counts down natively
    // STABLE callback: reads getWorkoutState from ref to avoid stale closures
    const updateTimerState = useCallback((data: TimerUpdateData) => {
        if (!isSupported || !liveActivityModule || !isActiveRef.current) return;

        timerDataRef.current = data;

        const state = getWorkoutStateRef.current();
        if (!state) return;

        liveActivityModule.updateWorkoutActivity(state).catch((err: Error) => {
            if (__DEV__) console.warn('[LiveActivity] Failed to update timer:', err.message);
        });
    }, [isSupported]);

    // Clear timer state (warmup/cardio completed or paused)
    // STABLE callback: reads getWorkoutState from ref
    const clearTimerState = useCallback(() => {
        if (!isSupported || !liveActivityModule || !isActiveRef.current) return;

        timerDataRef.current = null;

        const state = getWorkoutStateRef.current();
        if (!state) return;

        liveActivityModule.updateWorkoutActivity(state).catch((err: Error) => {
            if (__DEV__) console.warn('[LiveActivity] Failed to clear timer:', err.message);
        });
    }, [isSupported]);

    // Explicitly stop Live Activity (e.g., on workout finish/discard)
    const stopActivity = useCallback(() => {
        if (isActiveRef.current && liveActivityModule) {
            liveActivityModule.stopWorkoutActivity().catch(() => {});
            isActiveRef.current = false;
        }
        if (restTimerRef.current) {
            clearTimeout(restTimerRef.current);
            restTimerRef.current = null;
        }
        timerDataRef.current = null;
    }, []);

    return {
        isSupported,
        isActive: isActiveRef.current,
        startRestTimer,
        updateTimerState,
        clearTimerState,
        stopActivity,
    };
}

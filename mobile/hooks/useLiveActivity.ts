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

interface UseLiveActivityReturn {
    isSupported: boolean;
    isActive: boolean;
    startRestTimer: (exerciseIndex: number, seconds: number) => void;
    stopActivity: () => void;
}

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
        };
    }, [exercises]);

    // Start Live Activity when workout loads
    useEffect(() => {
        if (!isSupported || !liveActivityModule || isLoading || exercises.length === 0 || isActiveRef.current) {
            return;
        }

        const totalSetsOverall = exercises.reduce(
            (sum, ex) => sum + ex.setsData.length,
            0
        );

        liveActivityModule.startWorkoutActivity({
            workoutName,
            workoutId,
            totalExercises: exercises.length,
            studentName,
            workoutStartTimestamp: workoutStartTimestampRef.current,
            firstExerciseName: exercises[0].name,
            firstExerciseTotalSets: exercises[0].setsData.length,
            totalSetsOverall,
        }).then(() => {
            isActiveRef.current = true;
        }).catch((err: Error) => {
            console.warn('[LiveActivity] Failed to start:', err.message);
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
            console.warn('[LiveActivity] Failed to update:', err.message);
        });
    }, [exercises, getWorkoutState]);

    // Start rest timer — triggers countdown on Lock Screen
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
        const state = getWorkoutState();
        if (state) {
            liveActivityModule.updateWorkoutActivity({
                ...state,
                isResting: true,
                restEndTimestamp: restEnd,
            }).catch((err: Error) => {
                console.warn('[LiveActivity] Failed to update rest:', err.message);
            });
        }

        // Schedule end of rest
        restTimerRef.current = setTimeout(() => {
            isRestingRef.current = false;
            restEndTimestampRef.current = null;

            const updatedState = getWorkoutState();
            if (updatedState && liveActivityModule && isActiveRef.current) {
                liveActivityModule.updateWorkoutActivity({
                    ...updatedState,
                    isResting: false,
                    restEndTimestamp: null,
                }).catch((err: Error) => {
                    console.warn('[LiveActivity] Failed to clear rest:', err.message);
                });
            }
        }, seconds * 1000);
    }, [isSupported, getWorkoutState]);

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
    }, []);

    return {
        isSupported,
        isActive: isActiveRef.current,
        startRestTimer,
        stopActivity,
    };
}

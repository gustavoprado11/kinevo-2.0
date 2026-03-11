import { requireNativeModule, Platform } from 'expo-modules-core';

export interface WorkoutActivityParams {
    workoutName: string;
    workoutId: string;
    totalExercises: number;
    studentName: string;
    workoutStartTimestamp: number;
    firstExerciseName: string;
    firstExerciseTotalSets: number;
    totalSetsOverall: number;
    currentItemType?: string;
}

export interface WorkoutActivityState {
    currentExerciseIndex: number;
    currentExerciseName: string;
    setsCompleted: number;
    totalSets: number;
    isResting: boolean;
    restEndTimestamp: number | null;
    totalSetsCompleted: number;
    totalSetsOverall: number;
    workoutStartTimestamp: number;

    // Item type: "exercise" | "warmup" | "cardio"
    currentItemType?: string;

    // Timer fields (warmup & cardio active timers)
    timerEndTimestamp?: number | null;
    timerTotalSeconds?: number | null;

    // Warmup-specific
    warmupType?: string | null;

    // Cardio-specific
    cardioEquipment?: string | null;
    cardioIntensity?: string | null;
    cardioMode?: string | null;       // "continuous" | "interval"
    intervalPhase?: string | null;     // "work" | "rest"
    intervalCurrentRound?: number | null;
    intervalTotalRounds?: number | null;

    // Unique ID per update — forces SwiftUI to recreate timer views
    updateId?: string;
}

// Only require the native module on iOS
const NativeModule = Platform.OS === 'ios'
    ? requireNativeModule('LiveActivityController')
    : null;

export function isLiveActivitySupported(): boolean {
    if (!NativeModule) return false;
    try {
        return NativeModule.isLiveActivitySupported();
    } catch {
        return false;
    }
}

export async function startWorkoutActivity(params: WorkoutActivityParams): Promise<string> {
    if (!NativeModule) return '';
    return NativeModule.startWorkoutActivity(params);
}

export async function updateWorkoutActivity(state: WorkoutActivityState): Promise<void> {
    if (!NativeModule) return;
    return NativeModule.updateWorkoutActivity(state);
}

export async function stopWorkoutActivity(): Promise<void> {
    if (!NativeModule) return;
    return NativeModule.stopWorkoutActivity();
}

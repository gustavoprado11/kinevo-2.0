import { useEffect, useCallback, useRef } from 'react';
import {
  syncWorkoutToWatch,
  addWatchMessageListener,
  isWatchReachable,
  type WatchWorkoutPayload,
  type WatchSetCompletionEvent,
  type WatchStartWorkoutEvent,
} from '../modules/watch-connectivity';

interface UseWatchConnectivityProps {
  onWatchSetComplete?: (event: WatchSetCompletionEvent) => void;
  onWatchStartWorkout?: (event: WatchStartWorkoutEvent) => void;
  onWatchFinishWorkout?: (event: {
    workoutId: string;
    rpe: number;
    startedAt?: string;
    exercises?: Array<{
      id: string;
      sets: Array<{ setIndex: number; reps: number; weight: number; completed: boolean }>;
    }>;
  }) => void;
  onWatchDiscardWorkout?: (event: { workoutId: string }) => void;
}

export function useWatchConnectivity({ onWatchSetComplete, onWatchStartWorkout, onWatchFinishWorkout, onWatchDiscardWorkout }: UseWatchConnectivityProps = {}) {
  // Stable refs — callbacks change every render but the listener stays subscribed once.
  const setCompleteRef = useRef(onWatchSetComplete);
  const startWorkoutRef = useRef(onWatchStartWorkout);
  const finishWorkoutRef = useRef(onWatchFinishWorkout);
  const discardWorkoutRef = useRef(onWatchDiscardWorkout);

  useEffect(() => {
    setCompleteRef.current = onWatchSetComplete;
    startWorkoutRef.current = onWatchStartWorkout;
    finishWorkoutRef.current = onWatchFinishWorkout;
    discardWorkoutRef.current = onWatchDiscardWorkout;
  });

  // Initialize module by checking if watch is reachable (forces module load)
  useEffect(() => {
    try {
      const reachable = isWatchReachable();
      if (__DEV__) console.log('[useWatchConnectivity] Module initialized, watch reachable:', reachable);
    } catch (error) {
      if (__DEV__) console.error('[useWatchConnectivity] Error initializing module:', error);
    }
  }, []);

  // Listen for messages from Apple Watch — subscribed ONCE, refs always point to latest callbacks.
  useEffect(() => {
    if (__DEV__) console.log('[useWatchConnectivity] 📡 Adding watch message listener (stable, once)');
    const subscription = addWatchMessageListener((event) => {
      if (__DEV__) console.log('[useWatchConnectivity] 📥 Received message — type:', event?.type, 'payload keys:', event?.payload ? Object.keys(event.payload).join(', ') : 'NONE');

      if (event.type === 'SET_COMPLETE' && event.payload) {
        const parsed: WatchSetCompletionEvent = {
          workoutId: typeof event.payload.workoutId === 'string' ? event.payload.workoutId : undefined,
          exerciseId: typeof event.payload.exerciseId === 'string' ? event.payload.exerciseId : undefined,
          exerciseIndex: Number(event.payload.exerciseIndex ?? -1),
          setIndex: Number(event.payload.setIndex ?? -1),
          reps: event.payload.reps !== undefined ? Number(event.payload.reps) : undefined,
          weight: event.payload.weight !== undefined ? Number(event.payload.weight) : undefined,
        };

        if (parsed.exerciseIndex < 0 || parsed.setIndex < 0) {
          if (__DEV__) console.warn('[useWatchConnectivity] Ignoring invalid SET_COMPLETE payload:', event.payload);
          return;
        }

        if (__DEV__) console.log(
          `[useWatchConnectivity] Set completed on watch: exercise ${parsed.exerciseIndex}, set ${parsed.setIndex}, reps ${parsed.reps ?? '-'}, weight ${parsed.weight ?? '-'}`
        );
        setCompleteRef.current?.(parsed);
      }

      if (event.type === 'START_WORKOUT' && event.payload) {
        const workoutId = typeof event.payload.workoutId === 'string' ? event.payload.workoutId : null;
        if (!workoutId) {
          if (__DEV__) console.warn('[useWatchConnectivity] Ignoring invalid START_WORKOUT payload:', event.payload);
          return;
        }

        if (__DEV__) console.log(`[useWatchConnectivity] Watch requested START_WORKOUT for ${workoutId}`);
        startWorkoutRef.current?.({ workoutId });
      }

      if (event.type === 'FINISH_WORKOUT' && event.payload) {
        const workoutId = typeof event.payload.workoutId === 'string' ? event.payload.workoutId : null;
        const rpe = Number(event.payload.rpe ?? 0);
        const startedAt = typeof event.payload.startedAt === 'string' ? event.payload.startedAt : undefined;
        const exercises = Array.isArray(event.payload.exercises)
          ? event.payload.exercises.map((ex: any) => ({
              id: String(ex.id ?? ''),
              sets: Array.isArray(ex.sets)
                ? ex.sets.map((s: any) => ({
                    setIndex: Number(s.setIndex ?? 0),
                    reps: Number(s.reps ?? 0),
                    weight: Number(s.weight ?? 0),
                    completed: Boolean(s.completed),
                  }))
                : [],
            }))
          : undefined;

        if (!workoutId) {
          if (__DEV__) console.warn('[useWatchConnectivity] Ignoring invalid FINISH_WORKOUT payload:', event.payload);
          return;
        }

        if (__DEV__) console.log(`[useWatchConnectivity] Watch requested FINISH_WORKOUT for ${workoutId} with rpe ${rpe}, ${exercises?.length ?? 0} exercises`);
        finishWorkoutRef.current?.({ workoutId, rpe, startedAt, exercises });
      }

      if (event.type === 'DISCARD_WORKOUT' && event.payload) {
        const workoutId = typeof event.payload.workoutId === 'string' ? event.payload.workoutId : null;
        if (!workoutId) {
          if (__DEV__) console.warn('[useWatchConnectivity] Ignoring invalid DISCARD_WORKOUT payload:', event.payload);
          return;
        }

        if (__DEV__) console.log(`[useWatchConnectivity] Watch requested DISCARD_WORKOUT for ${workoutId}`);
        discardWorkoutRef.current?.({ workoutId });
      }
    });

    return () => {
      if (__DEV__) console.log('[useWatchConnectivity] 🔌 Removing watch message listener');
      subscription.remove();
    };
  }, []); // empty deps — subscribe once

  // Send workout state to watch
  const sendWorkoutToWatch = useCallback((payload: WatchWorkoutPayload) => {
    try {
      if (__DEV__) console.log('[useWatchConnectivity] Sending workout to watch:', payload);
      syncWorkoutToWatch(payload);
    } catch (error) {
      if (__DEV__) console.error('[useWatchConnectivity] Error sending workout to watch:', error);
    }
  }, []);

  // Check if watch is reachable
  const checkWatchReachable = useCallback(() => {
    return isWatchReachable();
  }, []);

  return {
    sendWorkoutToWatch,
    checkWatchReachable,
  };
}

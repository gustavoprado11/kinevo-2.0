import { useEffect, useCallback } from 'react';
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
  onWatchFinishWorkout?: (event: { workoutId: string; rpe: number }) => void;
}

export function useWatchConnectivity({ onWatchSetComplete, onWatchStartWorkout, onWatchFinishWorkout }: UseWatchConnectivityProps = {}) {
  // Initialize module by checking if watch is reachable (forces module load)
  useEffect(() => {
    try {
      const reachable = isWatchReachable();
      console.log('[useWatchConnectivity] Module initialized, watch reachable:', reachable);
    } catch (error) {
      console.error('[useWatchConnectivity] Error initializing module:', error);
    }
  }, []);

  // Listen for messages from Apple Watch
  useEffect(() => {
    const subscription = addWatchMessageListener((event) => {
      console.log('[useWatchConnectivity] Received message:', event);

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
          console.warn('[useWatchConnectivity] Ignoring invalid SET_COMPLETE payload:', event.payload);
          return;
        }

        console.log(
          `[useWatchConnectivity] Set completed on watch: exercise ${parsed.exerciseIndex}, set ${parsed.setIndex}, reps ${parsed.reps ?? '-'}, weight ${parsed.weight ?? '-'}`
        );
        onWatchSetComplete?.(parsed);
      }

      if (event.type === 'START_WORKOUT' && event.payload) {
        const workoutId = typeof event.payload.workoutId === 'string' ? event.payload.workoutId : null;
        if (!workoutId) {
          console.warn('[useWatchConnectivity] Ignoring invalid START_WORKOUT payload:', event.payload);
          return;
        }

        console.log(`[useWatchConnectivity] Watch requested START_WORKOUT for ${workoutId}`);
        onWatchStartWorkout?.({ workoutId });
      }

      if (event.type === 'FINISH_WORKOUT' && event.payload) {
        const workoutId = typeof event.payload.workoutId === 'string' ? event.payload.workoutId : null;
        const rpe = Number(event.payload.rpe ?? 0);

        if (!workoutId) {
          console.warn('[useWatchConnectivity] Ignoring invalid FINISH_WORKOUT payload:', event.payload);
          return;
        }

        console.log(`[useWatchConnectivity] Watch requested FINISH_WORKOUT for ${workoutId} with rpe ${rpe}`);
        onWatchFinishWorkout?.({ workoutId, rpe });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onWatchSetComplete, onWatchStartWorkout, onWatchFinishWorkout]);

  // Send workout state to watch
  const sendWorkoutToWatch = useCallback((payload: WatchWorkoutPayload) => {
    try {
      console.log('[useWatchConnectivity] Sending workout to watch:', payload);
      syncWorkoutToWatch(payload);
    } catch (error) {
      console.error('[useWatchConnectivity] Error sending workout to watch:', error);
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

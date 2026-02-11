import { useEffect, useCallback } from 'react';
import {
  sendWorkoutState,
  addWatchMessageListener,
  isWatchReachable,
  type WatchWorkoutPayload,
} from '../modules/watch-connectivity';

interface UseWatchConnectivityProps {
  onWatchSetComplete?: (exerciseIndex: number, setIndex: number) => void;
}

export function useWatchConnectivity({ onWatchSetComplete }: UseWatchConnectivityProps = {}) {
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
        const { exerciseIndex, setIndex } = event.payload;
        console.log(`[useWatchConnectivity] Set completed on watch: exercise ${exerciseIndex}, set ${setIndex}`);
        onWatchSetComplete?.(exerciseIndex, setIndex);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onWatchSetComplete]);

  // Send workout state to watch
  const sendWorkoutToWatch = useCallback((payload: WatchWorkoutPayload) => {
    try {
      console.log('[useWatchConnectivity] Sending workout to watch:', payload);
      sendWorkoutState(payload);
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

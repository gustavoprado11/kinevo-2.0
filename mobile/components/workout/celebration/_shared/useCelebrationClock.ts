import { useEffect } from 'react';
import { useSharedValue, withTiming, Easing, type SharedValue } from 'react-native-reanimated';

/**
 * Relógio único da animação: avança de 0 → durationSec (em segundos) UMA vez,
 * linear, e segura no valor final (sem loop). Todos os elementos derivam suas
 * styles via worklet `winW(clock.value, t0, t1)`. Com reduceMotion, salta pro fim.
 */
export function useCelebrationClock(durationSec: number, reduceMotion: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      clock.value = durationSec;
      return;
    }
    clock.value = 0;
    clock.value = withTiming(durationSec, {
      duration: durationSec * 1000,
      easing: Easing.linear,
    });
  }, [durationSec, reduceMotion]);
  return clock;
}

import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { winW, lerpW, type EaseKey } from './easings';

/**
 * Wrapper de "entrada animada" derivada do clock único: opacity + translate/scale
 * computados via worklet `winW(clock, start, end)`. Tudo na UI thread.
 */
export function Reveal({
  clock,
  start,
  end,
  ease = 'outCubic',
  fromY = 0,
  fromX = 0,
  fromScale = 1,
  scaleOrigin,
  style,
  children,
}: {
  clock: SharedValue<number>;
  start: number;
  end: number;
  ease?: EaseKey;
  fromY?: number;
  fromX?: number;
  fromScale?: number;
  scaleOrigin?: ViewStyle['transformOrigin'];
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const animStyle = useAnimatedStyle(() => {
    const p = winW(clock.value, start, end, ease);
    const transform: any[] = [];
    if (fromY !== 0) transform.push({ translateY: lerpW(1 - p, 0, fromY) });
    if (fromX !== 0) transform.push({ translateX: lerpW(1 - p, 0, fromX) });
    if (fromScale !== 1) transform.push({ scale: lerpW(p, fromScale, 1) });
    return { opacity: p, transform };
  });
  return (
    <Animated.View style={[style, scaleOrigin ? { transformOrigin: scaleOrigin } : null, animStyle]}>
      {children}
    </Animated.View>
  );
}

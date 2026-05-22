import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { useCountUp } from './useCountUp';
import { type EaseKey } from './easings';

// Contador isolado: cada número que conta vive aqui (re-render só deste Text).
export function CountText({
  target,
  startMs,
  durMs,
  ease = 'outCubic',
  skip = false,
  format,
  style,
}: {
  target: number;
  startMs: number;
  durMs: number;
  ease?: EaseKey;
  skip?: boolean;
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const v = useCountUp(target, startMs, durMs, ease, skip);
  return <Text style={style}>{format(v)}</Text>;
}

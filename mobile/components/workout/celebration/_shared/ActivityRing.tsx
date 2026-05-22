import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { winW, lerpW } from './easings';
import { CELEB_TOKENS } from './tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RINGS = [
  { r: 80, color: CELEB_TOKENS.ringMove, track: CELEB_TOKENS.ringMoveTrack, t0: 0.4, t1: 2.0 },
  { r: 60, color: CELEB_TOKENS.ringExercise, track: CELEB_TOKENS.ringExerciseTrack, t0: 0.6, t1: 2.1 },
  { r: 40, color: CELEB_TOKENS.ringStand, track: CELEB_TOKENS.ringStandTrack, t0: 0.8, t1: 2.2 },
] as const;
const SW = 14;
const circ = (r: number) => 2 * Math.PI * r;

function Ring({ clock, r, color, track, t0, t1 }: { clock: SharedValue<number>; r: number; color: string; track: string; t0: number; t1: number }) {
  const c = circ(r);
  const props = useAnimatedProps(() => {
    const fill = winW(clock.value, t0, t1, 'outQuart');
    return { strokeDashoffset: c * (1 - fill * 0.96) };
  });
  return (
    <>
      <Circle cx={100} cy={100} r={r} fill="none" stroke={track} strokeWidth={SW} />
      <AnimatedCircle
        cx={100} cy={100} r={r} fill="none" stroke={color} strokeWidth={SW}
        strokeLinecap="round" strokeDasharray={c} animatedProps={props}
        transform="rotate(-90 100 100)"
      />
    </>
  );
}

export function ActivityRing({ clock, size = 200 }: { clock: SharedValue<number>; size?: number }) {
  const checkPx = size * 0.3;
  const checkStyle = useAnimatedStyle(() => ({
    opacity: winW(clock.value, 1.8, 2.2),
    transform: [{ scale: lerpW(winW(clock.value, 1.8, 2.2, 'outBack'), 0.4, 1) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: winW(clock.value, 0, 0.45),
    transform: [{ scale: lerpW(winW(clock.value, 0, 0.5, 'outBack'), 0.7, 1) }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, ringStyle]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {RINGS.map((r, i) => <Ring key={i} clock={clock} {...r} />)}
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
        pointerEvents="none"
      >
        <Animated.View style={checkStyle}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: checkPx, height: checkPx, borderRadius: checkPx / 2,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10,
            }}
          >
            <Check size={checkPx * 0.47} color="#fff" strokeWidth={3.4} />
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

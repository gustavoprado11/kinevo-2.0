// Fase 14c — Skeleton pra ReadinessCard enquanto primeira sync roda.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export function ReadinessCardSkeleton() {
  const shimmer = useSharedValue(0.3);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shimmer]);

  const animStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.label} />
      <View style={styles.scoreRow}>
        <View style={styles.score} />
        <View style={styles.pill} />
      </View>
      <View style={styles.line} />
      <View style={[styles.line, { width: '60%' }]} />
      <View style={styles.statsRow}>
        <View style={styles.stat} />
        <View style={styles.stat} />
        <View style={styles.stat} />
      </View>
    </Animated.View>
  );
}

const SHIMMER = 'rgba(255,255,255,0.08)';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  label: { width: 90, height: 10, backgroundColor: SHIMMER, borderRadius: 4, marginBottom: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  score: { width: 72, height: 56, backgroundColor: SHIMMER, borderRadius: 8 },
  pill: { width: 60, height: 22, backgroundColor: SHIMMER, borderRadius: 10 },
  line: { height: 12, backgroundColor: SHIMMER, borderRadius: 4, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, height: 44, backgroundColor: SHIMMER, borderRadius: 12 },
});

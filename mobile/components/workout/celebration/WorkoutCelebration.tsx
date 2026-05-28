import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getCelebrationVariant } from './_shared/pickVariant';
import { CelebrationFitness } from './CelebrationFitness';
import { CelebrationEditorial } from './CelebrationEditorial';
import { CelebrationReceipt } from './CelebrationReceipt';
import type { CelebrationData } from './types';

export type { CelebrationData } from './types';

interface WorkoutCelebrationProps {
  visible: boolean;
  onComplete: () => void;
  data?: CelebrationData;
  /** CTA primário "Compartilhar conquista". Se ausente, cai no onComplete
   *  (que volta pra home). */
  onShare?: () => void;
}

export function WorkoutCelebration({ visible, onComplete, data, onShare }: WorkoutCelebrationProps) {
  if (!visible || !data) return null;

  const variant = getCelebrationVariant(data.endDate);
  const share = onShare ?? onComplete;
  const props = { data, onComplete, onShare: share };

  return (
    <Animated.View style={styles.overlay} entering={FadeIn.duration(250)}>
      {variant === 'fitness' && <CelebrationFitness {...props} />}
      {variant === 'editorial' && <CelebrationEditorial {...props} />}
      {variant === 'receipt' && <CelebrationReceipt {...props} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});

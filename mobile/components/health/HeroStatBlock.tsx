// Fase 14d — Bloco hero das telas detalhe.
// Gradient roxo dark com glow lateral + hero number gigante + delta + slot extra.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { InsightSeverity } from '@kinevo/shared/types/healthInsights';

export interface HeroStatBlockProps {
  eyebrow: string;
  value: string | number | null;
  unit?: string;
  deltaText?: string | null;
  deltaSeverity?: InsightSeverity;
  /** Slot opcional (ex.: SleepStagesBar) renderizado abaixo do hero. */
  extra?: React.ReactNode;
}

const DELTA_COLOR: Record<InsightSeverity, string> = {
  positive: '#22C55E',
  caution: '#F59E0B',
  neutral: '#A78BFA',
};

export function HeroStatBlock({
  eyebrow,
  value,
  unit,
  deltaText,
  deltaSeverity = 'neutral',
  extra,
}: HeroStatBlockProps) {
  const styles = useMemo(() => createStyles(), []);
  const hasValue = value != null && value !== '';

  return (
    <LinearGradient
      colors={['#1E1B4B', '#312E81']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, !hasValue && styles.valueEmpty]}>{hasValue ? value : '–'}</Text>
        {unit && hasValue && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {deltaText && (
        <View style={[styles.deltaPill, { borderColor: DELTA_COLOR[deltaSeverity] }]}>
          <Text style={[styles.deltaText, { color: DELTA_COLOR[deltaSeverity] }]}>{deltaText}</Text>
        </View>
      )}
      {extra && <View style={styles.extra}>{extra}</View>}
    </LinearGradient>
  );
}

function createStyles() {
  return StyleSheet.create({
    card: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.8,
      color: 'rgba(255,255,255,0.65)',
      marginBottom: 12,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    value: {
      fontSize: 56,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -2,
      lineHeight: 62,
    },
    valueEmpty: {
      color: 'rgba(255,255,255,0.45)',
    },
    unit: {
      fontSize: 18,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
    },
    deltaPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 12,
    },
    deltaText: {
      fontSize: 12,
      fontWeight: '700',
    },
    extra: {
      marginTop: 16,
    },
  });
}

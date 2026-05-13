// Fase 14d — Stat compacto pra grid 3x (Média / Melhor / Pior).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface MiniStatProps {
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string | null;
}

export function MiniStat({ label, value, unit, sub }: MiniStatProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const has = value != null && value !== '';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, !has && styles.valueEmpty]}>{has ? value : '–'}</Text>
        {unit && has && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: c.surface.card,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: c.text.tertiary,
      marginBottom: 6,
    },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    value: {
      fontSize: 18,
      fontWeight: '800',
      color: c.text.primary,
      letterSpacing: -0.3,
    },
    valueEmpty: { color: c.text.quaternary },
    unit: {
      fontSize: 11,
      color: c.text.tertiary,
    },
    sub: {
      fontSize: 10,
      color: c.text.tertiary,
      marginTop: 3,
    },
  });
}

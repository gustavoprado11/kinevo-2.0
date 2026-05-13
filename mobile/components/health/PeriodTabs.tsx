// Fase 14d — Period selector pill (7d / 30d / 90d).
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export type PeriodValue = '7d' | '30d' | '90d';

const PERIOD_LABELS: Record<PeriodValue, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
};

const ALL_PERIODS: PeriodValue[] = ['7d', '30d', '90d'];

export interface PeriodTabsProps {
  value: PeriodValue;
  onChange: (period: PeriodValue) => void;
}

export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {ALL_PERIODS.map((p) => {
        const active = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync().catch(() => {});
                onChange(p);
              }
            }}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: c.surface.canvas,
      borderRadius: 100,
      padding: 3,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 100,
    },
    tabActive: {
      backgroundColor: c.purple[600],
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: c.text.secondary,
    },
    labelActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
}

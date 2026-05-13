import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface SleepWeekChartProps {
  // 7 datapoints, em ordem cronológica (índice 0 = 6 dias atrás, 6 = hoje).
  data: Array<{ date: string; minutes: number | null }>;
}

const BAR_TARGET_MIN = 480; // 8h
const BAR_MIN_HEIGHT = 4;

export function SleepWeekChart({ data }: SleepWeekChartProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const max = Math.max(BAR_TARGET_MIN, ...data.map((d) => d.minutes ?? 0));
  return (
    <View style={styles.card}>
      <Text style={styles.label}>SONO · ÚLTIMOS 7 DIAS</Text>
      <View style={styles.chart}>
        {data.map((d, idx) => {
          const heightPct = d.minutes != null ? (d.minutes / max) * 100 : 0;
          const isLast = idx === data.length - 1;
          return (
            <View key={d.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.max(heightPct, BAR_MIN_HEIGHT)}%`, opacity: d.minutes != null ? 1 : 0.2 },
                    isLast && styles.barLast,
                  ]}
                />
              </View>
              <Text style={[styles.dayLabel, isLast && styles.dayLabelActive]}>
                {dayShortLabel(d.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function dayShortLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  return dias[d.getDay()];
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: c.text.tertiary,
      marginBottom: 14,
    },
    chart: {
      flexDirection: 'row',
      height: 100,
      alignItems: 'flex-end',
      gap: 8,
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barTrack: {
      width: '70%',
      height: 80,
      justifyContent: 'flex-end',
    },
    barFill: {
      width: '100%',
      backgroundColor: '#6366F1', // sleep indigo (semantic — mantém)
      borderRadius: 4,
    },
    barLast: {
      backgroundColor: c.purple[400],
    },
    dayLabel: {
      fontSize: 10,
      color: c.text.tertiary,
      marginTop: 6,
      fontWeight: '600',
    },
    dayLabelActive: {
      color: c.text.primary,
    },
  });
}

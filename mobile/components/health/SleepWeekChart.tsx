import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface SleepWeekChartProps {
  // 7 datapoints, em ordem cronológica (índice 0 = 6 dias atrás, 6 = hoje).
  data: Array<{ date: string; minutes: number | null }>;
}

const BAR_TARGET_MIN = 480; // 8h
const BAR_MIN_HEIGHT = 4;

export function SleepWeekChart({ data }: SleepWeekChartProps) {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.55)',
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
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  barLast: {
    backgroundColor: '#A78BFA',
  },
  dayLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
    fontWeight: '600',
  },
  dayLabelActive: {
    color: '#F1F5F9',
  },
});

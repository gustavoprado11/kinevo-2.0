import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import type { WorkoutHealthSummary } from '../../hooks/useWorkoutHealthSummary';

export interface WorkoutHealthCardProps {
  summary: WorkoutHealthSummary;
  compact?: boolean;
}

const HR_RED = '#EF4444';

export function WorkoutHealthCard({ summary, compact = false }: WorkoutHealthCardProps) {
  const avg = summary.avgHeartRate != null ? Math.round(summary.avgHeartRate) : null;
  const max = summary.maxHeartRate;
  const kcal = summary.caloriesActive != null ? Math.round(summary.caloriesActive) : null;

  // Se todos os hero stats forem null, melhor não renderizar nada.
  if (avg == null && max == null && kcal == null) return null;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.colorStrip} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Heart size={14} color={HR_RED} strokeWidth={2.5} fill={HR_RED} />
          <Text style={styles.label}>SUA SESSÃO · SAÚDE</Text>
        </View>
        <View style={styles.statsRow}>
          <StatBlock value={avg} unit="bpm" caption="HR média" />
          <View style={styles.divider} />
          <StatBlock value={max} unit="bpm" caption="HR máx" />
          <View style={styles.divider} />
          <StatBlock value={kcal} unit="kcal" caption="Ativas" />
        </View>
      </View>
    </View>
  );
}

function StatBlock({ value, unit, caption }: { value: number | null; unit: string; caption: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value != null ? value : '–'}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  cardCompact: {
    marginTop: 12,
  },
  colorStrip: {
    width: 3,
    backgroundColor: HR_RED,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.55)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.6,
  },
  statUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  statCaption: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'center',
  },
});

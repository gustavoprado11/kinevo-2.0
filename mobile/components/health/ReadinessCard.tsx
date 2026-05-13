import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, Heart, Zap } from 'lucide-react-native';
import type { ReadinessResult } from '../../lib/readiness';

export interface ReadinessCardProps {
  result: ReadinessResult;
  recommendation: string;
  hrToday?: number | null;
  hrv?: number | null;
  onPress?: () => void;
}

const CATEGORY_LABEL: Record<ReadinessResult['category'], string> = {
  otimo: 'Ótimo',
  bom: 'Bom',
  regular: 'Regular',
  reduzido: 'Reduzido',
};

const CATEGORY_COLOR: Record<ReadinessResult['category'], string> = {
  otimo: '#22C55E',
  bom: '#6366F1',
  regular: '#F59E0B',
  reduzido: '#EF4444',
};

function formatSleep(min: number | null | undefined): string {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function ReadinessCard({ result, recommendation, hrToday, hrv, onPress }: ReadinessCardProps) {
  const categoryColor = CATEGORY_COLOR[result.category];

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={['#1E1B4B', '#312E81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Text style={styles.label}>PRONTIDÃO HOJE</Text>

        <View style={styles.scoreRow}>
          <Text style={styles.score}>{result.score}</Text>
          <View style={[styles.categoryPill, { backgroundColor: `${categoryColor}28`, borderColor: categoryColor }]}>
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {CATEGORY_LABEL[result.category]}
            </Text>
          </View>
        </View>

        <Text style={styles.recommendation}>{recommendation}</Text>

        <View style={styles.statsRow}>
          <StatPill icon={Moon} label="Sono" value={formatSleep(result.sleepMinutesUsed)} />
          <View style={styles.statDivider} />
          <StatPill icon={Heart} label="HR" value={hrToday != null ? `${hrToday}bpm` : '–'} />
          <View style={styles.statDivider} />
          <StatPill icon={Zap} label="HRV" value={hrv != null ? `${Math.round(hrv)}ms` : '–'} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Icon size={12} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  score: {
    fontSize: 56,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -2,
    lineHeight: 60,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  recommendation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

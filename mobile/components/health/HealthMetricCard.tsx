import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface HealthMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string | null;
  color: string;
  trend?: 'up' | 'down' | 'flat' | null;
}

export function HealthMetricCard({ icon: Icon, label, value, unit, sub, color, trend }: HealthMetricCardProps) {
  const hasValue = value != null && value !== '';

  return (
    <View style={styles.card}>
      <View style={[styles.colorStrip, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Icon size={14} color={color} strokeWidth={2.5} />
          <Text style={styles.label}>{label.toUpperCase()}</Text>
        </View>
        {hasValue ? (
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </View>
        ) : (
          <Text style={styles.empty}>–</Text>
        )}
        {sub && <Text style={styles.sub}>{sub}</Text>}
        {trend && (
          <View style={[styles.trendPill, trend === 'up' ? styles.trendUp : trend === 'down' ? styles.trendDown : styles.trendFlat]}>
            <Text style={styles.trendText}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 120,
  },
  colorStrip: {
    width: 3,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.55)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.6,
  },
  unit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  empty: {
    fontSize: 26,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: -0.6,
  },
  sub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 6,
  },
  trendPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trendUp: { backgroundColor: 'rgba(34,197,94,0.15)' },
  trendDown: { backgroundColor: 'rgba(239,68,68,0.15)' },
  trendFlat: { backgroundColor: 'rgba(255,255,255,0.06)' },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F1F5F9',
  },
});

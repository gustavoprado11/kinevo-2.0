import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

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
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    card: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: c.surface.card,
      borderRadius: 16,
      overflow: 'hidden',
      minHeight: 120,
    },
    colorStrip: { width: 3 },
    body: { flex: 1, padding: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: c.text.tertiary },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    value: { fontSize: 26, fontWeight: '800', color: c.text.primary, letterSpacing: -0.6 },
    unit: { fontSize: 12, color: c.text.tertiary },
    empty: { fontSize: 26, fontWeight: '800', color: c.text.quaternary, letterSpacing: -0.6 },
    sub: { fontSize: 11, color: c.text.tertiary, marginTop: 6 },
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
    trendFlat: { backgroundColor: c.border.subtle },
    trendText: { fontSize: 11, fontWeight: '700', color: c.text.primary },
  });
}

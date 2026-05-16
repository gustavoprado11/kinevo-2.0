import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface HealthMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string | null;
  color: string;
  trend?: 'up' | 'down' | 'flat' | null;
  /** Fase 14d — quando definido, card vira Pressable e mostra chevron. */
  onPress?: () => void;
  /**
   * Largura fixa em dp. OBRIGATÓRIO quando renderizado dentro de uma
   * grid de 2 colunas (ex.: tab Saúde). Calculado pelo parent via
   * useWindowDimensions/onLayout, evitando flex:1/width:'100%' que
   * colapsam no measure-pass do Pressable iOS (bug recorrente desde
   * 1.6.0/33 — ver histórico do componente).
   */
  cardWidth: number;
}

export function HealthMetricCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  color,
  trend,
  onPress,
  cardWidth,
}: HealthMetricCardProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasValue = value != null && value !== '';

  // Largura aplicada inline em vez de via StyleSheet porque depende de
  // prop dinâmica. Aplicada tanto no Pressable quanto no card pra blindar
  // contra o measure-pass quirky do Pressable iOS.
  const widthStyle = { width: cardWidth };

  const inner = (
    <View style={[styles.card, widthStyle]}>
      <View style={[styles.colorStrip, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Icon size={14} color={color} strokeWidth={2.5} />
          <Text style={styles.label} numberOfLines={1}>{label.toUpperCase()}</Text>
        </View>
        {hasValue ? (
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </View>
        ) : (
          <Text style={styles.empty}>–</Text>
        )}
        {sub && <Text style={styles.sub} numberOfLines={2}>{sub}</Text>}
        {trend && (
          <View style={[styles.trendPill, trend === 'up' ? styles.trendUp : trend === 'down' ? styles.trendDown : styles.trendFlat]}>
            <Text style={styles.trendText}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </Text>
          </View>
        )}
        {onPress && (
          <View style={styles.chevron}>
            <ChevronRight size={16} color={colors.text.tertiary} strokeWidth={2.5} />
          </View>
        )}
      </View>
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [widthStyle, pressed && styles.pressed]}
      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
    >
      {inner}
    </Pressable>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    // Largura é injetada via prop cardWidth (inline). Não usar flex:1 nem
    // width:'100%' aqui — ambos falham no measure-pass do Pressable iOS.
    card: {
      flexDirection: 'row',
      backgroundColor: c.surface.card,
      borderRadius: 16,
      overflow: 'hidden',
      minHeight: 120,
    },
    pressed: { opacity: 0.85 },
    colorStrip: { width: 3 },
    body: { flex: 1, padding: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: c.text.tertiary, flexShrink: 1 },
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
    chevron: {
      position: 'absolute',
      bottom: 10,
      right: 10,
    },
  });
}

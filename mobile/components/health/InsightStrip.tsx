// Fase 14d — Versão compacta de um único insight, pra mostrar dentro de
// detalhe (logo abaixo do HeroStatBlock).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { parseBold } from './InsightsCard';
import type { HealthInsight, InsightSeverity } from '@kinevo/shared/types/healthInsights';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface InsightStripProps {
  insight: HealthInsight;
}

const SEVERITY_BG: Record<InsightSeverity, string> = {
  positive: 'rgba(34,197,94,0.10)',
  caution: 'rgba(245,158,11,0.10)',
  neutral: 'rgba(167,139,250,0.10)',
};

const SEVERITY_FG: Record<InsightSeverity, string> = {
  positive: '#22C55E',
  caution: '#F59E0B',
  neutral: '#A78BFA',
};

export function InsightStrip({ insight }: InsightStripProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const parts = parseBold(insight.text);

  return (
    <View style={[styles.strip, { backgroundColor: SEVERITY_BG[insight.severity] }]}>
      <View style={[styles.stripBar, { backgroundColor: SEVERITY_FG[insight.severity] }]} />
      <Text style={styles.emoji}>{insight.emoji}</Text>
      <Text style={styles.text}>
        {parts.map((part, i) =>
          part.bold ? (
            <Text key={i} style={[styles.bold, { color: SEVERITY_FG[insight.severity] }]}>
              {part.text}
            </Text>
          ) : (
            <Text key={i}>{part.text}</Text>
          ),
        )}
      </Text>
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    stripBar: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
    },
    emoji: {
      fontSize: 16,
    },
    text: {
      flex: 1,
      fontSize: 13,
      color: c.text.primary,
      lineHeight: 18,
    },
    bold: {
      fontWeight: '700',
    },
  });
}

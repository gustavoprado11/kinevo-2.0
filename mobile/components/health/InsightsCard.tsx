// Fase 14d — Card no topo da Tab Saúde com até 3 insights heurísticos.
// Pattern visual: gradient roxo dark (igual ReadinessCard). Texto com
// marcação **negrito** parseada inline.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { HealthInsight, InsightSeverity } from '@kinevo/shared/types/healthInsights';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';
import { useBrand } from '../../stores/brandStore';
import { mix } from '../../lib/brandColor';

export interface InsightsCardProps {
  insights: HealthInsight[];
}

// Cores semânticas: positive/caution permanecem fixas; neutral acompanha a
// marca do coach (insight informativo = cor do estúdio).
const STATIC_SEVERITY = {
  positive: '#22C55E',
  caution: '#F59E0B',
} as const;

export function InsightsCard({ insights }: InsightsCardProps) {
  const colors = useV2Colors();
  const brand = useBrand();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const severityColor = (sev: InsightSeverity): string =>
    sev === 'positive' ? STATIC_SEVERITY.positive
      : sev === 'caution' ? STATIC_SEVERITY.caution
        : mix(brand.color, '#FFFFFF', 0.30);

  if (insights.length === 0) return null;

  return (
    <LinearGradient
      colors={['#18181B', brand.deep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>INSIGHTS DA SEMANA</Text>
      {insights.map((insight, idx) => (
        <View key={`${insight.rule}-${idx}`}>
          {idx > 0 && <View style={styles.divider} />}
          <View style={styles.row}>
            <View style={[styles.severityDot, { backgroundColor: severityColor(insight.severity) }]} />
            <View style={styles.body}>
              <Text style={styles.emoji}>{insight.emoji}</Text>
              <RichText text={insight.text} />
            </View>
          </View>
        </View>
      ))}
    </LinearGradient>
  );
}

// ─── Renderer de markdown-like inline (`**negrito**`) ───
function RichText({ text }: { text: string }) {
  const parts = useMemo(() => parseBold(text), [text]);
  return (
    <Text style={richStyles.base}>
      {parts.map((part, i) =>
        part.bold ? (
          <Text key={i} style={richStyles.bold}>
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

export function parseBold(text: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }
  return parts;
}

const richStyles = StyleSheet.create({
  base: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 20,
    flex: 1,
  },
  bold: { fontWeight: '800', color: '#FFFFFF' },
});

function createStyles(_c: V2Palette) {
  return StyleSheet.create({
    card: {
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.6,
      color: 'rgba(255,255,255,0.65)',
      marginBottom: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    severityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 8,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    emoji: {
      fontSize: 16,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginVertical: 12,
    },
  });
}

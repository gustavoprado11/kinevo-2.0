// Fase 14d — Card de educação inline. Texto sempre expandido nesta versão.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { parseBold } from './InsightsCard';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface EduCardProps {
  title: string;
  body: string;
  idealRange?: string;
}

export function EduCard({ title, body, idealRange }: EduCardProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const parts = parseBold(body);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <BookOpen size={14} color={colors.purple[400]} strokeWidth={2.5} />
        <Text style={styles.label}>EDUCAÇÃO</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>
        {parts.map((part, i) =>
          part.bold ? (
            <Text key={i} style={styles.bold}>
              {part.text}
            </Text>
          ) : (
            <Text key={i}>{part.text}</Text>
          ),
        )}
      </Text>
      {idealRange && (
        <View style={styles.idealRow}>
          <Text style={styles.idealLabel}>FAIXA IDEAL</Text>
          <Text style={styles.idealValue}>{idealRange}</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface.card2,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: c.purple[400],
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text.primary,
      marginBottom: 8,
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 13,
      color: c.text.secondary,
      lineHeight: 19,
    },
    bold: {
      fontWeight: '700',
      color: c.text.primary,
    },
    idealRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border.subtle,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    idealLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: c.text.tertiary,
    },
    idealValue: {
      fontSize: 12,
      fontWeight: '600',
      color: c.text.primary,
    },
  });
}

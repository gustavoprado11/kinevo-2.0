// Fase 14c (refinado v2) — Card promotional pra Home quando aluno sem conexão.
// Pattern V2 horizontal (espelha WorkoutHealthCard da Fase 13): color strip
// lateral 3pt roxo + body flex 1 + CTA pill compacto à direita.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface HealthPromotionalCardProps {
  onConnect: () => void;
}

export function HealthPromotionalCard({ onConnect }: HealthPromotionalCardProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable onPress={onConnect} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.colorStrip} />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Heart size={22} color={colors.purple[500]} strokeWidth={2.5} />
        </View>
        <View style={styles.text}>
          <Text style={styles.label}>CONECTE SUA SAÚDE</Text>
          <Text style={styles.sub}>Sono, FC e recuperação</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Conectar</Text>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: c.surface.card,
      borderRadius: 16,
      marginBottom: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border.default,
    },
    cardPressed: { opacity: 0.92 },
    colorStrip: {
      width: 3,
      backgroundColor: c.purple[500],
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(124,58,237,0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      flex: 1,
      justifyContent: 'center',
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      color: c.purple[600],
    },
    sub: {
      fontSize: 13,
      fontWeight: '500',
      color: c.text.secondary,
      marginTop: 3,
    },
    cta: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 100,
      backgroundColor: c.purple[600],
    },
    ctaText: {
      fontSize: 13,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
}

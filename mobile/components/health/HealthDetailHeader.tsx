// Fase 14d — Header das telas detalhe: back + título + sublinha de período.
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface HealthDetailHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export function HealthDetailHeader({ title, subtitle, onBack }: HealthDetailHeaderProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onBack();
        }}
        hitSlop={12}
        style={styles.backBtn}
      >
        <ChevronLeft size={26} color={colors.text.primary} strokeWidth={2} />
      </Pressable>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {/* Spacer pra equilibrar layout (mesma width do backBtn) */}
      <View style={styles.spacer} />
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 16,
    },
    backBtn: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    titleWrap: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text.primary,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 11,
      color: c.text.tertiary,
      marginTop: 1,
    },
    spacer: { width: 36 },
  });
}

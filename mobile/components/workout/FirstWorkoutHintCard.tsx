import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CheckCircle2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

interface FirstWorkoutHintCardProps {
  onDismiss: () => void;
}

// Hint contextual do primeiro treino — aparece UMA vez, some pra sempre ao ser
// dispensado ou quando a primeira série é concluída (o aluno demonstrou que
// entendeu; gate em students.onboarding_state.first_workout_hint_seen).
// Banner inline, nunca overlay: não bloqueia nada.
export function FirstWorkoutHintCard({ onDismiss }: FirstWorkoutHintCardProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDismiss();
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <CheckCircle2 size={18} color={colors.purple[400]} strokeWidth={2.5} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Seu primeiro treino</Text>
        <Text style={styles.desc}>
          Toque no círculo da série pra marcar como feita — o descanso começa sozinho.
        </Text>
      </View>
      <Pressable onPress={handleDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dispensar dica">
        <X size={16} color={colors.text.tertiary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginTop: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: c.surface.card,
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface.card2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textWrap: { flex: 1 },
    title: { fontSize: 13, fontWeight: '700', color: c.text.primary, marginBottom: 1 },
    desc: { fontSize: 12, color: c.text.secondary, lineHeight: 17 },
  });
}

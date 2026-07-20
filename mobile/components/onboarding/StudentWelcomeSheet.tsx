import React, { useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, CheckCircle2, MessageCircle, TrendingUp, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface StudentWelcomeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Nome completo do aluno — o sheet usa só o primeiro nome. */
  studentName: string;
  /** Nome de exibição do coach (brand_name quando houver branding, senão name). */
  coachName: string | null;
}

// Boas-vindas do aluno recém-convidado — mostrado UMA vez (students.onboarding_state.
// welcome_seen via mark_student_onboarding; cache MMKV em lib/studentOnboarding).
// Mesmo padrão visual do HealthOnboardingSheet: Modal pageSheet, hero em gradiente,
// bullets com Lucide. Fechar por X ou CTA marca visto — nunca reaparece.
export function StudentWelcomeSheet({ visible, onClose, studentName, coachName }: StudentWelcomeSheetProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const firstName = studentName.trim().split(' ')[0] || 'atleta';
  const coachLabel = coachName?.trim() || 'Seu treinador';

  const bullets = [
    {
      icon: Dumbbell,
      title: 'Seus treinos ficam na tela inicial',
      desc: 'Toque no treino do dia pra começar a sessão.',
    },
    {
      icon: CheckCircle2,
      title: 'Marque cada série concluída',
      desc: 'O descanso começa sozinho entre as séries.',
    },
    {
      icon: MessageCircle,
      title: 'Fale direto com quem te treina',
      desc: 'Dúvidas e ajustes pela aba Mensagens.',
    },
    {
      icon: TrendingUp,
      title: 'Progresso salvo automaticamente',
      desc: 'Cargas e histórico de todas as sessões, sem anotar nada.',
    },
  ];

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <X size={22} color={colors.text.tertiary} strokeWidth={2.5} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroIconWrap}>
            <LinearGradient
              colors={[colors.purple[600], colors.purple[400]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIcon}
            >
              <Dumbbell size={28} color="#FFF" strokeWidth={2.5} />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Bem-vindo, {firstName}</Text>

          <Text style={styles.body}>
            {coachLabel} preparou este espaço pra acompanhar seu treino de perto. Em quatro pontos, é assim que funciona:
          </Text>

          {bullets.map(({ icon: Icon, title, desc }) => (
            <View key={title} style={styles.bulletRow}>
              <View style={styles.bulletIconWrap}>
                <Icon size={18} color={colors.purple[400]} strokeWidth={2.5} />
              </View>
              <View style={styles.bulletTextWrap}>
                <Text style={styles.bulletTitle}>{title}</Text>
                <Text style={styles.bulletDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={handleClose}>
            <LinearGradient
              colors={[colors.purple[600], colors.purple[400]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaPrimary}
            >
              <Text style={styles.ctaPrimaryText}>Vamos treinar</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface.canvas },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    scroll: { paddingHorizontal: 24, paddingBottom: 24 },
    heroIconWrap: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.text.primary,
      letterSpacing: -0.6,
      textAlign: 'center',
      marginBottom: 14,
    },
    body: {
      fontSize: 15,
      color: c.text.secondary,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 28,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      paddingVertical: 10,
    },
    bulletIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border.subtle,
    },
    bulletTextWrap: { flex: 1 },
    bulletTitle: { fontSize: 14, color: c.text.primary, fontWeight: '600', marginBottom: 2 },
    bulletDesc: { fontSize: 13, color: c.text.secondary, lineHeight: 19 },
    actions: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: c.border.subtle,
    },
    ctaPrimary: {
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    ctaPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  });
}

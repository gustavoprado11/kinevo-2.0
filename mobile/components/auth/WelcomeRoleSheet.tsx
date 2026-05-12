import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, Users, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface WelcomeRoleSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function WelcomeRoleSheet({ visible, onClose }: WelcomeRoleSheetProps) {
  const handleAluno = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
  }, [onClose]);

  const handleTrainer = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.kinevoapp.com';
    Linking.openURL(`${webUrl}/signup?ref=mobile`).catch(() => {});
    onClose();
  }, [onClose]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={handleDismiss}
        accessibilityLabel="Como o Kinevo funciona"
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>BEM-VINDO AO KINEVO</Text>
          <Text style={styles.title}>Como funciona?</Text>
          <Text style={styles.body}>
            O Kinevo conecta alunos e treinadores em uma plataforma única. Escolha como você usa.
          </Text>

          <View style={styles.options}>
            {/* Card Sou aluno (primary) */}
            <Pressable
              onPress={handleAluno}
              accessibilityRole="button"
              accessibilityLabel="Sou aluno: peça convite ao seu personal trainer"
              style={({ pressed }) => [styles.optionPrimary, pressed && styles.optionPressed]}
            >
              <LinearGradient
                colors={['rgba(124,58,237,0.22)', 'rgba(167,139,250,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.optionContent}>
                <LinearGradient
                  colors={['#7C3AED', '#A78BFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconTile}
                >
                  <GraduationCap size={20} color="#fff" strokeWidth={2.2} />
                </LinearGradient>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Sou aluno</Text>
                  <Text style={styles.optionDesc}>
                    Peça um convite pro seu personal trainer pra começar.
                  </Text>
                </View>
                <ChevronRight size={18} color="#71717A" />
              </View>
            </Pressable>

            {/* Card Sou treinador (secondary glass) */}
            <Pressable
              onPress={handleTrainer}
              accessibilityRole="button"
              accessibilityLabel="Sou treinador: criar conta no navegador"
              style={({ pressed }) => [styles.optionSecondary, pressed && styles.optionPressed]}
            >
              <View style={styles.optionContent}>
                <LinearGradient
                  colors={['#F472B6', '#C4B5FD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconTile}
                >
                  <Users size={20} color="#fff" strokeWidth={2.2} />
                </LinearGradient>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Sou treinador</Text>
                  <Text style={styles.optionDesc}>
                    Crie conta gratuita em kinevo.app pra gerenciar alunos.
                  </Text>
                </View>
                <ChevronRight size={18} color="#71717A" />
              </View>
            </Pressable>
          </View>

          <Pressable onPress={handleDismiss} accessibilityRole="button" accessibilityLabel="Fechar">
            <Text style={styles.dismiss}>Fechar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(24,24,27,0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
    paddingHorizontal: 22,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -24 },
    shadowOpacity: 0.4,
    shadowRadius: 48,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 100,
    backgroundColor: '#52525B',
    alignSelf: 'center',
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#C4B5FD',
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.44,
    color: '#FAFAFA',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 25,
  },
  body: {
    fontSize: 13,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  options: {
    gap: 10,
    marginBottom: 16,
  },
  optionPrimary: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    overflow: 'hidden',
  },
  optionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.14,
    color: '#FAFAFA',
    marginBottom: 3,
  },
  optionDesc: {
    fontSize: 11.5,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  dismiss: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
    textAlign: 'center',
    padding: 4,
  },
});

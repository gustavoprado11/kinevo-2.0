import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Moon, Footprints, Zap, X } from 'lucide-react-native';
import { useHealthKitSync } from '../../hooks/useHealthKitSync';
import { useHealthConnectSync } from '../../hooks/useHealthConnectSync';
import { markHealthOnboardingSeen } from '../../lib/healthOnboardingFlag';

const PLAY_STORE_HEALTH_CONNECT = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const isIOS = Platform.OS === 'ios';
const SOURCE_NAME = isIOS ? 'Apple Saúde' : 'Google Health Connect';

export interface HealthOnboardingSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Texto exato do SPEC master §9 — não improvisar.
const BULLETS = [
  { icon: Heart, label: 'Frequência cardíaca de repouso' },
  { icon: Moon, label: 'Duração e qualidade do seu sono' },
  { icon: Footprints, label: 'Passos e atividade diária' },
  { icon: Zap, label: 'Variabilidade da frequência cardíaca (HRV)' },
];

export function HealthOnboardingSheet({ visible, onClose }: HealthOnboardingSheetProps) {
  const hk = useHealthKitSync();
  const hc = useHealthConnectSync();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (isIOS) {
        const ok = await hk.requestAuthorization();
        markHealthOnboardingSeen();
        if (ok) void hk.syncHistorical(30);
        onClose();
        return;
      }

      // Android: checar SDK antes de pedir permissão
      const status = await hc.refreshSdkStatus();
      if (status === 'unavailable') {
        Alert.alert(
          'Health Connect não encontrado',
          'Pra ver seus dados de saúde, instale o app Health Connect do Google. Você pode conectar depois pelos Ajustes.',
          [
            { text: 'Mais tarde', style: 'cancel', onPress: () => { markHealthOnboardingSeen(); onClose(); } },
            { text: 'Abrir Play Store', onPress: () => { markHealthOnboardingSeen(); Linking.openURL(PLAY_STORE_HEALTH_CONNECT); onClose(); } },
          ],
        );
        return;
      }
      if (status === 'update_required') {
        Alert.alert(
          'Atualize o Health Connect',
          'Pra continuar, atualize o app Health Connect na Play Store. Você pode conectar depois pelos Ajustes.',
          [
            { text: 'Mais tarde', style: 'cancel', onPress: () => { markHealthOnboardingSeen(); onClose(); } },
            { text: 'Abrir Play Store', onPress: () => { markHealthOnboardingSeen(); Linking.openURL(PLAY_STORE_HEALTH_CONNECT); onClose(); } },
          ],
        );
        return;
      }
      const ok = await hc.requestAuthorization();
      markHealthOnboardingSeen();
      if (ok) void hc.syncHistorical(30);
      onClose();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLater = () => {
    markHealthOnboardingSeen();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleLater}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleLater} hitSlop={12}>
            <X size={22} color="rgba(255,255,255,0.55)" strokeWidth={2.5} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroIconWrap}>
            <LinearGradient colors={['#7c3aed', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
              <Heart size={28} color="#FFF" strokeWidth={2.5} fill="#FFF" />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Veja sua saúde no Kinevo</Text>

          <Text style={styles.body}>
            O Kinevo pode ler dados do seu {SOURCE_NAME} pra mostrar sua recuperação, sono e atividade — e te ajudar a treinar melhor.
          </Text>

          <Text style={styles.sectionLabel}>VAMOS IMPORTAR</Text>
          {BULLETS.map(({ icon: Icon, label }) => (
            <View key={label} style={styles.bulletRow}>
              <Icon size={18} color="#A78BFA" strokeWidth={2.5} />
              <Text style={styles.bulletText}>{label}</Text>
            </View>
          ))}

          <Text style={styles.sectionLabel}>VOCÊ CONTROLA</Text>
          <Text style={styles.subText}>
            • Pode desligar qualquer categoria nos Ajustes{'\n'}
            • Pode desconectar completamente a qualquer momento{'\n'}
            • Seu coach NÃO vê esses dados sem você ativar o compartilhamento separado (em breve)
          </Text>

          <Text style={styles.sectionLabel}>PROMESSA DO KINEVO</Text>
          <Text style={styles.subText}>
            • Não vendemos seus dados{'\n'}
            • Não compartilhamos com terceiros (anúncios, seguradoras){'\n'}
            • Mesmo dentro do Kinevo, só você vê
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={handleConnect} disabled={isConnecting}>
            <LinearGradient colors={['#7c3aed', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimary}>
              {isConnecting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.ctaPrimaryText}>Conectar e ver minha saúde</Text>
              )}
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleLater} style={styles.ctaSecondary}>
            <Text style={styles.ctaSecondaryText}>Mais tarde</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D17' },
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
    color: '#F1F5F9',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 20,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  bulletText: { fontSize: 14, color: '#F1F5F9', fontWeight: '500' },
  subText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  actions: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  ctaPrimary: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  ctaSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    fontSize: 14,
  },
});

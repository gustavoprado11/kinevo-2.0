// Fase 14c — Card promotional pra Home quando aluno sem conexão de saúde ativa.
// Tap → reabre HealthOnboardingSheet.
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Heart, ArrowRight } from 'lucide-react-native';

export interface HealthPromotionalCardProps {
  onConnect: () => void;
}

export function HealthPromotionalCard({ onConnect }: HealthPromotionalCardProps) {
  return (
    <Pressable onPress={onConnect} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.iconWrap}>
        <Heart size={20} color="#EF4444" strokeWidth={2.5} fill="#EF4444" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Conecte sua saúde</Text>
        <Text style={styles.sub}>Veja sono, FC e recuperação no Kinevo</Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Conectar</Text>
        <ArrowRight size={14} color="#A78BFA" strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  cardPressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  ctaText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '700',
  },
});

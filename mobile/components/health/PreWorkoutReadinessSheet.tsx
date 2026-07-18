// Fase 14c — Pré-treino Readiness Sheet.
// Sobe quando aluno tap "Iniciar treino" SE há readinessData.
// 4 variações de categoria (otimo/bom/regular/reduzido) com gradient + recommendation.
import React, { useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Moon, Heart, Zap } from 'lucide-react-native';
import type { ReadinessResult, ReadinessCategory } from '../../lib/readiness';
import { getReadinessRecommendation } from '../../lib/readiness';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

export interface PreWorkoutReadinessSheetProps {
  visible: boolean;
  readiness: ReadinessResult;
  hrToday?: number | null;
  hrv?: number | null;
  onProceed: () => void;
  onReschedule: () => void;
  onDismiss: () => void;
}

const CATEGORY_LABEL: Record<ReadinessCategory, string> = {
  otimo: 'Ótimo',
  bom: 'Bom',
  regular: 'Regular',
  reduzido: 'Reduzido',
};

const CATEGORY_COLOR: Record<ReadinessCategory, string> = {
  otimo: '#22C55E',
  bom: '#6366F1',
  regular: '#F59E0B',
  reduzido: '#EF4444',
};

const CATEGORY_GRADIENT: Record<ReadinessCategory, [string, string]> = {
  otimo: ['#6D28D9', '#22C55E'],
  bom: ['#6D28D9', '#A78BFA'],
  regular: ['#6D28D9', '#F59E0B'],
  reduzido: ['#6D28D9', '#EF4444'],
};

// CTA positivo e coerente com a nota — nunca "mesmo assim" (enquadramento
// negativo que aparecia até com readiness bom). Quem abriu o treino quer começar.
const CATEGORY_CTA: Record<ReadinessCategory, string> = {
  otimo: 'Bora treinar',
  bom: 'Começar treino',
  regular: 'Começar treino',
  reduzido: 'Começar treino',
};

function formatSleep(min: number | null | undefined): string {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function PreWorkoutReadinessSheet({
  visible,
  readiness,
  hrToday,
  hrv,
  onProceed,
  onReschedule,
  onDismiss,
}: PreWorkoutReadinessSheetProps) {
  const colors = useV2Colors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const categoryColor = CATEGORY_COLOR[readiness.category];
  // O 1º stop dos gradients de categoria é a marca do estúdio → rebrand via
  // colors.purple[600]; o 2º stop é semântico por categoria (mantido).
  const baseGradient = CATEGORY_GRADIENT[readiness.category];
  const gradient: [string, string] = [colors.purple[600], baseGradient[1]];
  const recommendation = getReadinessRecommendation(readiness);
  const ctaLabel = CATEGORY_CTA[readiness.category];
  // Card de orientação só aparece quando há ajuste acionável (recuperação
  // parcial/baixa). Em ótimo/bom não há "sugestão" — o score já diz tudo.
  const showSuggestion =
    readiness.category === 'regular' || readiness.category === 'reduzido';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <View style={styles.handle} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.eyebrow}>ANTES DE COMEÇAR</Text>
              <Text style={styles.title}>Como você está hoje?</Text>

              <View style={styles.scoreWrap}>
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.scoreGradient}
                >
                  <Text style={styles.scoreText}>{readiness.score}</Text>
                </LinearGradient>
                <View style={[styles.categoryPill, { backgroundColor: `${categoryColor}28`, borderColor: categoryColor }]}>
                  <Text style={[styles.categoryText, { color: categoryColor }]}>
                    {CATEGORY_LABEL[readiness.category]}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Moon size={14} color={colors.text.tertiary} strokeWidth={2.5} />
                  <Text style={styles.statValue}>{formatSleep(readiness.sleepMinutesUsed)}</Text>
                  <Text style={styles.statLabel}>SONO</Text>
                </View>
                <View style={styles.statItem}>
                  <Heart size={14} color={colors.text.tertiary} strokeWidth={2.5} />
                  <Text style={styles.statValue}>{hrToday != null ? `${hrToday}` : '–'}</Text>
                  <Text style={styles.statLabel}>HR</Text>
                </View>
                <View style={styles.statItem}>
                  <Zap size={14} color={colors.text.tertiary} strokeWidth={2.5} />
                  <Text style={styles.statValue}>{hrv != null ? `${Math.round(hrv)}` : '–'}</Text>
                  <Text style={styles.statLabel}>HRV</Text>
                </View>
              </View>

              {showSuggestion && (
                <View style={styles.recommendationCard}>
                  <Text style={styles.recommendationLabel}>COMO TREINAR HOJE</Text>
                  <Text style={styles.recommendationText}>{recommendation}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <Pressable onPress={onProceed}>
                <LinearGradient
                  colors={[colors.purple[600], '#A78BFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaPrimary}
                >
                  <Text style={styles.ctaPrimaryText}>{ctaLabel}</Text>
                  <ArrowRight size={18} color="#FFF" strokeWidth={2.5} />
                </LinearGradient>
              </Pressable>
              <Pressable onPress={onReschedule} style={styles.ctaSecondary}>
                <Text style={styles.ctaSecondaryText}>Agora não</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(c: V2Palette) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: c.text.quaternary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  scroll: {
    padding: 24,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: c.text.tertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: c.text.primary,
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  scoreWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreGradient: {
    paddingHorizontal: 24,
    paddingVertical: 4,
    borderRadius: 24,
  },
  scoreText: {
    fontSize: 80,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -3,
    lineHeight: 88,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 14,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.surface.card,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: c.text.primary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: c.text.tertiary,
  },
  recommendationCard: {
    backgroundColor: c.surface.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  recommendationLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: c.text.tertiary,
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: c.text.primary,
    lineHeight: 20,
  },
  actions: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: c.border.subtle,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  ctaSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: c.text.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  });
}

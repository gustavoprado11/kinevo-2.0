// Card compacto de Prontidão — vive logo abaixo do herói de treino na Home,
// "conectando" a recuperação ao treino do dia. Variante C: medidor semicircular
// + recomendação + métricas. Mantém os mesmos dados do ReadinessCard (grande),
// só muda a apresentação. Estados do slot (com dado/skeleton/sem conexão/oculto)
// continuam em app/(tabs)/home.tsx → ReadinessCardSlot.
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import type { ReadinessResult } from '../../lib/readiness';
import { useV2Colors, type V2Palette } from '../../hooks/useV2Colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface ReadinessCompactCardProps {
  result: ReadinessResult;
  recommendation: string;
  hrToday?: number | null;
  hrv?: number | null;
  onPress?: () => void;
}

const CATEGORY_LABEL: Record<ReadinessResult['category'], string> = {
  otimo: 'Ótimo',
  bom: 'Bom',
  regular: 'Regular',
  reduzido: 'Reduzido',
};

const CATEGORY_COLOR: Record<ReadinessResult['category'], string> = {
  otimo: '#22C55E',
  bom: '#6366F1',
  regular: '#F59E0B',
  reduzido: '#EF4444',
};

function hexToRgba(hex: string, a: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function formatSleep(min: number | null | undefined): string {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// ── Medidor semicircular animado (180°) ──
const GW = 92;
const GH = 56;
const R = 36;
const ARC = Math.PI * R; // comprimento do arco ≈ 113
const ARC_PATH = `M10 46 A${R} ${R} 0 0 1 ${GW - 10} 46`;

function Gauge({ score, color }: { score: number; color: string }) {
  const frac = Math.max(0, Math.min(1, score / 100));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(frac, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [frac]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC * (1 - progress.value),
  }));

  return (
    <Svg width={GW} height={GH}>
      <Path d={ARC_PATH} stroke={hexToRgba(color, 0.16)} strokeWidth={7} strokeLinecap="round" fill="none" />
      <AnimatedPath
        d={ARC_PATH}
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={ARC}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export function ReadinessCompactCard({ result, recommendation, hrToday, hrv, onPress }: ReadinessCompactCardProps) {
  const colors = useV2Colors();
  const categoryColor = CATEGORY_COLOR[result.category];
  const styles = useMemo(() => makeStyles(colors, categoryColor), [colors, categoryColor]);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.card}>
      <Text style={styles.eyebrow}>Sua prontidão para hoje</Text>

      <View style={styles.body}>
        <View style={styles.gaugeWrap}>
          <Gauge score={result.score} color={categoryColor} />
          <View style={styles.gaugeCenter} pointerEvents="none">
            <Text style={styles.score}>{result.score}</Text>
            <Text style={[styles.category, { color: categoryColor }]}>{CATEGORY_LABEL[result.category]}</Text>
          </View>
        </View>

        <Text style={styles.rec} numberOfLines={3}>
          {recommendation}
        </Text>
      </View>

      <View style={styles.metrics}>
        <Metric value={formatSleep(result.sleepMinutesUsed)} label="sono" styles={styles} />
        <Metric value={hrToday != null ? `${hrToday}` : '–'} label="HR" styles={styles} />
        <Metric value={hrv != null ? `${Math.round(hrv)}` : '–'} label="HRV" styles={styles} />
      </View>
    </Pressable>
  );
}

function Metric({ value, label, styles }: { value: string; label: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Text style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}> {label}</Text>
    </Text>
  );
}

// ── Skeleton compacto (mesma silhueta) ──
export function ReadinessCompactSkeleton() {
  const colors = useV2Colors();
  const shimmer = useSharedValue(0.4);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(0.75, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shimmer]);

  const animStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  const block = colors.neutral[200];

  return (
    <View
      style={{
        backgroundColor: colors.surface.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.default,
        borderLeftWidth: 3,
        borderLeftColor: colors.neutral[200],
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Animated.View style={animStyle}>
        <View style={{ width: 130, height: 9, backgroundColor: block, borderRadius: 5, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: GW, height: GH, backgroundColor: block, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={{ height: 11, backgroundColor: block, borderRadius: 5 }} />
            <View style={{ height: 11, width: '80%', backgroundColor: block, borderRadius: 5 }} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function makeStyles(c: V2Palette, accent: string) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border.default,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      paddingVertical: 15,
      paddingHorizontal: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    eyebrow: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: c.text.tertiary,
      marginBottom: 8,
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    gaugeWrap: {
      width: GW,
      height: GH,
    },
    gaugeCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 1,
    },
    score: {
      fontFamily: 'PlusJakartaSans_800ExtraBold',
      fontSize: 23,
      lineHeight: 25,
      color: c.text.primary,
      letterSpacing: -0.5,
    },
    category: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 1,
    },
    rec: {
      flex: 1,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 12.5,
      lineHeight: 17,
      color: c.text.secondary,
    },
    metrics: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 12,
      paddingTop: 11,
      borderTopWidth: 1,
      borderTopColor: c.border.default,
    },
    metricItem: {
      fontSize: 11,
    },
    metricValue: {
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 13,
      color: c.text.primary,
    },
    metricLabel: {
      fontFamily: 'PlusJakartaSans_500Medium',
      fontSize: 11,
      color: c.text.tertiary,
    },
  });
}

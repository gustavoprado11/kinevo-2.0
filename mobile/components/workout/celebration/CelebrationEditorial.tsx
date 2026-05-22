import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ScreenWrap } from './_shared/ScreenWrap';
import { Reveal } from './_shared/Reveal';
import { CountText } from './_shared/CountText';
import { KMark } from './_shared/KMark';
import { BadgePR } from './_shared/BadgePR';
import { BadgeStreak } from './_shared/BadgeStreak';
import { DeltaPill } from './_shared/DeltaPill';
import { useReduceMotion } from './_shared/useReduceMotion';
import { useCelebrationClock } from './_shared/useCelebrationClock';
import { winW, lerpW } from './_shared/easings';
import { CELEB_TOKENS as T, CFONT } from './_shared/tokens';
import type { CelebrationVariantProps } from './types';

const volT = (n: number) => `${(n / 1000).toFixed(1).replace('.', ',')} t`;

export function CelebrationEditorial({ data, onComplete, onShare }: CelebrationVariantProps) {
  const reduce = useReduceMotion();
  const clock = useCelebrationClock(3.5, reduce);
  const pct = data.totalSets > 0 ? Math.round((data.completedSets / data.totalSets) * 100) : 100;

  useEffect(() => {
    if (reduce) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return; }
    const id = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 1600);
    return () => clearTimeout(id);
  }, [reduce]);

  const pctStyle = useAnimatedStyle(() => ({ opacity: winW(clock.value, 1.4, 1.7) }));
  const underlineStyle = useAnimatedStyle(() => ({ width: lerpW(winW(clock.value, 1.85, 2.2, 'outQuart'), 0, 48) }));

  const hasPR = (data.prCount ?? 0) > 0;
  const hasStreak = (data.streakDays ?? 0) > 0;
  const hasDelta = (data.deltaVolumePct ?? 0) > 0;
  const subLine = [`${data.completedSets}/${data.totalSets} séries`, data.coach ? `Com ${data.coach.name}` : null].filter(Boolean).join(' · ');

  return (
    <ScreenWrap tintTop={T.tintEditorialTop}>
      <LinearGradient colors={[...T.brandStripe]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.stripe} />
      <View style={s.root}>
        {/* Eyebrow */}
        <Reveal clock={clock} start={0} end={0.35} fromY={6} style={s.eyebrow}>
          <View style={s.eyebrowL}><KMark size={20} /><Text style={s.eyebrowText}>Treino concluído</Text></View>
          <Text style={s.eyebrowDate}>Hoje</Text>
        </Reveal>

        {/* Hero number */}
        <Reveal clock={clock} start={0.3} end={0.7} ease="outBack" fromScale={0.85} scaleOrigin="top" style={s.heroRow}>
          <CountText target={pct} startMs={300} durMs={1300} ease="outQuint" skip={reduce} style={s.heroNum} format={(n) => `${Math.floor(n)}`} />
          <Animated.Text style={[s.heroPct, pctStyle]}>%</Animated.Text>
        </Reveal>

        {/* Subtitle + underline */}
        <Reveal clock={clock} start={1.7} end={2.0} fromY={8} style={{ alignItems: 'center', marginTop: 18 }}>
          {data.workoutName ? <Text style={s.subTitle}>{data.workoutName}</Text> : null}
          <Text style={s.subMeta}>{subLine}</Text>
        </Reveal>
        <Animated.View style={[s.underline, underlineStyle]} />

        {/* Stats row */}
        <Reveal clock={clock} start={2.05} end={2.35} style={s.statsRow}>
          <StatCol label="duração"><Text style={s.statValue}>{data.duration}</Text></StatCol>
          <StatCol label="volume">
            <CountText target={data.totalVolume} startMs={2100} durMs={700} skip={reduce} style={s.statValue} format={volT} />
          </StatCol>
          <StatCol label="séries">
            <CountText target={data.completedSets} startMs={2100} durMs={700} skip={reduce} style={s.statValue} format={(n) => `${Math.floor(n)}`} />
          </StatCol>
          <StatCol label="RPE"><Text style={s.statValue}>{data.rpe}/10</Text></StatCol>
        </Reveal>

        {/* Chips */}
        {(hasPR || hasStreak) && (
          <View style={s.chips}>
            {hasPR && <Reveal clock={clock} start={2.4} end={2.7}><BadgePR count={data.prCount!} kind="pill" /></Reveal>}
            {hasStreak && <Reveal clock={clock} start={2.55} end={2.85}><BadgeStreak days={data.streakDays!} kind="pill" /></Reveal>}
          </View>
        )}

        {/* Delta */}
        {hasDelta && (
          <Reveal clock={clock} start={2.75} end={3.05} style={{ alignItems: 'center', marginTop: 14 }}>
            <DeltaPill pct={data.deltaVolumePct!} kind="text" />
          </Reveal>
        )}

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Reveal clock={clock} start={3.0} end={3.35} fromY={8}>
          <TouchableOpacity activeOpacity={0.85} onPress={onShare}>
            <LinearGradient colors={[...T.brandStripe]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
              <Text style={s.primaryText}>Compartilhar conquista</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={onComplete} style={s.secondary}>
            <Text style={s.secondaryText}>Fechar</Text>
          </TouchableOpacity>
        </Reveal>
      </View>
    </ScreenWrap>
  );
}

function StatCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {children}
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2 },
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrowL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowText: { fontFamily: CFONT.semibold, fontSize: 12, color: T.textSecondary },
  eyebrowDate: { fontFamily: CFONT.medium, fontSize: 11, color: T.textSecondary },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginTop: 36 },
  heroNum: { fontFamily: CFONT.extrabold, fontSize: 152, color: T.textPrimary, letterSpacing: -8, lineHeight: 152, fontVariant: ['tabular-nums'] },
  heroPct: { fontFamily: CFONT.bold, fontSize: 56, color: T.brand, letterSpacing: -2 },
  subTitle: { fontFamily: CFONT.bold, fontSize: 22, color: T.textPrimary, letterSpacing: -0.5 },
  subMeta: { fontFamily: CFONT.medium, fontSize: 12, color: T.textSecondary, marginTop: 4 },
  underline: { height: 2, backgroundColor: T.textPrimary, borderRadius: 1, marginTop: 14, alignSelf: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 32, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: T.hairline },
  statValue: { fontFamily: CFONT.bold, fontSize: 18, color: T.textPrimary, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: CFONT.medium, fontSize: 10, color: T.textSecondary, marginTop: 3, letterSpacing: 0.2 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 },
  primary: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8 },
  primaryText: { fontFamily: CFONT.bold, fontSize: 16, color: '#FFFFFF' },
  secondary: { marginTop: 12, alignItems: 'center', paddingVertical: 4 },
  secondaryText: { fontFamily: CFONT.semibold, fontSize: 14, color: T.textSecondary },
});

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ScreenWrap } from './_shared/ScreenWrap';
import { Reveal } from './_shared/Reveal';
import { KMark } from './_shared/KMark';
import { BadgePR } from './_shared/BadgePR';
import { BadgeStreak } from './_shared/BadgeStreak';
import { DeltaPill } from './_shared/DeltaPill';
import { useReduceMotion } from './_shared/useReduceMotion';
import { useCelebrationClock } from './_shared/useCelebrationClock';
import { winW, lerpW } from './_shared/easings';
import { CELEB_TOKENS as T, CFONT, useCelebTokens } from './_shared/tokens';
import type { CelebrationVariantProps } from './types';

const volT = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1).replace('.', ',')} t` : `${Math.round(kg)} kg`);

function Dashed({ style }: { style?: any }) {
  return <View style={[{ height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D6CFC1' }, style]} />;
}

export function CelebrationReceipt({ data, onComplete, onShare }: CelebrationVariantProps) {
  const reduce = useReduceMotion();
  const ct = useCelebTokens();
  const clock = useCelebrationClock(4.0, reduce);

  useEffect(() => {
    if (reduce) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return; }
    const id = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 2650);
    return () => clearTimeout(id);
  }, [reduce]);

  const stampStyle = useAnimatedStyle(() => {
    const p = winW(clock.value, 2.3, 2.65, 'outBack');
    const rot = lerpW(p, -25, -8);
    const sc = lerpW(p, 1.6, 1);
    const t = clock.value;
    let shake = 0;
    if (t > 2.65 && t < 2.85) shake = Math.sin((t - 2.65) * 60) * 0.6 * Math.max(0, 1 - (t - 2.65) / 0.2);
    return { opacity: winW(clock.value, 2.3, 2.55), transform: [{ rotate: `${rot + shake}deg` }, { scale: sc }] };
  });

  const hasPR = (data.prCount ?? 0) > 0;
  const hasStreak = (data.streakDays ?? 0) > 0;
  const hasDelta = (data.deltaVolumePct ?? 0) > 0;
  const dateCoach = ['Hoje', data.coach ? `Com ${data.coach.name}` : null].filter(Boolean).join(' · ');
  const receiptNo = String(Math.floor(data.totalVolume / 100)).padStart(4, '0');

  const rows = [
    { l: 'Duração', v: data.duration, s: 1.1, e: 1.35 },
    { l: 'Séries', v: `${data.completedSets}/${data.totalSets}`, s: 1.25, e: 1.5 },
    { l: 'Volume', v: volT(data.totalVolume), s: 1.4, e: 1.65 },
    { l: 'RPE', v: `${data.rpe}/10`, s: 1.55, e: 1.8 },
  ];

  return (
    <ScreenWrap tintTop={T.tintReceiptTop}>
      <View style={s.root}>
        {/* Eyebrow */}
        <View style={s.eyebrow}>
          <View style={s.eyebrowL}><KMark size={20} /><Text style={s.eyebrowText}>Recibo do treino</Text></View>
          <Text style={s.eyebrowDate}>nº {receiptNo}</Text>
        </View>

        {/* Receipt card */}
        <View style={{ marginTop: 14 }}>
          <Reveal clock={clock} start={0} end={0.6} ease="outQuart" fromY={80} style={s.card}>
            <LinearGradient colors={[...ct.brandStripe]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cardStripe} />

            <Reveal clock={clock} start={0.5} end={0.8} style={{ paddingTop: 6 }}>
              <Text style={s.cardEyebrow}>TREINO CONCLUÍDO</Text>
            </Reveal>
            <Reveal clock={clock} start={0.7} end={1.0} fromY={6}>
              <Text style={s.cardTitle}>{data.workoutName ?? 'Treino'}</Text>
            </Reveal>
            <Reveal clock={clock} start={0.85} end={1.15}>
              <Text style={s.cardMeta}>{dateCoach}</Text>
            </Reveal>

            <Dashed style={{ marginTop: 16 }} />

            <View style={{ marginTop: 12, gap: 9 }}>
              {rows.map((r, i) => (
                <Reveal key={i} clock={clock} start={r.s} end={r.e} fromX={-6}>
                  <View style={s.statRow}>
                    <Text style={s.statRowLabel}>{r.l}</Text>
                    <Text style={s.statRowValue}>{r.v}</Text>
                  </View>
                </Reveal>
              ))}
            </View>

            {(hasPR || hasStreak || hasDelta) && (
              <>
                <Dashed style={{ marginTop: 14 }} />
                <Reveal clock={clock} start={1.8} end={2.1} style={s.badgesRow}>
                  {hasPR && <BadgePR count={data.prCount!} kind="chip" />}
                  {hasStreak && <BadgeStreak days={data.streakDays!} kind="chip" />}
                  {hasDelta && <DeltaPill pct={data.deltaVolumePct!} kind="chip" />}
                </Reveal>
              </>
            )}

            {data.coach && (
              <Reveal clock={clock} start={1.95} end={2.25} style={s.footer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={[s.avatar, { backgroundColor: ct.brandSoft }]}><Text style={[s.avatarText, { color: ct.brandSoftText }]}>{data.coach.initial}</Text></View>
                  <Text style={s.coachName}>{data.coach.name}</Text>
                </View>
                <Text style={s.brand}>kinevo.app</Text>
              </Reveal>
            )}
          </Reveal>

          {/* Stamp */}
          <Animated.View style={[s.stamp, stampStyle]} pointerEvents="none">
            <Text style={s.stampText}>CONCLUÍDO</Text>
          </Animated.View>
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Reveal clock={clock} start={2.85} end={3.2} fromY={8}>
          <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={s.primary}>
            <Text style={s.primaryText}>Compartilhar conquista</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={onComplete} style={s.secondary}>
            <Text style={s.secondaryText}>Fechar</Text>
          </TouchableOpacity>
        </Reveal>
      </View>
    </ScreenWrap>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrowL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowText: { fontFamily: CFONT.semibold, fontSize: 12, color: T.textSecondary },
  eyebrowDate: { fontFamily: CFONT.medium, fontSize: 11, color: T.textSecondary },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.hairlineSoft, overflow: 'hidden',
    shadowColor: '#3C280F', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 28, elevation: 8,
  },
  cardStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  cardEyebrow: { fontFamily: CFONT.bold, fontSize: 10, color: T.textTertiary, letterSpacing: 1.6 },
  cardTitle: { marginTop: 6, fontFamily: CFONT.bold, fontSize: 24, color: T.textPrimary, letterSpacing: -0.7 },
  cardMeta: { marginTop: 4, fontFamily: CFONT.medium, fontSize: 12, color: T.textSecondary },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statRowLabel: { fontFamily: CFONT.medium, fontSize: 13, color: '#3A3A3C' },
  statRowValue: { fontFamily: CFONT.bold, fontSize: 14, color: T.textPrimary, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  badgesRow: { marginTop: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  footer: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EFE9D8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: CFONT.extrabold, fontSize: 10, color: T.brandSoftText },
  coachName: { fontFamily: CFONT.bold, fontSize: 11.5, color: T.textPrimary },
  brand: { fontFamily: CFONT.semibold, fontSize: 10.5, color: T.textSecondary },
  stamp: {
    position: 'absolute', top: 52, right: 16,
    borderWidth: 3, borderColor: T.stampRed, borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.6)',
  },
  stampText: { fontFamily: CFONT.extrabold, fontSize: 16, color: T.stampRed, letterSpacing: 2 },
  primary: { backgroundColor: '#0A0A0A', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { fontFamily: CFONT.bold, fontSize: 16, color: '#FFFFFF' },
  secondary: { marginTop: 12, alignItems: 'center', paddingVertical: 4 },
  secondaryText: { fontFamily: CFONT.semibold, fontSize: 14, color: T.textSecondary },
});

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenWrap } from './_shared/ScreenWrap';
import { ActivityRing } from './_shared/ActivityRing';
import { Reveal } from './_shared/Reveal';
import { CountText } from './_shared/CountText';
import { KMark } from './_shared/KMark';
import { BadgePR } from './_shared/BadgePR';
import { BadgeStreak } from './_shared/BadgeStreak';
import { DeltaPill } from './_shared/DeltaPill';
import { useReduceMotion } from './_shared/useReduceMotion';
import { useCelebrationClock } from './_shared/useCelebrationClock';
import { CELEB_TOKENS as T, CFONT, useCelebTokens } from './_shared/tokens';
import type { CelebrationVariantProps } from './types';

const volT = (n: number) => `${(n / 1000).toFixed(1).replace('.', ',')}t`;

export function CelebrationFitness({ data, onComplete, onShare }: CelebrationVariantProps) {
  const reduce = useReduceMotion();
  const ct = useCelebTokens();
  const clock = useCelebrationClock(4.0, reduce);

  useEffect(() => {
    if (reduce) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return; }
    const id = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
    return () => clearTimeout(id);
  }, [reduce]);

  const hasPR = (data.prCount ?? 0) > 0;
  const hasStreak = (data.streakDays ?? 0) > 0;
  const hasDelta = (data.deltaVolumePct ?? 0) > 0;
  const subtitle = [data.workoutName, 'Hoje'].filter(Boolean).join(' · ');

  return (
    <ScreenWrap tintTop={T.tintFitnessTop}>
      <View style={s.root}>
        {/* Eyebrow */}
        <View style={s.eyebrow}>
          <View style={s.eyebrowL}><KMark size={20} /><Text style={s.eyebrowText}>Treino concluído</Text></View>
          <Text style={s.eyebrowDate}>{data.duration}</Text>
        </View>

        {/* Ring */}
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <ActivityRing clock={clock} size={200} />
        </View>

        {/* Title */}
        <Reveal clock={clock} start={2.2} end={2.55} fromY={12} style={{ alignItems: 'center', marginTop: 18 }}>
          <Text style={s.title}>Treino concluído</Text>
        </Reveal>
        <Reveal clock={clock} start={2.35} end={2.65} fromY={10} style={{ alignItems: 'center', marginTop: 6 }}>
          <Text style={s.subtitle}>{subtitle}</Text>
        </Reveal>

        {/* Stats grid */}
        <Reveal clock={clock} start={2.6} end={2.9} style={s.statsGrid}>
          <Stat dot={ct.statDots[0]} label="duração"><Text style={s.statValue}>{data.duration}</Text></Stat>
          <Stat dot={ct.statDots[1]} label="séries">
            <CountText target={data.completedSets} startMs={2700} durMs={800} skip={reduce} style={s.statValue}
              format={(n) => `${Math.floor(n)}/${data.totalSets}`} />
          </Stat>
          <Stat dot={ct.statDots[2]} label="volume">
            <CountText target={data.totalVolume} startMs={2700} durMs={800} skip={reduce} style={s.statValue} format={volT} />
          </Stat>
          <Stat dot={ct.statDots[3]} label="RPE">
            <CountText target={data.rpe} startMs={2700} durMs={800} skip={reduce} style={s.statValue}
              format={(n) => `${Math.floor(n)}/10`} />
          </Stat>
        </Reveal>

        {/* Badges */}
        {(hasPR || hasStreak) && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {hasPR && (
              <View style={{ flex: 1 }}>
                <Reveal clock={clock} start={3.1} end={3.45} ease="outBack" fromScale={0.5}>
                  <BadgePR count={data.prCount!} kind="card" />
                </Reveal>
              </View>
            )}
            {hasStreak && (
              <View style={{ flex: 1 }}>
                <Reveal clock={clock} start={3.25} end={3.55}>
                  <BadgeStreak days={data.streakDays!} kind="card" />
                </Reveal>
              </View>
            )}
          </View>
        )}

        {/* Delta */}
        {hasDelta && (
          <Reveal clock={clock} start={3.4} end={3.65} style={{ alignItems: 'center', marginTop: 14 }}>
            <DeltaPill pct={data.deltaVolumePct!} kind="pill" />
          </Reveal>
        )}

        <View style={{ flex: 1 }} />

        {/* CTAs */}
        <Reveal clock={clock} start={3.55} end={3.9} fromY={8}>
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

function Stat({ dot, label, children }: { dot: string; label: string; children: React.ReactNode }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statDot, { backgroundColor: dot }]} />
      {children}
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrowL: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowText: { fontFamily: CFONT.semibold, fontSize: 12, color: T.textSecondary },
  eyebrowDate: { fontFamily: CFONT.medium, fontSize: 11, color: T.textSecondary },
  title: { fontFamily: CFONT.extrabold, fontSize: 32, letterSpacing: -1, color: T.textPrimary },
  subtitle: { fontFamily: CFONT.medium, fontSize: 14, color: T.textSecondary },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 24 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: T.hairline, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  statDot: { width: 5, height: 5, borderRadius: 3, marginBottom: 6 },
  statValue: { fontFamily: CFONT.bold, fontSize: 15, color: T.textPrimary, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: CFONT.semibold, fontSize: 9, color: T.textSecondary, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },
  primary: { backgroundColor: '#0A0A0A', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryText: { fontFamily: CFONT.bold, fontSize: 16, color: '#FFFFFF' },
  secondary: { marginTop: 12, alignItems: 'center', paddingVertical: 4 },
  secondaryText: { fontFamily: CFONT.semibold, fontSize: 14, color: T.textSecondary },
});

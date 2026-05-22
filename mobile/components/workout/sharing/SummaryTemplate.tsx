// T3 — Resumo / Apple Activity. Anel concêntrico decorativo + métricas
// com dots coloridos + streak. Ref: share-cards.jsx → T3Resumo.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { ShareTopRow } from './_shared/ShareTopRow';
import { ShareGrain } from './_shared/ShareGrain';
import { ShareActivityRing } from './_shared/ShareActivityRing';
import { SHARE_TOKENS, FONT, CARD_W, CARD_H } from './_shared/tokens';
import { fmtVolume } from './_shared/formatVolume';

export const SummaryTemplate = ({
    workoutName,
    duration,
    volume,
    exerciseCount,
    completedSets,
    streakDays,
    date,
    coach,
}: ShareableCardProps) => {
    const rows = [
        { label: 'Duração', value: duration, tint: SHARE_TOKENS.ringRed },
        { label: 'Volume', value: `${fmtVolume(volume)} kg`, tint: SHARE_TOKENS.ringViolet },
        {
            label: 'Exercícios',
            value: completedSets != null ? `${exerciseCount} · ${completedSets} séries` : `${exerciseCount}`,
            tint: SHARE_TOKENS.ringGreen,
        },
    ];
    const filledDots = Math.max(0, Math.min(7, streakDays ?? 0));

    return (
        <View style={styles.container}>
            {/* Soft top tint */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220 }}>
                <Svg width={CARD_W} height={220}>
                    <Defs>
                        <RadialGradient id="t3wash" cx="50%" cy="0%" r="90%">
                            <Stop offset="0" stopColor={SHARE_TOKENS.tintT3} stopOpacity={1} />
                            <Stop offset="0.7" stopColor={SHARE_TOKENS.tintT3} stopOpacity={0} />
                        </RadialGradient>
                    </Defs>
                    <Rect x="0" y="0" width={CARD_W} height={220} fill="url(#t3wash)" />
                </Svg>
            </View>
            <ShareGrain opacity={0.04} />

            <View style={styles.inner}>
                <ShareTopRow label="Resumo do treino" date={date} />

                {/* Hero: name + ring */}
                <View style={styles.heroRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.name} numberOfLines={2}>{workoutName}</Text>
                        {coach?.name ? (
                            <Text style={styles.withCoach}>Com {coach.name}</Text>
                        ) : null}
                    </View>
                    <ShareActivityRing size={58} />
                </View>

                {/* Metric rows */}
                <View style={{ marginTop: 30 }}>
                    {rows.map((r, i) => (
                        <View
                            key={r.label}
                            style={[styles.metricRow, i === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: SHARE_TOKENS.hairline }]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.tint }} />
                                <Text style={styles.metricLabel}>{r.label}</Text>
                            </View>
                            <Text style={styles.metricValue}>{r.value}</Text>
                        </View>
                    ))}
                </View>

                {/* Streak row — só com dado real */}
                {filledDots > 0 && (
                    <View style={styles.streakRow}>
                        <View style={{ flexDirection: 'row', gap: 3 }}>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <View
                                    key={i}
                                    style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: i < filledDots ? SHARE_TOKENS.brand : '#E5E5EA' }}
                                />
                            ))}
                        </View>
                        <Text style={styles.streakStrong}>{streakDays} dias</Text>
                        <Text style={styles.streakText}>seguidos com treino</Text>
                    </View>
                )}

                <View style={{ flex: 1 }} />
                <ShareBrandFooter coach={coach} borderColor="rgba(60,40,15,0.14)" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, backgroundColor: SHARE_TOKENS.canvasT3, overflow: 'hidden' },
    inner: { flex: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24 },
    heroRow: { marginTop: 28, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    name: { fontFamily: FONT.bold, fontSize: 30, color: SHARE_TOKENS.textPrimary, letterSpacing: -1.2, lineHeight: 32 },
    withCoach: { fontFamily: FONT.medium, fontSize: 12, color: SHARE_TOKENS.textSecondary, marginTop: 6 },
    metricRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SHARE_TOKENS.hairline,
    },
    metricLabel: { fontFamily: FONT.semibold, fontSize: 14, color: SHARE_TOKENS.textPrimary },
    metricValue: { fontFamily: FONT.bold, fontSize: 16, color: SHARE_TOKENS.textPrimary, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
    streakRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
    streakStrong: { fontFamily: FONT.bold, fontSize: 12, color: SHARE_TOKENS.textPrimary },
    streakText: { fontFamily: FONT.medium, fontSize: 12, color: SHARE_TOKENS.textSecondary },
});

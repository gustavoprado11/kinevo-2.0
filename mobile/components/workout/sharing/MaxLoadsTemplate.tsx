// T2 — Recorde / Greeting card. Celebra UM momento: cream wash quente +
// troféu watermark sutil + número gigante + delta verde. Fallback p/ "maior
// carga da sessão" quando não há PR. Ref: share-cards.jsx → T2Recorde.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Path } from 'react-native-svg';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { ShareTopRow } from './_shared/ShareTopRow';
import { ShareGrain } from './_shared/ShareGrain';
import { pickHighlightPR } from './_shared/pickHighlightPR';
import { SHARE_TOKENS, FONT, CARD_W, CARD_H } from './_shared/tokens';
import { fmtKg } from './_shared/formatVolume';

const TROPHY_PATHS = [
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
    'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
    'M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
    'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
    'M18 2H6v7a6 6 0 0 0 12 0V2Z',
];

export const MaxLoadsTemplate = ({ workoutName, maxLoads, exerciseDetails, date, coach }: ShareableCardProps) => {
    const pr = pickHighlightPR(maxLoads, exerciseDetails);

    return (
        <View style={styles.container}>
            {/* Radial cream wash */}
            <View style={StyleSheet.absoluteFill}>
                <Svg width={CARD_W} height={CARD_H}>
                    <Defs>
                        <RadialGradient id="t2wash" cx="50%" cy="0%" r="80%">
                            <Stop offset="0" stopColor={SHARE_TOKENS.warmRadial} stopOpacity={1} />
                            <Stop offset="0.6" stopColor={SHARE_TOKENS.warmRadial} stopOpacity={0} />
                        </RadialGradient>
                    </Defs>
                    <Rect x="0" y="0" width={CARD_W} height={CARD_H} fill="url(#t2wash)" />
                </Svg>
            </View>
            {/* Trophy watermark */}
            <View style={{ position: 'absolute', right: -180, bottom: -160, opacity: 0.045 }}>
                <Svg width={520} height={520} viewBox="0 0 24 24">
                    {TROPHY_PATHS.map((d, i) => (
                        <Path key={i} d={d} fill="none" stroke={SHARE_TOKENS.goldText} strokeWidth={0.6} />
                    ))}
                </Svg>
            </View>
            <ShareGrain opacity={0.06} />

            <View style={styles.inner}>
                <ShareTopRow label="Kinevo" date={date} />

                {pr ? (
                    <>
                        <View style={{ marginTop: 38 }}>
                            <View style={[styles.badge, !pr.isPr && styles.badgeNeutral]}>
                                {pr.isPr && (
                                    <Svg width={11} height={11} viewBox="0 0 24 24">
                                        {TROPHY_PATHS.map((d, i) => (
                                            <Path key={i} d={d} fill="none" stroke={SHARE_TOKENS.goldText} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                                        ))}
                                    </Svg>
                                )}
                                <Text style={[styles.badgeText, !pr.isPr && { color: SHARE_TOKENS.textSecondary }]}>
                                    {pr.isPr ? 'Recorde pessoal' : 'Maior carga da sessão'}
                                </Text>
                            </View>
                        </View>

                        <View style={{ marginTop: 22 }}>
                            <Text style={styles.exName} numberOfLines={2}>{pr.exerciseName}</Text>

                            <View style={styles.weightRow}>
                                <Text style={styles.weight}>{fmtKg(pr.weight)}</Text>
                                <Text style={styles.unit}>kg</Text>
                            </View>

                            <Text style={styles.repsLine}>
                                <Text style={styles.repsStrong}>{pr.reps} repetições</Text>
                                <Text style={styles.repsSoft}>{`  ·  ${workoutName}`}</Text>
                            </Text>

                            {pr.delta != null && (
                                <View style={styles.deltaPill}>
                                    <Svg width={11} height={11} viewBox="0 0 24 24">
                                        <Path d="M7 17l5-5 5 5" fill="none" stroke={SHARE_TOKENS.successText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                                        <Path d="M12 12V4" fill="none" stroke={SHARE_TOKENS.successText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                    <Text style={styles.deltaText}>
                                        +{fmtKg(pr.delta)} kg{pr.previousDate ? ` desde ${pr.previousDate}` : ''}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={{ marginTop: 60 }}>
                        <Text style={styles.exName}>{workoutName}</Text>
                        <Text style={[styles.repsSoft, { marginTop: 10 }]}>Sem cargas registradas nesta sessão.</Text>
                    </View>
                )}

                <View style={{ flex: 1 }} />
                <ShareBrandFooter coach={coach} borderColor="rgba(139,90,15,0.18)" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, backgroundColor: SHARE_TOKENS.canvasT2, overflow: 'hidden' },
    inner: { flex: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24 },
    badge: {
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: SHARE_TOKENS.goldBorder,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    },
    badgeNeutral: { borderColor: SHARE_TOKENS.hairline },
    badgeText: { fontFamily: FONT.bold, fontSize: 10.5, color: SHARE_TOKENS.goldText, letterSpacing: 0.3 },
    exName: { fontFamily: FONT.bold, fontSize: 22, color: SHARE_TOKENS.textPrimary, letterSpacing: -0.5, lineHeight: 24 },
    weightRow: { marginTop: 24, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    weight: { fontFamily: FONT.extrabold, fontSize: 108, color: SHARE_TOKENS.textPrimary, letterSpacing: -5.5, lineHeight: 100, fontVariant: ['tabular-nums'] },
    unit: { fontFamily: FONT.semibold, fontSize: 28, color: SHARE_TOKENS.textSecondary, letterSpacing: -0.5 },
    repsLine: { marginTop: 14, fontSize: 14 },
    repsStrong: { fontFamily: FONT.semibold, fontSize: 14, color: SHARE_TOKENS.textPrimary },
    repsSoft: { fontFamily: FONT.medium, fontSize: 14, color: SHARE_TOKENS.textSecondary },
    deltaPill: {
        alignSelf: 'flex-start', marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: SHARE_TOKENS.successBg, borderWidth: StyleSheet.hairlineWidth, borderColor: SHARE_TOKENS.successBorder,
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    },
    deltaText: { fontFamily: FONT.bold, fontSize: 11, color: SHARE_TOKENS.successText },
});

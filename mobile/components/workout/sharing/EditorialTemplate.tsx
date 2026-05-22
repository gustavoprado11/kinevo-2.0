// T1 — Editorial / Book cover. Volume como manchete: faixa cream inferior +
// número gigante. Vibe Stripe Press / Apple Books. Ref: share-cards.jsx → T1Editorial.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { ShareTopRow } from './_shared/ShareTopRow';
import { ShareGrain } from './_shared/ShareGrain';
import { ShareAccentStripe } from './_shared/ShareAccentStripe';
import { SHARE_TOKENS, FONT, CARD_W, CARD_H } from './_shared/tokens';
import { fmtVolume } from './_shared/formatVolume';

export const EditorialTemplate = ({
    workoutName,
    duration,
    volume,
    exerciseCount,
    date,
    coach,
}: ShareableCardProps) => {
    return (
        <View style={styles.container}>
            {/* Cream band — bottom 36% */}
            <View style={styles.creamBand} />
            <ShareAccentStripe />
            <ShareGrain opacity={0.05} />

            <View style={styles.inner}>
                <ShareTopRow label="Treino concluído" date={date} />

                {/* Hero */}
                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>VOLUME TOTAL</Text>
                    <Text style={styles.bigNumber}>{fmtVolume(volume)}</Text>
                    <Text style={styles.unit}>quilos levantados</Text>

                    <Text style={styles.metaLine}>
                        <Text style={styles.metaStrong}>{workoutName}</Text>
                        <Text style={styles.metaSoft}>{`  ·  ${duration}  ·  ${exerciseCount} exercícios`}</Text>
                    </Text>
                </View>

                <ShareBrandFooter coach={coach} borderColor="rgba(60,40,15,0.18)" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, backgroundColor: SHARE_TOKENS.canvas, overflow: 'hidden' },
    creamBand: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '36%', backgroundColor: SHARE_TOKENS.creamBand },
    inner: { flex: 1, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24 },
    hero: { flex: 1, justifyContent: 'center', marginTop: 4 },
    eyebrow: { fontFamily: FONT.bold, fontSize: 10.5, color: SHARE_TOKENS.textSecondary, letterSpacing: 1.6, marginBottom: 6 },
    bigNumber: { fontFamily: FONT.extrabold, fontSize: 100, color: SHARE_TOKENS.textPrimary, letterSpacing: -5.2, lineHeight: 92, fontVariant: ['tabular-nums'] },
    unit: { fontFamily: FONT.semibold, fontSize: 15, color: '#3A3A3C', marginTop: 6, letterSpacing: -0.2 },
    metaLine: { marginTop: 40, fontSize: 13, lineHeight: 19 },
    metaStrong: { fontFamily: FONT.bold, fontSize: 13, color: SHARE_TOKENS.textPrimary },
    metaSoft: { fontFamily: FONT.medium, fontSize: 13, color: SHARE_TOKENS.textCream },
});

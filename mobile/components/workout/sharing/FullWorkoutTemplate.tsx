// T4 — Lista / Receipt. Documento do treino: linhas zebradas + colunas
// tabulares + PRs inline + chip de semana. Ref: share-cards.jsx → T4Lista.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { ShareTopRow } from './_shared/ShareTopRow';
import { ShareGrain } from './_shared/ShareGrain';
import { ShareAccentStripe } from './_shared/ShareAccentStripe';
import { SHARE_TOKENS, useShareTokens, FONT, CARD_W, CARD_H } from './_shared/tokens';
import { fmtKg, fmtVolume } from './_shared/formatVolume';
import { toRgba } from '../../../lib/brandColor';

const MAX_ROWS = 8;

export const FullWorkoutTemplate = ({
    workoutName,
    duration,
    volume,
    exerciseDetails,
    programWeek,
    date,
    coach,
}: ShareableCardProps) => {
    const bt = useShareTokens();
    const all = exerciseDetails ?? [];
    const visible = all.slice(0, MAX_ROWS);
    const remaining = all.length - visible.length;

    return (
        <View style={styles.container}>
            <ShareAccentStripe />
            <ShareGrain opacity={0.05} />

            <View style={styles.inner}>
                <ShareTopRow label="Treino do dia" date={date} />

                {/* Title + program chip */}
                <View style={styles.titleRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.title} numberOfLines={1}>{workoutName}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {duration} · {fmtVolume(volume)} kg
                        </Text>
                    </View>
                    {programWeek && (
                        <View style={[styles.weekChip, { backgroundColor: bt.brandSoft }]}>
                            <Text style={[styles.weekChipText, { color: bt.brandText }]}>SEMANA {programWeek.current}/{programWeek.total}</Text>
                        </View>
                    )}
                </View>

                {/* Header row */}
                <View style={styles.headerRow}>
                    <View style={{ width: 18 }} />
                    <Text style={[styles.headLabel, { flex: 1 }]}>Exercício</Text>
                    <Text style={[styles.headLabel, { width: 44, textAlign: 'right' }]}>Séries</Text>
                    <Text style={[styles.headLabel, { width: 64, textAlign: 'right' }]}>Carga</Text>
                </View>

                {/* Rows */}
                <View style={{ flex: 1 }}>
                    {visible.map((ex, i) => (
                        <View key={i} style={[styles.row, i % 2 === 1 && { backgroundColor: toRgba(bt.brand, 0.025) }]}>
                            <Text style={styles.idx}>{String(i + 1).padStart(2, '0')}</Text>
                            <View style={styles.nameCell}>
                                <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                                {ex.isPr && (
                                    <View style={styles.prBadge}>
                                        <Text style={styles.prText}>PR</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.sets}>{ex.sets}×{ex.reps}</Text>
                            <Text style={[styles.load, ex.weight == null && { color: SHARE_TOKENS.textTertiary }]}>
                                {ex.weight == null ? '—' : `${fmtKg(ex.weight)} kg`}
                            </Text>
                        </View>
                    ))}
                    {remaining > 0 && (
                        <Text style={styles.more}>+ {remaining} mais</Text>
                    )}
                </View>

                <ShareBrandFooter coach={coach} borderColor="rgba(60,40,15,0.16)" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, backgroundColor: SHARE_TOKENS.canvas, overflow: 'hidden' },
    inner: { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
    titleRow: { marginTop: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
    title: { fontFamily: FONT.bold, fontSize: 22, color: SHARE_TOKENS.textPrimary, letterSpacing: -0.7 },
    subtitle: { fontFamily: FONT.medium, fontSize: 11.5, color: SHARE_TOKENS.textSecondary, marginTop: 4, fontVariant: ['tabular-nums'] },
    weekChip: { backgroundColor: SHARE_TOKENS.brandSoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
    weekChipText: { fontFamily: FONT.bold, fontSize: 9.5, color: SHARE_TOKENS.brandText, letterSpacing: 0.4 },
    headerRow: {
        marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SHARE_TOKENS.hairline,
    },
    headLabel: { fontFamily: FONT.bold, fontSize: 9, color: SHARE_TOKENS.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 4 },
    idx: { width: 18, fontFamily: FONT.semibold, fontSize: 10, color: SHARE_TOKENS.textTertiary, fontVariant: ['tabular-nums'] },
    nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    exName: { fontFamily: FONT.semibold, fontSize: 12.5, color: SHARE_TOKENS.textPrimary, flexShrink: 1 },
    prBadge: { backgroundColor: SHARE_TOKENS.goldBg, borderWidth: StyleSheet.hairlineWidth, borderColor: SHARE_TOKENS.goldBorder, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    prText: { fontFamily: FONT.extrabold, fontSize: 8.5, color: SHARE_TOKENS.goldText, letterSpacing: 0.4 },
    sets: { width: 44, textAlign: 'right', fontFamily: FONT.semibold, fontSize: 12.5, color: SHARE_TOKENS.textPrimary, fontVariant: ['tabular-nums'] },
    load: { width: 64, textAlign: 'right', fontFamily: FONT.bold, fontSize: 12.5, color: SHARE_TOKENS.textPrimary, fontVariant: ['tabular-nums'] },
    more: { paddingHorizontal: 8, paddingTop: 8, fontFamily: FONT.medium, fontSize: 11, color: SHARE_TOKENS.textSecondary },
});

// T5 — Foto / Stripe Sessions. Foto cobre o card; card branco flutuante
// embaixo com accent stripe + dados + assinatura. Ref: share-cards.jsx → T5Foto.
import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'lucide-react-native';
import { ShareableCardProps } from './types';
import { ShareGrain } from './_shared/ShareGrain';
import { ShareAccentStripe } from './_shared/ShareAccentStripe';
import { KMark } from './_shared/KMark';
import { SHARE_TOKENS, useShareTokens, FONT, CARD_W, CARD_H } from './_shared/tokens';
import { fmtVolume } from './_shared/formatVolume';

export const PhotoOverlayTemplate = ({
    workoutName,
    duration,
    volume,
    exerciseCount,
    date,
    coach,
    backgroundImageUri,
}: ShareableCardProps) => {
    const bt = useShareTokens();
    if (!backgroundImageUri) {
        return (
            <View style={[styles.container, styles.placeholder]}>
                <Camera size={48} color={SHARE_TOKENS.textTertiary} />
                <Text style={styles.placeholderText}>Adicione uma foto</Text>
            </View>
        );
    }

    const handle = coach?.instagram_handle?.trim() || null;
    const stats = [
        { v: duration, l: 'duração' },
        { v: `${fmtVolume(volume)} kg`, l: 'volume' },
        { v: `${exerciseCount}`, l: 'exercícios' },
    ];

    return (
        <ImageBackground source={{ uri: backgroundImageUri }} style={styles.container} resizeMode="cover">
            {/* Photo gradient overlay */}
            <LinearGradient
                colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
                locations={[0, 0.35, 0.55, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* Top date pill */}
            <View style={styles.datePill}>
                <KMark size={13} />
                <Text style={styles.datePillText}>{date} · {duration}</Text>
            </View>

            {/* Bottom white card */}
            <View style={styles.card}>
                <ShareAccentStripe />
                <View style={styles.cardInner}>
                    <ShareGrain opacity={0.04} />

                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{workoutName}</Text>
                        <Text style={styles.date}>{date}</Text>
                    </View>

                    <View style={styles.statsGrid}>
                        {stats.map((s, i) => (
                            <View key={i} style={{ minWidth: 0 }}>
                                <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                                <Text style={styles.statLabel} numberOfLines={1}>{s.l}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.footerRow}>
                        <View style={styles.coachRow}>
                            {coach?.avatar_url ? (
                                <Image source={{ uri: coach.avatar_url }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: bt.brandSoft }]}>
                                    <Text style={[styles.avatarInitial, { color: bt.brandText }]}>{(coach?.name ?? 'K').charAt(0).toUpperCase()}</Text>
                                </View>
                            )}
                            <Text style={styles.coachName} numberOfLines={1}>
                                {coach?.name ?? 'Kinevo'}
                                {handle ? <Text style={styles.coachHandle}> · @{handle}</Text> : null}
                            </Text>
                        </View>
                        <Text style={styles.brand}>kinevo.app</Text>
                    </View>
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: { width: CARD_W, height: CARD_H, backgroundColor: '#0A0A0A', overflow: 'hidden' },
    placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' },
    placeholderText: { color: SHARE_TOKENS.textTertiary, marginTop: 12, fontSize: 16, fontFamily: FONT.medium },

    datePill: {
        position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 6, paddingLeft: 8, paddingRight: 10, borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.94)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 3,
    },
    datePillText: { fontFamily: FONT.bold, fontSize: 10.5, color: SHARE_TOKENS.textPrimary, letterSpacing: 0.1 },

    card: {
        position: 'absolute', left: 14, right: 14, bottom: 14,
        backgroundColor: SHARE_TOKENS.canvas, borderRadius: 18, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 40, elevation: 14,
    },
    cardInner: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    title: { flex: 1, fontFamily: FONT.bold, fontSize: 18, color: SHARE_TOKENS.textPrimary, letterSpacing: -0.4 },
    date: { fontFamily: FONT.medium, fontSize: 11, color: SHARE_TOKENS.textSecondary },
    statsGrid: {
        flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SHARE_TOKENS.hairline,
    },
    statValue: { fontFamily: FONT.bold, fontSize: 15, color: SHARE_TOKENS.textPrimary, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: FONT.medium, fontSize: 10, color: SHARE_TOKENS.textSecondary, marginTop: 1 },
    footerRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    coachRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
    avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: SHARE_TOKENS.brandSoft },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontFamily: FONT.bold, fontSize: 9, color: SHARE_TOKENS.brandText },
    coachName: { fontFamily: FONT.bold, fontSize: 10.5, color: SHARE_TOKENS.textPrimary, flexShrink: 1 },
    coachHandle: { fontFamily: FONT.medium, color: SHARE_TOKENS.textSecondary },
    brand: { fontFamily: FONT.semibold, fontSize: 10, color: SHARE_TOKENS.textSecondary, flexShrink: 0 },
});

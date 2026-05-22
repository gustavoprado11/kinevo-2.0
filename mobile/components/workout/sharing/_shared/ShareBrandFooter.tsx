import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { KMark } from './KMark';
import { SHARE_TOKENS, FONT } from './tokens';

interface ShareBrandFooterProps {
    coach: {
        name: string;
        avatar_url: string | null;
        /** Handle real do Instagram (sem @). Quando null/vazio, a linha do @ é omitida. */
        instagram_handle?: string | null;
    } | null;
    /** Cor da hairline superior — varia por template p/ harmonizar com a warmth do fundo. */
    borderColor?: string;
}

/**
 * Footer light dos cards v2: avatar + nome + @instagram do trainer (real,
 * via `instagram_handle` — nunca derivar do nome) | K-mark + kinevo.app.
 * Ref: share-cards.jsx → CardFooter.
 */
export function ShareBrandFooter({ coach, borderColor = 'rgba(0,0,0,0.08)' }: ShareBrandFooterProps) {
    const handle = coach?.instagram_handle?.trim() || null;
    const name = coach?.name || 'Kinevo';
    const initial = name.charAt(0).toUpperCase();

    return (
        <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <View style={styles.coachSection}>
                {coach?.avatar_url ? (
                    <Image source={{ uri: coach.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                )}
                <View style={{ flexShrink: 1 }}>
                    <Text style={styles.coachName} numberOfLines={1}>{name}</Text>
                    {handle && (
                        <Text style={styles.coachHandle} numberOfLines={1}>@{handle}</Text>
                    )}
                </View>
            </View>

            <View style={styles.brand}>
                <KMark size={16} />
                <Text style={styles.brandText}>kinevo.app</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 1,
    },
    avatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: SHARE_TOKENS.brandSoft,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontFamily: FONT.bold,
        fontSize: 12,
        color: SHARE_TOKENS.brandText,
    },
    coachName: {
        fontFamily: FONT.bold,
        fontSize: 11.5,
        color: SHARE_TOKENS.textPrimary,
        letterSpacing: -0.1,
    },
    coachHandle: {
        fontFamily: FONT.medium,
        fontSize: 10,
        color: SHARE_TOKENS.textSecondary,
        marginTop: 1,
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    brandText: {
        fontFamily: FONT.semibold,
        fontSize: 10.5,
        color: SHARE_TOKENS.textSecondary,
        letterSpacing: 0.1,
    },
});

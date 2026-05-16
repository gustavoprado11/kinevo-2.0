import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export type ShareBrandTint = 'gold' | 'purple' | 'green' | 'pink';

interface ShareBrandFooterProps {
    coach: {
        name: string;
        avatar_url: string | null;
        /** Handle real do Instagram (sem @). Quando null/vazio, a linha do @ é omitida. */
        instagram_handle?: string | null;
    } | null;
    tint?: ShareBrandTint;
}

const TINTS: Record<ShareBrandTint, { border: string; accent: string }> = {
    gold: { border: 'rgba(244, 196, 78, 0.45)', accent: '#F4C04E' },
    purple: { border: 'rgba(124, 58, 237, 0.45)', accent: '#A78BFA' },
    green: { border: 'rgba(52, 211, 153, 0.45)', accent: '#34D399' },
    pink: { border: 'rgba(244, 114, 182, 0.45)', accent: '#F472B6' },
};

/**
 * Footer dos cards de share. Mostra avatar+nome+@instagram do trainer.
 *
 * Antes (1.6.0/33-) gerávamos um @ falso derivando do nome (ex.: "Gustavo
 * Prado" → "@gustavo.p"), o que confundia alunos e gerava tags inválidas
 * no Instagram. Agora usamos `coach.instagram_handle` real cadastrado
 * pelo trainer no perfil. Se vazio, a linha some inteira — preferimos
 * omitir a mostrar algo falso.
 */
export const ShareBrandFooter = ({ coach, tint = 'purple' }: ShareBrandFooterProps) => {
    const t = TINTS[tint];
    const handle = coach?.instagram_handle?.trim() || null;

    return (
        <View style={styles.footer}>
            <View style={styles.coachSection}>
                {coach?.avatar_url ? (
                    <Image
                        source={{ uri: coach.avatar_url }}
                        style={[styles.avatar, { borderColor: t.border }]}
                    />
                ) : (
                    <View
                        style={[
                            styles.avatar,
                            styles.avatarFallback,
                            { borderColor: t.border },
                        ]}
                    >
                        <Text style={styles.avatarInitial}>
                            {(coach?.name ?? 'K').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
                <View style={styles.coachInfo}>
                    <Text style={styles.coachName} numberOfLines={1}>
                        {coach?.name ?? 'Kinevo'}
                    </Text>
                    <Text style={styles.coachRole} numberOfLines={1}>
                        Personal Trainer
                    </Text>
                    {handle && (
                        <Text
                            style={[styles.coachHandle, { color: t.accent }]}
                            numberOfLines={1}
                        >
                            @{handle}
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.brand}>
                <View style={[styles.brandDot, { backgroundColor: t.accent }]} />
                <Text style={styles.brandText}>kinevo.app</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        marginTop: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
        gap: 12,
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#1E293B',
        borderWidth: 1.5,
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#E2E8F0',
        fontWeight: '800',
        fontSize: 12,
    },
    coachInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    coachName: {
        color: '#F1F5F9',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 14,
    },
    coachRole: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '500',
        lineHeight: 11,
    },
    coachHandle: {
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
        marginTop: 1,
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    brandText: {
        color: '#F1F5F9',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame } from 'lucide-react-native';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { formatVolumeAbsolute } from './_shared/formatVolume';

const PURPLE_SOFT = '#C4B5FD';
const PURPLE_ACCENT = '#A78BFA';

export const SummaryTemplate = ({
    workoutName,
    duration,
    volume,
    date,
    coach,
    deltaVolumePercent,
    streakDays,
}: ShareableCardProps) => {
    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#312E81', '#1E1B4B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            />

            {/* Decorative glows */}
            <View style={styles.glowTopLeft} />
            <View style={styles.glowBottomRight} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>META DO DIA · CUMPRIDA</Text>
                    </View>
                    <Text
                        style={styles.mainTitle}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                    >
                        {workoutName}
                    </Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Hero metrics */}
                <View style={styles.heroMetrics}>
                    <View style={styles.heroItem}>
                        <Text
                            style={styles.heroValue}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.6}
                        >
                            {duration}
                        </Text>
                        <Text style={styles.heroLabel}>DURAÇÃO</Text>
                    </View>

                    <View style={styles.verticalDivider} />

                    <View style={styles.heroItem}>
                        <Text
                            style={styles.heroValue}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.5}
                        >
                            {formatVolumeAbsolute(volume)}
                        </Text>
                        <Text style={styles.heroLabel}>PESO TOTAL</Text>
                        {/* Delta micro pill — só renderiza quando há dados reais */}
                        {deltaVolumePercent != null && deltaVolumePercent > 0 && (
                            <View style={styles.deltaPill}>
                                <Text style={styles.deltaText}>
                                    +{deltaVolumePercent.toFixed(0)}% vs último
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Streak banner — placeholder visual quando streakDays ausente */}
                <View style={styles.streakBanner}>
                    <Flame size={14} color="#F472B6" />
                    <Text style={styles.streakText}>
                        {streakDays != null
                            ? `${streakDays} dias seguidos`
                            : '12 dias seguidos'}
                    </Text>
                </View>

                <View style={{ flex: 1 }} />

                <ShareBrandFooter coach={coach} tint="purple" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#020617',
        overflow: 'hidden',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    glowTopLeft: {
        position: 'absolute',
        top: -120,
        left: -120,
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: 'rgba(124, 58, 237, 0.18)',
    },
    glowBottomRight: {
        position: 'absolute',
        bottom: -80,
        right: -80,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(244, 114, 182, 0.08)',
    },
    content: {
        flex: 1,
        padding: 28,
        paddingVertical: 42,
    },
    header: {
        marginBottom: 32,
    },
    badge: {
        backgroundColor: 'rgba(167, 139, 250, 0.14)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
    },
    badgeText: {
        color: PURPLE_ACCENT,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    mainTitle: {
        color: '#F8FAFC',
        fontSize: 44,
        fontWeight: '900',
        lineHeight: 46,
        marginBottom: 8,
        letterSpacing: -1.5,
        textTransform: 'uppercase',
    },
    date: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
    },
    heroMetrics: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    heroItem: {
        flex: 1,
    },
    heroValue: {
        color: PURPLE_SOFT,
        fontSize: 38,
        fontWeight: '900',
        letterSpacing: -1.5,
        marginBottom: 4,
        lineHeight: 42,
    },
    heroLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    verticalDivider: {
        width: 1,
        height: 64,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: 16,
        marginTop: 6,
    },
    deltaPill: {
        alignSelf: 'flex-start',
        marginTop: 8,
        backgroundColor: 'rgba(52, 211, 153, 0.14)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(52, 211, 153, 0.28)',
    },
    deltaText: {
        color: '#34D399',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    streakBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        backgroundColor: 'rgba(244, 114, 182, 0.10)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.18)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    streakText: {
        color: '#FCE7F3',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

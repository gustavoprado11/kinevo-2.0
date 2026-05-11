import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy } from 'lucide-react-native';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';
import { formatVolumeAbsolute } from './_shared/formatVolume';

const GOLD = '#F4C04E';
const GOLD_SOFT = '#FDE68A';
const GOLD_BORDER = 'rgba(244, 196, 78, 0.4)';
const GOLD_BG = 'rgba(244, 196, 78, 0.18)';
const GOLD_EYEBROW = 'rgba(244, 196, 78, 0.75)';
const GOLD_EYEBROW_VOLUME = 'rgba(244, 196, 78, 0.55)';

export const MaxLoadsTemplate = ({
    workoutName,
    date,
    coach,
    maxLoads,
    volume,
}: ShareableCardProps) => {
    const displayLoads =
        maxLoads?.slice().sort((a, b) => b.weight - a.weight).slice(0, 3) ?? [];

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#1E1B4B', '#0F172A', '#020617']}
                locations={[0, 0.45, 1]}
                style={styles.gradient}
            />

            {/* Decorative glows */}
            <View style={styles.glowGold} />
            <View style={styles.glowPurple} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <Trophy size={12} color={GOLD} />
                        <Text style={styles.badgeText}>Destaques do Treino</Text>
                    </View>
                    <Text style={styles.workoutName} numberOfLines={2}>
                        {workoutName}
                    </Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Loads list */}
                <View style={styles.loadsContainer}>
                    {displayLoads.length > 0 ? (
                        displayLoads.map((item, index) => {
                            const isPr = !!item.isPr;
                            return (
                                <View key={index} style={styles.loadItem}>
                                    {isPr && (
                                        <Text style={styles.eyebrow}>SUPERIOR A</Text>
                                    )}
                                    <View style={styles.weightRow}>
                                        <Text
                                            style={[
                                                styles.weightText,
                                                isPr && styles.weightTextPr,
                                            ]}
                                        >
                                            {item.weight}
                                            <Text style={styles.unitText}>kg</Text>
                                        </Text>
                                        {isPr && (
                                            <View style={styles.prBadge}>
                                                <Text style={styles.prText}>PR</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.metaRow}>
                                        <Text
                                            style={styles.exerciseName}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.75}
                                        >
                                            {item.exerciseName}
                                        </Text>
                                        <Text style={styles.metaDot}>·</Text>
                                        <Text style={styles.repsText}>
                                            {item.reps} reps
                                        </Text>
                                    </View>
                                    {isPr && (
                                        <View style={styles.deltaPill}>
                                            <Text style={styles.deltaText}>
                                                Recorde pessoal
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>
                                Sem dados de carga registrados.
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ flex: 1 }} />

                {/* Volume bloco */}
                <View style={styles.volumeContainer}>
                    <Text style={styles.volumeEyebrow}>TOTAL LEVANTADO</Text>
                    <Text
                        style={styles.volumeValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                    >
                        {formatVolumeAbsolute(volume)}
                    </Text>
                </View>

                <ShareBrandFooter coach={coach} tint="gold" />
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
    glowGold: {
        position: 'absolute',
        top: -70,
        right: -70,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(244, 196, 78, 0.06)',
    },
    glowPurple: {
        position: 'absolute',
        bottom: -90,
        left: -90,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(124, 58, 237, 0.05)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 28,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 24,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: GOLD_BG,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 14,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(244, 196, 78, 0.25)',
    },
    badgeText: {
        color: GOLD,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    workoutName: {
        color: '#F8FAFC',
        fontSize: 28,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginBottom: 4,
    },
    date: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
    },
    loadsContainer: {
        gap: 10,
    },
    loadItem: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
        paddingBottom: 8,
    },
    eyebrow: {
        color: GOLD_EYEBROW,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2.5,
        marginBottom: 4,
    },
    weightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    weightText: {
        color: '#F8FAFC',
        fontSize: 44,
        fontWeight: '900',
        letterSpacing: -1.5,
        lineHeight: 48,
    },
    weightTextPr: {
        color: GOLD,
    },
    unitText: {
        fontSize: 18,
        color: '#94A3B8',
        fontWeight: '700',
    },
    prBadge: {
        backgroundColor: GOLD_BG,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    prText: {
        color: GOLD,
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    exerciseName: {
        color: '#E2E8F0',
        fontSize: 14,
        fontWeight: '700',
        flexShrink: 1,
    },
    metaDot: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
    },
    repsText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    deltaPill: {
        alignSelf: 'flex-start',
        marginTop: 8,
        backgroundColor: 'rgba(52, 211, 153, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(52, 211, 153, 0.25)',
    },
    deltaText: {
        color: '#34D399',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
    },
    emptyText: {
        color: '#64748B',
    },
    volumeContainer: {
        marginTop: 8,
        paddingTop: 6,
        marginBottom: 20,
    },
    volumeEyebrow: {
        color: GOLD_EYEBROW_VOLUME,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2.5,
        marginBottom: 4,
    },
    volumeValue: {
        color: GOLD_SOFT,
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'],
    },
});

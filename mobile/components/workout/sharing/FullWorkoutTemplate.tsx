import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Clock, Flame, TrendingUp, Trophy } from 'lucide-react-native';
import { ShareableCardProps } from './types';
import { ShareBrandFooter } from './_shared/ShareBrandFooter';

const MAX_VISIBLE_EXERCISES = 5;

export const FullWorkoutTemplate = ({
    workoutName,
    date,
    duration,
    volume,
    coach,
    exerciseDetails,
    streakDays,
    prCount,
}: ShareableCardProps) => {
    const exercises = exerciseDetails ?? [];
    const visibleExercises = exercises.slice(0, MAX_VISIBLE_EXERCISES);
    const remainingCount = exercises.length - MAX_VISIBLE_EXERCISES;

    const showPrBadge = (prCount ?? 0) > 0 || exercises.length > 0; // placeholder até hook expor
    const showStreakBadge = (streakDays ?? 0) > 0 || exercises.length > 0; // placeholder

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#0F172A', '#1A2541', '#020617']}
                locations={[0, 0.55, 1]}
                style={styles.gradient}
            />

            <View style={styles.glowPurple} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.achievementsRow}>
                        {showPrBadge && (
                            <View style={[styles.achBadge, styles.achBadgeGold]}>
                                <Trophy size={9} color="#F4C04E" />
                                <Text style={[styles.achText, { color: '#F4C04E' }]}>
                                    RECORDE
                                </Text>
                            </View>
                        )}
                        {showStreakBadge && (
                            <View style={[styles.achBadge, styles.achBadgePink]}>
                                <Flame size={9} color="#F472B6" />
                                <Text style={[styles.achText, { color: '#F472B6' }]}>
                                    {streakDays ? `${streakDays}d` : 'SEQUÊNCIA'}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.achBadge, styles.achBadgeGreen]}>
                            <CheckCircle2 size={9} color="#34D399" />
                            <Text style={[styles.achText, { color: '#34D399' }]}>
                                COMPLETO
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.workoutName} numberOfLines={2}>
                        {workoutName}
                    </Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Exercise list */}
                <View style={styles.exerciseList}>
                    {visibleExercises.map((ex, index) => (
                        <View key={index} style={styles.exerciseRow}>
                            <LinearGradient
                                colors={['#7C3AED', '#A78BFA']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.exerciseIndex}
                            >
                                <Text style={styles.indexText}>{index + 1}</Text>
                            </LinearGradient>
                            <View style={styles.exerciseInfo}>
                                <Text
                                    style={styles.exerciseName}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.75}
                                >
                                    {ex.name}
                                </Text>
                                <Text style={styles.exerciseSets}>
                                    {ex.sets}x{ex.reps}
                                    <Text style={styles.metaDot}> · </Text>
                                    <Text style={styles.exerciseWeight}>{ex.weight}kg</Text>
                                </Text>
                            </View>
                        </View>
                    ))}

                    {remainingCount > 0 && (
                        <View style={styles.moreRow}>
                            <Text style={styles.moreText}>
                                + {remainingCount} mais
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ flex: 1 }} />

                {/* Stats bar */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Clock size={18} color="#A78BFA" />
                        <Text style={styles.statValue}>{duration}</Text>
                        <Text style={styles.statLabel}>DURAÇÃO</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <TrendingUp size={18} color="#F472B6" />
                        <Text
                            style={styles.statValue}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                        >
                            {(volume / 1000).toFixed(1)}t
                        </Text>
                        <Text style={styles.statLabel}>TOTAL</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <CheckCircle2 size={18} color="#34D399" />
                        <Text style={styles.statValue}>{exercises.length}</Text>
                        <Text
                            style={styles.statLabel}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                        >
                            EXERCÍCIOS
                        </Text>
                    </View>
                </View>

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
    glowPurple: {
        position: 'absolute',
        top: -80,
        right: -80,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(124, 58, 237, 0.07)',
    },
    content: {
        flex: 1,
        padding: 24,
        paddingVertical: 28,
    },
    header: {
        marginBottom: 18,
    },
    achievementsRow: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: 6,
        marginBottom: 12,
    },
    achBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 100,
        borderWidth: 1,
    },
    achBadgeGold: {
        backgroundColor: 'rgba(244, 196, 78, 0.16)',
        borderColor: 'rgba(244, 196, 78, 0.4)',
    },
    achBadgePink: {
        backgroundColor: 'rgba(244, 114, 182, 0.16)',
        borderColor: 'rgba(244, 114, 182, 0.4)',
    },
    achBadgeGreen: {
        backgroundColor: 'rgba(52, 211, 153, 0.16)',
        borderColor: 'rgba(52, 211, 153, 0.4)',
    },
    achText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    workoutName: {
        color: '#F8FAFC',
        fontSize: 26,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        lineHeight: 30,
        marginBottom: 3,
    },
    date: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
    },
    exerciseList: {
        gap: 6,
        marginBottom: 4,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
    },
    exerciseIndex: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indexText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        color: '#F1F5F9',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    exerciseSets: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    metaDot: {
        color: '#475569',
    },
    exerciseWeight: {
        color: '#A78BFA',
        fontSize: 12,
        fontWeight: '700',
    },
    moreRow: {
        paddingVertical: 6,
        paddingLeft: 44,
    },
    moreText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    statValue: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    statLabel: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
});

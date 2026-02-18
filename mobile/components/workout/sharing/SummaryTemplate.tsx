import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, CheckCircle2, TrendingUp } from 'lucide-react-native';
import { ShareableCardProps } from './types';

export const SummaryTemplate = (
    { workoutName, duration, exerciseCount, volume, date, coach }: ShareableCardProps
) => {
    const coachHandle = coach ? `@${coach.name.replace(/\s+/g, '').toLowerCase()}` : '';

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#020617', '#1E1B4B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            />

            {/* Subtle decorative glow */}
            <View style={styles.decorativeCircle} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <CheckCircle2 size={12} color="#4ADE80" />
                        <Text style={styles.badgeText}>META DO DIA CUMPRIDA</Text>
                    </View>
                    <Text style={styles.mainTitle}>{workoutName}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Hero Metrics */}
                <View style={styles.heroMetrics}>
                    <View style={styles.heroItem}>
                        <View style={styles.iconContainer}>
                            <Clock size={24} color="#A78BFA" />
                        </View>
                        <View>
                            <Text style={styles.heroValue}>{duration}</Text>
                            <Text style={styles.heroLabel}>Duração</Text>
                        </View>
                    </View>

                    <View style={styles.verticalDivider} />

                    <View style={styles.heroItem}>
                        <View style={styles.iconContainer}>
                            <TrendingUp size={24} color="#F472B6" />
                        </View>
                        <View>
                            <Text style={styles.heroValue}>{(volume / 1000).toFixed(1)}t</Text>
                            <Text style={styles.heroLabel}>Volume Total</Text>
                        </View>
                    </View>
                </View>

                {/* Secondary Metrics */}
                <View style={styles.secondaryMetrics}>
                    <Text style={styles.secondaryText}>
                        <Text style={{ fontWeight: '700', color: 'white' }}>{exerciseCount}</Text> exercícios
                    </Text>
                    <View style={styles.dotDivider} />
                    <Text style={styles.secondaryText}>
                        <Text style={{ fontWeight: '700', color: 'white' }}>100%</Text> foco
                    </Text>
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer: Coach Promotion + Brand */}
                <View style={styles.footer}>
                    {coach ? (
                        <View style={styles.coachSection}>
                            {coach.avatar_url ? (
                                <Image
                                    source={{ uri: coach.avatar_url }}
                                    style={styles.coachAvatar}
                                />
                            ) : (
                                <View style={[styles.coachAvatar, { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }]}>
                                    <Text style={{ color: '#94A3B8', fontWeight: 'bold', fontSize: 14 }}>{coach.name.charAt(0)}</Text>
                                </View>
                            )}
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachLabel}>TREINADO POR</Text>
                                <Text style={styles.coachName}>{coach.name}</Text>
                                <Text style={styles.coachRole}>Personal Trainer • {coachHandle}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.coachSection}>
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachLabel}>POWERED BY</Text>
                                <Text style={styles.coachName}>Kinevo</Text>
                                <Text style={styles.coachRole}>Plataforma de Treinamento</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.brandSection}>
                        <Text style={styles.brandName}>kinevo.app</Text>
                    </View>
                </View>
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
    decorativeCircle: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
    },
    content: {
        flex: 1,
        padding: 32,
        paddingVertical: 48,
    },
    header: {
        marginBottom: 40,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 16,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    badgeText: {
        color: '#4ADE80',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    mainTitle: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
        lineHeight: 36,
        marginBottom: 4,
        letterSpacing: -0.5,
        textTransform: 'uppercase',
    },
    date: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
    },
    heroMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    heroItem: {
        flex: 1,
    },
    iconContainer: {
        marginBottom: 8,
    },
    heroValue: {
        color: 'white',
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
        marginBottom: 2,
    },
    heroLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    verticalDivider: {
        width: 1,
        height: 60,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 20,
    },
    secondaryMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        gap: 12,
        opacity: 0.8,
    },
    secondaryText: {
        color: '#CBD5E1',
        fontSize: 15,
    },
    dotDivider: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#64748B',
    },
    footer: {
        marginTop: 'auto',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    coachAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#7C3AED',
        marginRight: 10,
    },
    coachInfo: {
        justifyContent: 'center',
        flex: 1,
    },
    coachLabel: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 3,
        fontWeight: '700',
    },
    coachName: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 1,
    },
    coachRole: {
        color: '#A78BFA',
        fontSize: 11,
        fontWeight: '500',
    },
    brandSection: {
        marginBottom: 4,
        opacity: 0.5,
    },
    brandName: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    }
});

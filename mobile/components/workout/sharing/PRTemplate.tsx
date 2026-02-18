import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShareableCardProps } from './types';
import { Trophy, Flame } from 'lucide-react-native';

export const PRTemplate = ({
    workoutName, date, coach, maxLoads, volume
}: ShareableCardProps) => {

    const topLift = maxLoads?.sort((a, b) => b.weight - a.weight)[0];
    const coachHandle = coach ? `@${coach.name.replace(/\s+/g, '').toLowerCase()}` : '';

    if (!topLift) {
        return (
            <View style={[styles.container, { width: 320, height: 568, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: 'white' }}>Sem dados de carga para exibir PR.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#0F172A', '#BE185D', '#020617']}
                locations={[0, 0.5, 1]}
                style={styles.gradient}
            />

            {/* Decorative glows */}
            <View style={styles.decorativeCircle} />
            <View style={styles.decorativeCircleSmall} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <Flame size={12} color="#FDA4AF" />
                        <Text style={styles.badgeText}>NOVO RECORDE</Text>
                    </View>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Main PR Display */}
                <View style={styles.mainContent}>
                    <Trophy size={48} color="#FBCFE8" style={{ marginBottom: 24, alignSelf: 'center' }} />

                    <Text style={styles.exerciseName}>{topLift.exerciseName}</Text>
                    <Text style={styles.weightValue}>{topLift.weight}<Text style={styles.unitText}>kg</Text></Text>

                    <View style={styles.repsBadge}>
                        <Text style={styles.repsText}>{topLift.reps} repetições</Text>
                    </View>
                </View>

                {/* Secondary Stat */}
                <View style={styles.secondaryStats}>
                    <Text style={styles.secondaryLabel}>VOLUME TOTAL</Text>
                    <Text style={styles.secondaryValue}>{(volume / 1000).toFixed(1)} TON</Text>
                </View>

                <View style={{ flex: 1 }} />

                {/* Footer: Coach Promotion + Brand */}
                <View style={styles.footer}>
                    {coach ? (
                        <View style={styles.coachSection}>
                            {coach.avatar_url ? (
                                <Image source={{ uri: coach.avatar_url }} style={styles.coachAvatar} />
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
        backgroundColor: '#0F172A',
        overflow: 'hidden',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    decorativeCircle: {
        position: 'absolute',
        top: '20%',
        left: -100,
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: 'rgba(219, 39, 119, 0.15)',
    },
    decorativeCircleSmall: {
        position: 'absolute',
        bottom: 100,
        right: -50,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(219, 39, 119, 0.10)',
    },
    content: {
        flex: 1,
        padding: 32,
        paddingVertical: 48,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(244, 114, 182, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.2)',
    },
    badgeText: {
        color: '#FDA4AF',
        fontWeight: '700',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    date: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '500',
    },
    mainContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    exerciseName: {
        color: '#FBCFE8',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
        opacity: 0.9,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    weightValue: {
        color: 'white',
        fontSize: 64,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -2,
        lineHeight: 70,
        marginBottom: 16,
        textShadowColor: 'rgba(219, 39, 119, 0.5)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 20,
    },
    unitText: {
        fontSize: 32,
        color: '#94A3B8',
        fontWeight: '600',
    },
    repsBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 100,
    },
    repsText: {
        color: '#E2E8F0',
        fontSize: 14,
        fontWeight: '600',
    },
    secondaryStats: {
        alignItems: 'center',
        marginTop: 48,
        paddingTop: 32,
        width: '100%',
    },
    secondaryLabel: {
        color: '#F472B6',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    secondaryValue: {
        color: 'white',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
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
        backgroundColor: '#1E293B',
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: '#EC4899',
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
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        fontWeight: '500',
    },
    brandSection: {
        opacity: 0.5,
        marginBottom: 4,
    },
    brandName: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    }
});

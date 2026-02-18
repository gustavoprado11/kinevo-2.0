import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShareableCardProps } from './types';
import { Trophy, Flame } from 'lucide-react-native';

export const MaxLoadsTemplate = ({
    workoutName, date, coach, maxLoads, volume
}: ShareableCardProps) => {

    const displayLoads = maxLoads?.sort((a, b) => b.weight - a.weight).slice(0, 3) || [];
    const coachHandle = coach ? `@${coach.name.replace(/\s+/g, '').toLowerCase()}` : '';

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#0F172A', '#312E81', '#020617']}
                locations={[0, 0.4, 1]}
                style={styles.gradient}
            />

            {/* Subtle decorative glow */}
            <View style={styles.decorativeCircle} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <Trophy size={12} color="#FBBF24" />
                        <Text style={styles.badgeText}>Destaques do Treino</Text>
                    </View>
                    <Text style={styles.workoutName}>{workoutName}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Loads List */}
                <View style={styles.loadsContainer}>
                    {displayLoads.length > 0 ? (
                        displayLoads.map((item, index) => (
                            <View key={index} style={styles.loadItem}>
                                <View style={styles.loadMainContent}>
                                    <Text style={styles.weightText}>{item.weight}<Text style={styles.unitText}>kg</Text></Text>
                                    <Text style={styles.exerciseName} numberOfLines={1}>{item.exerciseName}</Text>
                                    <Text style={styles.repsText}>{item.reps} reps</Text>
                                </View>

                                {item.isPr && (
                                    <View style={styles.prBadge}>
                                        <Flame size={10} color="#F472B6" />
                                        <Text style={styles.prText}>NOVO RECORDE</Text>
                                    </View>
                                )}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Sem dados de carga registrados.</Text>
                        </View>
                    )}
                </View>

                {/* Volume */}
                <View style={styles.volumeContainer}>
                    <Text style={styles.volumeValue}>{(volume / 1000).toFixed(1)} TON</Text>
                    <Text style={styles.volumeLabel}>Volume Total Movimentado</Text>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FBBF24' }} />
                            <Text style={styles.brandName}>kinevo.app</Text>
                        </View>
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
        top: -50,
        right: -50,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(99, 102, 241, 0.06)',
    },
    content: {
        flex: 1,
        padding: 32,
        paddingVertical: 48,
    },
    header: {
        marginBottom: 32,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.15)',
    },
    badgeText: {
        color: '#FBBF24',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    workoutName: {
        color: 'white',
        fontSize: 32,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        lineHeight: 36,
        marginBottom: 4,
    },
    date: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
    },
    loadsContainer: {
        gap: 20,
    },
    loadItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        paddingBottom: 16,
    },
    loadMainContent: {
        flex: 1,
    },
    weightText: {
        color: 'white',
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -1,
        marginBottom: 2,
    },
    unitText: {
        fontSize: 16,
        color: '#94A3B8',
        fontWeight: '600',
    },
    exerciseName: {
        color: '#CBD5E1',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
        letterSpacing: 0.2,
    },
    repsText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '500',
    },
    prBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(244, 114, 182, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 100,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.2)',
    },
    prText: {
        color: '#F472B6',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    emptyText: {
        color: '#64748B',
    },
    volumeContainer: {
        marginTop: 32,
        paddingTop: 24,
    },
    volumeValue: {
        color: 'white',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    volumeLabel: {
        color: '#64748B',
        fontSize: 11,
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 1,
        marginTop: 2,
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
        borderColor: '#6366F1',
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
        color: '#818CF8',
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

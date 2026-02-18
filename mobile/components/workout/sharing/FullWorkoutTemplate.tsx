import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShareableCardProps } from './types';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react-native';

const MAX_VISIBLE_EXERCISES = 8;

export const FullWorkoutTemplate = ({
    workoutName, date, duration, volume, coach, exerciseDetails
}: ShareableCardProps) => {

    const coachHandle = coach ? `@${coach.name.replace(/\s+/g, '').toLowerCase()}` : '';
    const exercises = exerciseDetails || [];
    const visibleExercises = exercises.slice(0, MAX_VISIBLE_EXERCISES);
    const remainingCount = exercises.length - MAX_VISIBLE_EXERCISES;

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#020617', '#0F172A', '#1E1B4B', '#0F172A']}
                locations={[0, 0.3, 0.6, 1]}
                style={styles.gradient}
            />

            {/* Subtle decorative accent */}
            <View style={styles.decorativeAccent} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}>
                        <CheckCircle2 size={10} color="#4ADE80" />
                        <Text style={styles.badgeText}>TREINO CONCLUÍDO</Text>
                    </View>
                    <Text style={styles.workoutName}>{workoutName}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Exercise List */}
                <View style={styles.exerciseList}>
                    {visibleExercises.map((ex, index) => (
                        <View key={index} style={styles.exerciseRow}>
                            <View style={styles.exerciseIndex}>
                                <Text style={styles.indexText}>{index + 1}</Text>
                            </View>
                            <View style={styles.exerciseInfo}>
                                <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
                                <Text style={styles.exerciseSets}>
                                    {ex.sets}x{ex.reps} — <Text style={styles.exerciseWeight}>{ex.weight}kg</Text>
                                </Text>
                            </View>
                        </View>
                    ))}

                    {remainingCount > 0 && (
                        <View style={styles.moreRow}>
                            <Text style={styles.moreText}>+{remainingCount} exercício{remainingCount > 1 ? 's' : ''}</Text>
                        </View>
                    )}
                </View>

                {/* Summary Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Clock size={14} color="#A78BFA" />
                        <Text style={styles.statValue}>{duration}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <TrendingUp size={14} color="#F472B6" />
                        <Text style={styles.statValue}>{(volume / 1000).toFixed(1)}t</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{exercises.length} ex.</Text>
                    </View>
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
        backgroundColor: '#020617',
        overflow: 'hidden',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    decorativeAccent: {
        position: 'absolute',
        top: -80,
        right: -80,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(124, 58, 237, 0.06)',
    },
    content: {
        flex: 1,
        padding: 24,
        paddingVertical: 36,
    },
    header: {
        marginBottom: 20,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 10,
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    badgeText: {
        color: '#4ADE80',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    workoutName: {
        color: 'white',
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
        gap: 0,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    exerciseIndex: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    indexText: {
        color: '#A78BFA',
        fontSize: 11,
        fontWeight: '700',
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        color: '#E2E8F0',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 1,
    },
    exerciseSets: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
    },
    exerciseWeight: {
        color: '#94A3B8',
        fontWeight: '700',
    },
    moreRow: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    moreText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        fontStyle: 'italic',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
    statDivider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    footer: {
        marginTop: 'auto',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    coachAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1E293B',
        marginRight: 8,
        borderWidth: 1.5,
        borderColor: '#7C3AED',
    },
    coachInfo: {
        justifyContent: 'center',
        flex: 1,
    },
    coachLabel: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 8,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 2,
        fontWeight: '700',
    },
    coachName: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 1,
    },
    coachRole: {
        color: '#A78BFA',
        fontSize: 10,
        fontWeight: '500',
    },
    brandSection: {
        opacity: 0.5,
        marginBottom: 3,
    },
    brandName: {
        color: 'white',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    }
});

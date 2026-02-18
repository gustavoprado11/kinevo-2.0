import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, CheckCircle2, TrendingUp, Dumbbell } from 'lucide-react-native';

interface WorkoutShareableCardProps {
    workoutName: string;
    duration: string;
    exerciseCount: number;
    volume: number;
    date: string;
    studentName: string;
    coach: { name: string; avatar_url: string | null } | null;
}

export const WorkoutShareableCard = (
    { workoutName, duration, exerciseCount, volume, date, coach }: WorkoutShareableCardProps
) => {
    const coachHandle = coach ? `@${coach.name.replace(/\s+/g, '').toLowerCase()}` : '';

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#0F172A', '#1E1B4B', '#020617']}
                locations={[0, 0.6, 1]}
                style={styles.gradient}
            />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.mainTitle}>Treino{'\n'}Concluído</Text>
                    <Text style={styles.subTitle}>{workoutName}</Text>
                    <Text style={styles.date}>{date}</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsContainer}>
                    <View style={styles.gridRow}>
                        <View style={styles.statBox}>
                            <Clock size={20} color="#A78BFA" />
                            <Text style={styles.statValue}>{duration}</Text>
                            <Text style={styles.statLabel}>Duração</Text>
                        </View>
                        <View style={styles.statBox}>
                            <CheckCircle2 size={20} color="#34D399" />
                            <Text style={styles.statValue}>{exerciseCount}</Text>
                            <Text style={styles.statLabel}>Exercícios</Text>
                        </View>
                    </View>

                    <View style={styles.gridRow}>
                        <View style={styles.statBox}>
                            <TrendingUp size={20} color="#F472B6" />
                            <Text style={styles.statValue}>{(volume / 1000).toFixed(1)}t</Text>
                            <Text style={styles.statLabel}>Volume Total</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Dumbbell size={20} color="#60A5FA" />
                            <Text style={styles.statValue}>100%</Text>
                            <Text style={styles.statLabel}>Foco</Text>
                        </View>
                    </View>
                </View>

                {/* Footer: Coach Promotion */}
                <View style={styles.footer}>
                    {coach ? (
                        <View style={styles.coachSection}>
                            {coach.avatar_url ? (
                                <View style={styles.coachAvatarContainer}>
                                    <Image
                                        source={{ uri: coach.avatar_url }}
                                        style={styles.coachAvatar}
                                    />
                                </View>
                            ) : (
                                <View style={[styles.coachAvatarContainer, { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }]}>
                                    <Text style={{ color: '#94A3B8', fontWeight: 'bold', fontSize: 16 }}>{coach.name.charAt(0)}</Text>
                                </View>
                            )}
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachLabel}>TREINADO POR</Text>
                                <Text style={styles.coachName}>{coach.name}</Text>
                                <Text style={styles.coachRole}>{coachHandle}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.coachSection}>
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachLabel}>POWERED BY</Text>
                                <Text style={styles.coachName}>Kinevo</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.logoSection}>
                        <Text style={styles.logoText}>kinevo.app</Text>
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
    content: {
        flex: 1,
        padding: 32,
        justifyContent: 'space-between',
        paddingVertical: 48,
    },
    header: {
        marginBottom: 24,
    },
    mainTitle: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        lineHeight: 36,
    },
    subTitle: {
        color: '#A78BFA',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    date: {
        color: '#94A3B8',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    statsContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 20,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statBox: {
        width: '46%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    statValue: {
        color: 'white',
        fontSize: 28,
        fontWeight: '800',
        marginTop: 12,
        marginBottom: 2,
    },
    statLabel: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '500',
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        paddingTop: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    coachAvatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1E293B',
        marginRight: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#7C3AED',
    },
    coachAvatar: {
        width: '100%',
        height: '100%',
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
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 1,
    },
    coachRole: {
        color: '#A78BFA',
        fontSize: 12,
        fontWeight: '500',
    },
    logoSection: {
        alignItems: 'flex-end',
        opacity: 0.5,
    },
    logoText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 11,
        letterSpacing: 1,
    }
});

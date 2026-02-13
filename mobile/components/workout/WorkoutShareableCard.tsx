import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Clock, CheckCircle2, TrendingUp } from 'lucide-react-native';

const { width } = Dimensions.get('window');

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
    { workoutName, duration, exerciseCount, volume, date, studentName, coach }: WorkoutShareableCardProps
) => {
    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            {/* Background Gradient */}
            <LinearGradient
                colors={['#0F172A', '#1E1B4B', '#020617']}
                locations={[0, 0.6, 1]}
                style={styles.gradient}
            />

            {/* Content */}
            <View style={styles.content}>
                {/* Header: Title & Subtitle */}
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

                {/* Footer: Coach Branding */}
                <View style={styles.footer}>
                    {coach ? (
                        <View style={styles.coachSection}>
                            {coach.avatar_url && (
                                <View style={styles.coachAvatarContainer}>
                                    <Image
                                        source={{ uri: coach.avatar_url }}
                                        style={styles.coachAvatar}
                                    />
                                </View>
                            )}
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachLabel}>Treinado por</Text>
                                <Text style={styles.coachName}>{coach.name}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.coachSection}>
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachLabel}>Atleta</Text>
                                <Text style={styles.coachName}>{studentName}</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.logoSection}>
                        <Text style={styles.logoText}>KINEVO</Text>
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
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coachAvatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
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
    },
    coachLabel: {
        color: '#94A3B8',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    coachName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    logoSection: {
        alignItems: 'flex-end',
    },
    logoText: {
        color: 'rgba(255,255,255,0.3)',
        fontWeight: '800',
        fontSize: 14,
        letterSpacing: 2,
    }
});

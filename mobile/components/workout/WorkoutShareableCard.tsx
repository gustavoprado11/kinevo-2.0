import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface WorkoutShareableCardProps {
    workoutName: string;
    duration: string;
    exerciseCount: number;
    volume: number;
    date: string;
    studentName: string;
    coach: { name: string; avatar_url: string | null } | null;
    completedSets?: number;
    totalSets?: number;
    rpe?: number;
}

function formatDurationLabel(duration: string): string {
    // Convert "00:41" → "41min", "01:15" → "1h15m"
    const parts = duration.split(':');
    if (parts.length === 2) {
        const mins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        if (mins < 60) return `${mins}min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return duration;
}

function formatVolume(kg: number): string {
    if (kg >= 1000) {
        return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}t`;
    }
    return `${Math.round(kg)}kg`;
}

function formatDate(dateStr: string): string {
    // Input: "04/03/2026" (pt-BR format dd/mm/yyyy)
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;

    const day = parseInt(parts[0]);
    const monthIndex = parseInt(parts[1]) - 1;
    const year = parts[2];

    const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];

    return `${day} de ${months[monthIndex]}, ${year}`;
}

function CardStat({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.statBox}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

export const WorkoutShareableCard = ({
    workoutName,
    duration,
    exerciseCount,
    volume,
    date,
    coach,
    completedSets,
    totalSets,
    rpe,
}: WorkoutShareableCardProps) => {
    const setsDisplay = completedSets != null && totalSets != null
        ? `${completedSets}/${totalSets}`
        : String(exerciseCount);
    const setsLabel = completedSets != null ? 'Séries' : 'Exercícios';

    const intensityDisplay = rpe != null ? `${rpe}/10` : '—';

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <LinearGradient
                colors={['#1e1b4b', '#1a1a2e', '#0f172a']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.workoutName}>{workoutName}</Text>
                    <Text style={styles.date}>{formatDate(date)}</Text>
                </View>

                {/* Stats Grid 2×2 */}
                <View style={styles.statsContainer}>
                    <View style={styles.gridRow}>
                        <CardStat value={formatDurationLabel(duration)} label="Duração" />
                        <CardStat value={setsDisplay} label={setsLabel} />
                    </View>
                    <View style={styles.gridRow}>
                        <CardStat value={formatVolume(volume)} label="Volume" />
                        <CardStat value={intensityDisplay} label="Intensidade" />
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    {coach ? (
                        <View style={styles.coachSection}>
                            {coach.avatar_url ? (
                                <Image source={{ uri: coach.avatar_url }} style={styles.coachAvatar} />
                            ) : (
                                <View style={[styles.coachAvatar, styles.coachAvatarFallback]}>
                                    <Text style={styles.coachAvatarInitial}>
                                        {coach.name.charAt(0)}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachName}>{coach.name}</Text>
                                <Text style={styles.brandText}>kinevo.app</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.coachSection}>
                            <View style={styles.coachInfo}>
                                <Text style={styles.coachName}>Kinevo</Text>
                                <Text style={styles.brandText}>kinevo.app</Text>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#0f172a',
        overflow: 'hidden',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        padding: 28,
        paddingTop: 36,
        paddingBottom: 28,
    },

    // Header
    header: {
        marginBottom: 28,
    },
    workoutName: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    date: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 14,
        fontWeight: '500',
    },

    // Stats
    statsContainer: {
        gap: 12,
        marginBottom: 28,
    },
    gridRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statBox: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        padding: 16,
    },
    statValue: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        marginBottom: 4,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 12,
        fontWeight: '500',
    },

    // Footer
    footer: {
        marginTop: 'auto',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        paddingTop: 20,
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coachAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: 'rgba(124, 58, 237, 0.35)',
        marginRight: 10,
        overflow: 'hidden',
    },
    coachAvatarFallback: {
        backgroundColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
    },
    coachAvatarInitial: {
        color: '#94a3b8',
        fontWeight: '700',
        fontSize: 15,
    },
    coachInfo: {
        justifyContent: 'center',
    },
    coachName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 1,
    },
    brandText: {
        color: 'rgba(124, 58, 237, 0.7)',
        fontSize: 12,
        fontWeight: '500',
    },
});

import React from 'react';
import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'lucide-react-native';
import { ShareableCardProps } from './types';

function formatDurationShort(duration: string): string {
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

function formatVolumeShort(kg: number): string {
    if (kg >= 1000) {
        return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}t`;
    }
    return `${Math.round(kg)}kg`;
}

function formatRelativeDate(dateStr: string): string {
    const today = new Date().toLocaleDateString('pt-BR');
    if (dateStr === today) return 'Hoje';

    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;

    const day = parseInt(parts[0]);
    const monthIndex = parseInt(parts[1]) - 1;
    const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];
    return `${day} de ${months[monthIndex]}`;
}

function shortenName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export const PhotoOverlayTemplate = ({
    workoutName,
    duration,
    volume,
    date,
    coach,
    backgroundImageUri,
    exerciseCount,
    completedSets,
    totalSets,
    rpe,
}: ShareableCardProps) => {
    if (!backgroundImageUri) {
        return (
            <View style={[styles.container, { width: 320, height: 568 }]}>
                <View style={styles.placeholderContainer}>
                    <Camera size={48} color="#475569" />
                    <Text style={styles.placeholderText}>Adicione uma foto</Text>
                </View>
            </View>
        );
    }

    // Build stats array
    const stats: string[] = [formatDurationShort(duration)];
    if (volume > 0) stats.push(formatVolumeShort(volume));
    if (completedSets != null && totalSets != null) {
        stats.push(`${completedSets}/${totalSets}`);
    } else if (exerciseCount > 0) {
        stats.push(`${exerciseCount} ex.`);
    }
    if (rpe != null) stats.push(`RPE ${rpe}`);

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <ImageBackground
                source={{ uri: backgroundImageUri }}
                style={styles.imageBackground}
                resizeMode="cover"
            >
                {/* Subtle gradient only on bottom 35% */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.6)']}
                    locations={[0, 0.4, 1]}
                    style={styles.bottomGradient}
                />

                {/* Glass info card at bottom */}
                <View style={styles.infoContainer}>
                    <View style={styles.glassCard}>
                        {/* Row 1: Workout name + date */}
                        <View style={styles.titleRow}>
                            <Text style={styles.workoutName} numberOfLines={1}>
                                {workoutName}
                            </Text>
                            <Text style={styles.date}>
                                {formatRelativeDate(date)}
                            </Text>
                        </View>

                        {/* Row 2: Stats inline */}
                        <View style={styles.statsRow}>
                            {stats.map((stat, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <Text style={styles.statDot}>{'\u00B7'}</Text>}
                                    <Text style={styles.statText}>{stat}</Text>
                                </React.Fragment>
                            ))}
                        </View>

                        {/* Row 3: Trainer + branding */}
                        <View style={styles.trainerRow}>
                            {coach ? (
                                <>
                                    {coach.avatar_url ? (
                                        <Image
                                            source={{ uri: coach.avatar_url }}
                                            style={styles.miniAvatar}
                                        />
                                    ) : (
                                        <View style={[styles.miniAvatar, styles.miniAvatarFallback]}>
                                            <Text style={styles.miniAvatarInitial}>
                                                {coach.name.charAt(0)}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={styles.trainerName}>
                                        {shortenName(coach.name)}
                                    </Text>
                                    <Text style={styles.dot}>{'\u00B7'}</Text>
                                    <Text style={styles.brand}>kinevo</Text>
                                </>
                            ) : (
                                <Text style={styles.brand}>kinevo.app</Text>
                            )}
                        </View>
                    </View>
                </View>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    imageBackground: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
    },
    infoContainer: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
    },
    glassCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 16,
        padding: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },

    // Title row
    titleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    workoutName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        marginRight: 8,
    },
    date: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.55)',
        fontWeight: '500',
    },

    // Stats row
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 6,
    },
    statText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.88)',
        fontVariant: ['tabular-nums'],
    },
    statDot: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.3)',
    },

    // Trainer row
    trainerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 9,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    miniAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        overflow: 'hidden',
    },
    miniAvatarFallback: {
        backgroundColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniAvatarInitial: {
        color: '#94a3b8',
        fontWeight: '700',
        fontSize: 9,
    },
    trainerName: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.75)',
    },
    dot: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.3)',
    },
    brand: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(124, 58, 237, 0.85)',
    },

    // Placeholder
    placeholderContainer: {
        flex: 1,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#94a3b8',
        marginTop: 12,
        fontSize: 16,
    },
});

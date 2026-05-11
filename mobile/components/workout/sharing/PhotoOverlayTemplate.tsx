import React from 'react';
import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { ShareableCardProps } from './types';
import { rpeColor } from './_shared/rpeColor';
import { formatVolumeCompact } from './_shared/formatVolume';

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

function shortenHandle(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return `@${parts[0].toLowerCase()}`;
    const first = parts[0].toLowerCase();
    const lastInitial = parts[parts.length - 1].charAt(0).toLowerCase();
    return `@${first}.${lastInitial}`;
}

interface AchievementCorner {
    label: string;
    bg: string;
    border: string;
    color: string;
}

function pickAchievement(
    rpe: number | undefined,
    prCount: number | undefined,
): AchievementCorner {
    if ((prCount ?? 0) > 0) {
        return {
            label: 'RECORDE',
            bg: 'rgba(244, 196, 78, 0.20)',
            border: 'rgba(244, 196, 78, 0.5)',
            color: '#F4C04E',
        };
    }
    if (rpe != null && rpe >= 8) {
        return {
            label: 'INTENSO',
            bg: 'rgba(239, 68, 68, 0.20)',
            border: 'rgba(239, 68, 68, 0.5)',
            color: '#FCA5A5',
        };
    }
    return {
        label: '@kinevo.app',
        bg: 'rgba(124, 58, 237, 0.22)',
        border: 'rgba(167, 139, 250, 0.5)',
        color: '#C4B5FD',
    };
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
    prCount,
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

    const stats: string[] = [formatDurationShort(duration)];
    if (volume > 0) stats.push(formatVolumeCompact(volume));
    if (completedSets != null && totalSets != null) {
        stats.push(`${completedSets}/${totalSets}`);
    } else if (exerciseCount > 0) {
        stats.push(`${exerciseCount} ex.`);
    }

    const achievement = pickAchievement(rpe, prCount);

    // RPE ring math
    const RING_SIZE = 28;
    const RING_R = 12;
    const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 75.4
    const rpeValue = rpe ?? 0;
    const rpeDash = `${(rpeValue / 10) * RING_CIRC} ${RING_CIRC}`;
    const rpeStroke = rpe != null ? rpeColor(rpe) : 'rgba(255,255,255,0.4)';

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <ImageBackground
                source={{ uri: backgroundImageUri }}
                style={styles.imageBackground}
                resizeMode="cover"
            >
                {/* Top-left pill: date label */}
                <View style={styles.topLeftPill}>
                    <View style={styles.liveDot} />
                    <Text
                        style={styles.topLeftText}
                        numberOfLines={1}
                    >
                        {formatRelativeDate(date).toUpperCase()}
                    </Text>
                </View>

                {/* Top-right achievement */}
                <View
                    style={[
                        styles.topRightBadge,
                        {
                            backgroundColor: achievement.bg,
                            borderColor: achievement.border,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.topRightText,
                            { color: achievement.color },
                            achievement.label.startsWith('@') && {
                                textTransform: 'none',
                                letterSpacing: 0.3,
                            },
                        ]}
                    >
                        {achievement.label}
                    </Text>
                </View>

                {/* Subtle gradient bottom */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.6)']}
                    locations={[0, 0.5, 1]}
                    style={styles.bottomGradient}
                />

                {/* Glass info card */}
                <View style={styles.infoContainer}>
                    <View style={styles.glassCard}>
                        {/* Top highlight border */}
                        <View style={styles.glassTopHighlight} />

                        {/* Row 1: workout + date */}
                        <View style={styles.titleRow}>
                            <Text style={styles.workoutName} numberOfLines={1}>
                                {workoutName}
                            </Text>
                            <Text style={styles.date}>
                                {formatRelativeDate(date)}
                            </Text>
                        </View>

                        {/* Row 2: stats inline */}
                        <View style={styles.statsRow}>
                            {stats.map((stat, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <Text style={styles.statDot}>·</Text>}
                                    <Text style={styles.statText}>{stat}</Text>
                                </React.Fragment>
                            ))}
                        </View>

                        {/* Row 3: trainer + RPE ring */}
                        <View style={styles.trainerRow}>
                            <View style={styles.trainerSection}>
                                {coach ? (
                                    <>
                                        {coach.avatar_url ? (
                                            <Image
                                                source={{ uri: coach.avatar_url }}
                                                style={styles.miniAvatar}
                                            />
                                        ) : (
                                            <View
                                                style={[
                                                    styles.miniAvatar,
                                                    styles.miniAvatarFallback,
                                                ]}
                                            >
                                                <Text style={styles.miniAvatarInitial}>
                                                    {coach.name.charAt(0)}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.trainerTextCol}>
                                            <Text
                                                style={styles.trainerName}
                                                numberOfLines={1}
                                            >
                                                {shortenName(coach.name)}
                                            </Text>
                                            <Text
                                                style={styles.trainerHandle}
                                                numberOfLines={1}
                                            >
                                                {shortenHandle(coach.name)}
                                            </Text>
                                        </View>
                                    </>
                                ) : (
                                    <Text style={styles.brand}>kinevo.app</Text>
                                )}
                            </View>

                            {rpe != null && (
                                <View style={styles.rpeSection}>
                                    <Svg width={RING_SIZE} height={RING_SIZE}>
                                        <Circle
                                            cx={14}
                                            cy={14}
                                            r={RING_R}
                                            stroke="rgba(255,255,255,0.18)"
                                            strokeWidth={3}
                                            fill="none"
                                        />
                                        <Circle
                                            cx={14}
                                            cy={14}
                                            r={RING_R}
                                            stroke={rpeStroke}
                                            strokeWidth={3}
                                            fill="none"
                                            strokeDasharray={rpeDash}
                                            strokeLinecap="round"
                                            transform={`rotate(-90 14 14)`}
                                        />
                                    </Svg>
                                    <Text
                                        style={[styles.rpeValue, { color: rpeStroke }]}
                                    >
                                        {rpe}
                                    </Text>
                                </View>
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
    topLeftPill: {
        position: 'absolute',
        top: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 100,
        maxWidth: 140,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#34D399',
    },
    topLeftText: {
        color: '#F1F5F9',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    topRightBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
    },
    topRightText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
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
        bottom: 20,
        left: 16,
        right: 16,
    },
    glassCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.62)',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        overflow: 'hidden',
    },
    glassTopHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    workoutName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        flex: 1,
        marginRight: 8,
        letterSpacing: -0.3,
    },
    date: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.55)',
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 6,
    },
    statText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.88)',
        fontVariant: ['tabular-nums'],
    },
    statDot: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.25)',
        fontWeight: '700',
    },
    trainerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        gap: 12,
    },
    trainerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    miniAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
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
        fontSize: 10,
    },
    trainerTextCol: {
        flex: 1,
    },
    trainerName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 1,
    },
    trainerHandle: {
        fontSize: 10,
        fontWeight: '600',
        color: '#A78BFA',
    },
    rpeSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rpeValue: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
        marginLeft: 6,
    },
    brand: {
        fontSize: 12,
        fontWeight: '700',
        color: '#A78BFA',
    },
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

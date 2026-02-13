import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShareableCardProps } from './types';
import { Camera, CheckCircle2 } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export const PhotoOverlayTemplate = ({
    workoutName, duration, volume, date, studentName, coach, backgroundImageUri, exerciseCount
}: ShareableCardProps) => {

    const coachHandle = coach ? `@${coach.name.replace(/\s+/g, '').toLowerCase()}` : '';

    // Fallback / Placeholder State
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

    return (
        <View style={[styles.container, { width: 320, height: 568 }]}>
            <ImageBackground
                source={{ uri: backgroundImageUri }}
                style={styles.imageBackground}
                resizeMode="cover"
            >
                {/* Elite Overlay - Deeper gradient for text legibility */}
                <LinearGradient
                    colors={['transparent', 'rgba(2, 6, 23, 0.2)', 'rgba(2, 6, 23, 0.8)', '#020617']}
                    locations={[0, 0.4, 0.7, 1]}
                    style={styles.overlay}
                />

                <View style={styles.content}>
                    {/* Empty top space for the photo subject */}
                    <View style={{ flex: 1 }} />

                    {/* Bottom Overlay Content */}
                    <View style={styles.infoContainer}>
                        {/* 1. Header & Title */}
                        <View style={styles.header}>
                            <View style={styles.badge}>
                                <CheckCircle2 size={10} color="#4ADE80" />
                                <Text style={styles.badgeText}>TREINO CONCLUÍDO</Text>
                            </View>
                            <Text style={styles.workoutName}>{workoutName}</Text>
                            <Text style={styles.date}>{date}</Text>
                        </View>

                        {/* 2. Vertical Stack Metrics - The "Elite" requirement */}
                        <View style={styles.metricsStack}>
                            <Text style={styles.metricItem}>{duration}</Text>
                            <Text style={styles.metricItem}>{(volume / 1000).toFixed(1)} toneladas</Text>
                            <Text style={styles.metricItem}>{exerciseCount} exercícios</Text>
                        </View>

                        {/* Divider */}
                        <View style={styles.divider} />

                        {/* 3. Footer: Coach & Brand */}
                        <View style={styles.footer}>
                            {coach ? (
                                <View style={styles.coachSection}>
                                    {coach.avatar_url ? (
                                        <Image source={{ uri: coach.avatar_url }} style={styles.coachAvatar} />
                                    ) : (
                                        <View style={[styles.coachAvatar, { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }]}>
                                            <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>{coach.name.charAt(0)}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={styles.coachLabel}>Treinado por</Text>
                                        <Text style={styles.coachName}>{coach.name}</Text>
                                        <Text style={styles.coachRole}>Personal Trainer • {coachHandle}</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.coachSection}>
                                    <View>
                                        {/* Removed 'Atleta' label redundancy per elite prompt if clean */}
                                        <Text style={styles.coachName}>{studentName}</Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.brandSection}>
                                <Text style={styles.brandName}>kinevo.app</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ImageBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#020617',
        overflow: 'hidden',
    },
    imageBackground: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 32,
        paddingBottom: 40,
    },
    infoContainer: {
        // Container for all bottom content
    },
    header: {
        marginBottom: 24,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 12,
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
    workoutName: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginBottom: 4,
    },
    date: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
    },
    metricsStack: {
        marginBottom: 32,
        gap: 2,
    },
    metricItem: { // Vertical stack style
        color: 'white',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 24,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coachSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coachAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1E293B',
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: '#4ADE80', // Green accent for completed/photo
    },
    coachLabel: {
        color: '#94A3B8',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
        marginBottom: 2,
    },
    coachName: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 1,
    },
    coachRole: {
        color: '#4ADE80',
        fontSize: 11,
        fontWeight: '500',
    },
    brandSection: {
        opacity: 0.7,
    },
    brandName: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    placeholderContainer: {
        flex: 1,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#94A3B8',
        marginTop: 12,
        fontSize: 16,
    }
});
